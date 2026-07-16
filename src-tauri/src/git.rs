//! Git Integration Module
//!
//! Provides Git repository operations using git2-rs library.

use git2::{
    Commit, Cred, DiffOptions, FetchOptions, Oid, PushOptions, RemoteCallbacks, Repository,
    Signature, StatusOptions,
};
use std::path::Path;

/// Git repository information
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GitRepoInfo {
    pub path: String,
    pub branch: Option<String>,
    pub remote_url: Option<String>,
    pub is_dirty: bool,
    pub head_commit: Option<String>,
}

/// Git file status
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GitFileStatus {
    pub path: String,
    pub status: String, // "modified", "new", "deleted", "renamed", "untracked", "staged"
    pub is_staged: bool,
}

/// Git commit information
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GitCommitInfo {
    pub id: String,
    pub short_id: String,
    pub message: String,
    pub author_name: String,
    pub author_email: String,
    pub timestamp: i64,
    pub parent_ids: Vec<String>,
    pub refs: Vec<String>,
}

/// Detect Git repository from a path (searches upward)
pub fn detect_repo(path: &str) -> Result<Option<GitRepoInfo>, String> {
    let path = Path::new(path);

    // Try to find repo from the given path or its ancestors
    let repo = match Repository::discover(path) {
        Ok(r) => r,
        Err(_) => return Ok(None),
    };

    let repo_path = repo
        .workdir()
        .unwrap_or(repo.path())
        .to_string_lossy()
        .to_string();

    // Get current branch
    let branch = repo
        .head()
        .ok()
        .and_then(|head| head.shorthand().map(|s| s.to_string()));

    // Get remote URL (origin)
    let remote_url = repo
        .find_remote("origin")
        .ok()
        .and_then(|r| r.url().map(|s| s.to_string()));

    // Check if repo is dirty
    let is_dirty = !repo
        .statuses(Some(StatusOptions::new().include_untracked(true)))
        .map(|s| s.is_empty())
        .unwrap_or(true);

    // Get HEAD commit
    let head_commit = repo
        .head()
        .ok()
        .and_then(|h| h.peel_to_commit().ok())
        .map(|c| c.id().to_string());

    Ok(Some(GitRepoInfo {
        path: repo_path,
        branch,
        remote_url,
        is_dirty,
        head_commit,
    }))
}

/// Get status of files in repository
pub fn get_status(repo_path: &str) -> Result<Vec<GitFileStatus>, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    let mut status_opts = StatusOptions::new();
    status_opts
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);

    let statuses = repo
        .statuses(Some(&mut status_opts))
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let status = entry.status();

        // Determine status string and whether it's staged
        let (status_str, is_staged) = if status.is_index_new() {
            ("new".to_string(), true)
        } else if status.is_index_modified() {
            ("modified".to_string(), true)
        } else if status.is_index_deleted() {
            ("deleted".to_string(), true)
        } else if status.is_index_renamed() {
            ("renamed".to_string(), true)
        } else if status.is_wt_new() {
            ("untracked".to_string(), false)
        } else if status.is_wt_modified() {
            ("modified".to_string(), false)
        } else if status.is_wt_deleted() {
            ("deleted".to_string(), false)
        } else if status.is_wt_renamed() {
            ("renamed".to_string(), false)
        } else {
            continue; // Skip files with unknown status
        };

        result.push(GitFileStatus {
            path,
            status: status_str,
            is_staged,
        });
    }

    Ok(result)
}

/// Stage a file (git add)
pub fn stage_file(repo_path: &str, file_path: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;

    index
        .add_path(Path::new(file_path))
        .map_err(|e| e.to_string())?;

    index.write().map_err(|e| e.to_string())?;

    Ok(())
}

/// Stage all changes (git add -A)
pub fn stage_all(repo_path: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;

    index
        .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| e.to_string())?;

    index.write().map_err(|e| e.to_string())?;

    Ok(())
}

/// Unstage a file (git reset HEAD)
pub fn unstage_file(repo_path: &str, file_path: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    let head = repo.head().map_err(|e| e.to_string())?;
    let head_commit = head.peel_to_commit().map_err(|e| e.to_string())?;
    let _head_tree = head_commit.tree().map_err(|e| e.to_string())?;

    let mut index = repo.index().map_err(|e| e.to_string())?;

    // Reset this file to HEAD
    repo.reset_default(Some(head_commit.as_object()), [Path::new(file_path)])
        .map_err(|e| e.to_string())?;

    index.write().map_err(|e| e.to_string())?;

    Ok(())
}

/// Create a commit
pub fn commit(repo_path: &str, message: &str) -> Result<String, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    let mut index = repo.index().map_err(|e| e.to_string())?;
    let tree_id = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_id).map_err(|e| e.to_string())?;

    // Get signature from git config or use default
    let sig = repo
        .signature()
        .unwrap_or_else(|_| Signature::now("DataTeX User", "user@datatex.local").unwrap());

    // Get parent commit(s)
    let parents: Vec<Commit> = if let Ok(head) = repo.head() {
        if let Ok(commit) = head.peel_to_commit() {
            vec![commit]
        } else {
            vec![]
        }
    } else {
        vec![] // Initial commit
    };

    let parent_refs: Vec<&Commit> = parents.iter().collect();

    let commit_id = repo
        .commit(Some("HEAD"), &sig, &sig, message, &tree, &parent_refs)
        .map_err(|e| e.to_string())?;

    Ok(commit_id.to_string())
}

/// Get commit log
pub fn get_log(
    repo_path: &str,
    limit: Option<i32>,
    all: bool,
) -> Result<Vec<GitCommitInfo>, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(200) as usize; // Increase default limit for graph

    // NEW: Pre-fetch refs (branches and tags)
    let mut refs_map: std::collections::HashMap<Oid, Vec<String>> =
        std::collections::HashMap::new();

    // Get local branches
    if let Ok(branches) = repo.branches(None) {
        for (branch, _) in branches.flatten() {
            if let Ok(Some(name)) = branch.name() {
                // branches(None) gives local & remote.
                // Local: "master", Remote: "origin/master"
                if let Some(target) = branch.get().target() {
                    refs_map.entry(target).or_default().push(name.to_string());
                }
            }
        }
    }

    // Get tags
    if let Ok(tags) = repo.tag_names(None) {
        for tag_name in tags.iter().flatten() {
            if let Ok(obj) = repo.revparse_single(tag_name) {
                // For annotated tags, peel to commit
                let target_id = if let Ok(peeled) = obj.peel_to_commit() {
                    peeled.id()
                } else {
                    obj.id()
                };
                // Tag names in `tag_names` are just the suffix (e.g. "v1.0"), but maybe full ref?
                // usually just "v1.0". Let's verify. `tag_names` returns simple names.
                refs_map
                    .entry(target_id)
                    .or_default()
                    .push(tag_name.to_string());
            }
        }
    }

    // Also add explicit HEAD if detached?
    // HEAD usually points to a branch, so it's covered.
    // If detached, HEAD points to a commit. We might want to label it "HEAD".
    if let Ok(head) = repo.head() {
        if !head.is_branch() {
            if let Some(target) = head.target() {
                refs_map.entry(target).or_default().push("HEAD".to_string());
            }
        }
    }

    let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;

    if all {
        revwalk
            .push_glob("refs/heads/*")
            .map_err(|e| e.to_string())?;
        // Also push tags to make sure they are included?
        // revwalk.push_glob("refs/tags/*").ok();
        // If we want graph to show all tags even if not on main branches:
        let _ = revwalk.push_glob("refs/tags/*");
        let _ = revwalk.push_head();
    } else {
        revwalk.push_head().map_err(|e| e.to_string())?;
    }

    revwalk
        .set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();

    for oid in revwalk.take(limit) {
        let oid = oid.map_err(|e| e.to_string())?;
        let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;

        let short_id = commit
            .as_object()
            .short_id()
            .map(|s| s.as_str().unwrap_or("").to_string())
            .unwrap_or_else(|_| oid.to_string()[..7].to_string());

        let parent_ids: Vec<String> = commit.parent_ids().map(|id| id.to_string()).collect();

        let commit_refs = refs_map.get(&oid).cloned().unwrap_or_default();

        result.push(GitCommitInfo {
            id: oid.to_string(),
            short_id,
            message: commit.message().unwrap_or("").to_string(),
            author_name: commit.author().name().unwrap_or("Unknown").to_string(),
            author_email: commit.author().email().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
            parent_ids,
            refs: commit_refs,
        });
    }

    Ok(result)
}

/// Get diff for a file (unstaged changes)
pub fn get_file_diff(repo_path: &str, file_path: &str) -> Result<String, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    let mut diff_opts = DiffOptions::new();
    diff_opts.pathspec(file_path);

    // Get diff between index and workdir
    let diff = repo
        .diff_index_to_workdir(None, Some(&mut diff_opts))
        .map_err(|e| e.to_string())?;

    let mut diff_text = String::new();

    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        let prefix = match line.origin() {
            '+' => "+",
            '-' => "-",
            ' ' => " ",
            _ => "",
        };

        if let Ok(content) = std::str::from_utf8(line.content()) {
            diff_text.push_str(prefix);
            diff_text.push_str(content);
        }
        true
    })
    .map_err(|e| e.to_string())?;

    Ok(diff_text)
}

/// Get file content at a specific commit
pub fn get_file_at_commit(
    repo_path: &str,
    commit_id: &str,
    file_path: &str,
) -> Result<String, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    let oid = Oid::from_str(commit_id).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;
    let tree = commit.tree().map_err(|e| e.to_string())?;

    let entry = tree
        .get_path(Path::new(file_path))
        .map_err(|e| e.to_string())?;

    let blob = entry
        .to_object(&repo)
        .map_err(|e| e.to_string())?
        .peel_to_blob()
        .map_err(|e| e.to_string())?;

    let content = std::str::from_utf8(blob.content())
        .map_err(|e| e.to_string())?
        .to_string();

    Ok(content)
}

/// Discard changes in a file (restore to HEAD)
pub fn discard_changes(repo_path: &str, file_path: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    let mut checkout_builder = git2::build::CheckoutBuilder::new();
    checkout_builder.force();
    checkout_builder.path(file_path);

    let head = repo.head().map_err(|e| e.to_string())?;
    let head_commit = head.peel_to_commit().map_err(|e| e.to_string())?;
    let head_tree = head_commit.tree().map_err(|e| e.to_string())?;

    repo.checkout_tree(head_tree.as_object(), Some(&mut checkout_builder))
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Initialize a new Git repository
pub fn init_repo(path: &str) -> Result<GitRepoInfo, String> {
    let repo = Repository::init(path).map_err(|e| e.to_string())?;

    let repo_path = repo
        .workdir()
        .unwrap_or(repo.path())
        .to_string_lossy()
        .to_string();

    Ok(GitRepoInfo {
        path: repo_path,
        branch: Some("main".to_string()),
        remote_url: None,
        is_dirty: false,
        head_commit: None,
    })
}

/// Get HEAD content for a file (for diff comparison)
pub fn get_head_file_content(repo_path: &str, file_path: &str) -> Result<String, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    // Handle unborn branch (new repo with no commits)
    let head = match repo.head() {
        Ok(h) => h,
        Err(e) => {
            // Check if this is an unborn branch (no commits yet)
            if e.code() == git2::ErrorCode::UnbornBranch {
                return Ok(String::new());
            }
            return Err(e.to_string());
        }
    };

    let head_commit = match head.peel_to_commit() {
        Ok(c) => c,
        Err(_) => return Ok(String::new()), // No commit yet
    };

    let tree = head_commit.tree().map_err(|e| e.to_string())?;

    let entry = match tree.get_path(Path::new(file_path)) {
        Ok(e) => e,
        Err(_) => return Ok(String::new()), // File doesn't exist in HEAD (new file)
    };

    let blob = entry
        .to_object(&repo)
        .map_err(|e| e.to_string())?
        .peel_to_blob()
        .map_err(|e| e.to_string())?;

    let content = std::str::from_utf8(blob.content())
        .map_err(|e| e.to_string())?
        .to_string();

    Ok(content)
}

/// Structured diff line for frontend rendering
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DiffLine {
    pub line_type: String, // "context", "add", "delete", "header"
    pub old_line_no: Option<u32>,
    pub new_line_no: Option<u32>,
    pub content: String,
}

/// Structured diff result
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StructuredDiff {
    pub file_path: String,
    pub old_content: String,
    pub new_content: String,
    pub lines: Vec<DiffLine>,
    pub stats: DiffStats,
}

/// Diff statistics
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DiffStats {
    pub additions: u32,
    pub deletions: u32,
}

/// Get structured diff for a file (for VSCode-style diff viewer)
pub fn get_structured_diff(repo_path: &str, file_path: &str) -> Result<StructuredDiff, String> {
    let full_path = Path::new(repo_path).join(file_path);

    // Get current file content
    let new_content =
        std::fs::read_to_string(&full_path).map_err(|e| format!("Failed to read file: {}", e))?;

    // Get HEAD content (empty for new repos/new files)
    let old_content = get_head_file_content(repo_path, file_path)?;

    // Use similar crate for reliable diff generation
    use similar::{ChangeTag, TextDiff};

    let diff = TextDiff::from_lines(&old_content, &new_content);

    let mut lines: Vec<DiffLine> = Vec::new();
    let mut additions: u32 = 0;
    let mut deletions: u32 = 0;
    let mut old_line: u32 = 0;
    let mut new_line: u32 = 0;

    for change in diff.iter_all_changes() {
        let (line_type, old_no, new_no) = match change.tag() {
            ChangeTag::Delete => {
                deletions += 1;
                old_line += 1;
                ("delete", Some(old_line), None)
            }
            ChangeTag::Insert => {
                additions += 1;
                new_line += 1;
                ("add", None, Some(new_line))
            }
            ChangeTag::Equal => {
                old_line += 1;
                new_line += 1;
                ("context", Some(old_line), Some(new_line))
            }
        };

        lines.push(DiffLine {
            line_type: line_type.to_string(),
            old_line_no: old_no,
            new_line_no: new_no,
            content: change.value().trim_end_matches('\n').to_string(),
        });
    }

    Ok(StructuredDiff {
        file_path: file_path.to_string(),
        old_content,
        new_content,
        lines,
        stats: DiffStats {
            additions,
            deletions,
        },
    })
}

/// Branch information
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_head: bool,
    pub is_remote: bool,
}

/// List all branches
pub fn list_branches(repo_path: &str) -> Result<Vec<BranchInfo>, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    // Using None for branch type to get both local and remote
    let branches = repo.branches(None).map_err(|e| e.to_string())?;
    let mut result = Vec::new(); // Explicit type annotation logic might be needed if compiler complains, but Vec::new() usually fine if pushed

    for branch_result in branches {
        let (branch, branch_type) = branch_result.map_err(|e| e.to_string())?;

        let name = branch
            .name()
            .map_err(|e| e.to_string())?
            .unwrap_or("")
            .to_string();

        if name.is_empty() {
            continue;
        }

        let is_head = branch.is_head();
        // Check if it is remote based on branch_type
        let is_remote = matches!(branch_type, git2::BranchType::Remote);

        result.push(BranchInfo {
            name,
            is_head,
            is_remote,
        });
    }

    // Sort: HEAD first, then Local alphabetically, then Remote alphabetically
    result.sort_by(|a, b| {
        if a.is_head {
            return std::cmp::Ordering::Less;
        }
        if b.is_head {
            return std::cmp::Ordering::Greater;
        }

        if a.is_remote != b.is_remote {
            // Local before remote
            return a.is_remote.cmp(&b.is_remote);
        }

        a.name.cmp(&b.name)
    });

    Ok(result)
}

/// Create a new branch
pub fn create_branch(repo_path: &str, name: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    let head = repo.head().map_err(|e| e.to_string())?;
    let commit = head.peel_to_commit().map_err(|e| e.to_string())?;

    repo.branch(name, &commit, false)
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Switch branch (checkout)
pub fn switch_branch(repo_path: &str, name: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    // Logic for switching differs if it's a local branch or remote tracking branch
    // For simplicity, assuming local branch name or full ref name

    // If name doesn't start with refs/, try to look up "refs/heads/<name>"
    let ref_name = if name.starts_with("refs/") {
        name.to_string()
    } else {
        format!("refs/heads/{}", name)
    };

    // set HEAD
    repo.set_head(&ref_name).map_err(|e| e.to_string())?;

    // checkout HEAD to update working directory
    // Strategy: Safe - don't overwrite dirty files
    let mut checkout_builder = git2::build::CheckoutBuilder::new();
    checkout_builder.safe();

    repo.checkout_head(Some(&mut checkout_builder))
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Delete branch
pub fn delete_branch(repo_path: &str, name: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    let mut branch = repo
        .find_branch(name, git2::BranchType::Local)
        .map_err(|e| e.to_string())?;

    branch.delete().map_err(|e| e.to_string())?;

    Ok(())
}

/// Guard operations that update HEAD and the working tree.  The previous
/// implementation used a forced checkout after moving a branch reference,
/// which could silently overwrite staged, unstaged, or untracked files.
fn ensure_clean_worktree(repo: &Repository) -> Result<(), String> {
    if repo.state() != git2::RepositoryState::Clean {
        return Err(format!(
            "Repository has an unfinished {:?} operation. Finish or abort it before merging or pulling.",
            repo.state()
        ));
    }

    let mut options = StatusOptions::new();
    options
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);

    let statuses = repo
        .statuses(Some(&mut options))
        .map_err(|e| format!("Failed to inspect working tree: {e}"))?;

    if !statuses.is_empty() {
        return Err(
            "Working tree has local changes. Commit or stash them before merging or pulling."
                .to_string(),
        );
    }

    Ok(())
}

/// Move the checked-out branch to `target` without using a forced checkout.
/// The safe checkout runs before the branch reference moves; if updating that
/// reference then fails, the original tree is restored.
fn fast_forward_checked_out_branch(
    repo: &Repository,
    ref_name: &str,
    target: Oid,
) -> Result<(), String> {
    ensure_clean_worktree(repo)?;

    let head = repo.find_reference("HEAD").map_err(|e| e.to_string())?;
    if head.symbolic_target() != Some(ref_name) {
        return Err(format!(
            "Branch reference '{ref_name}' is not the currently checked-out branch"
        ));
    }

    let mut reference = repo.find_reference(ref_name).map_err(|e| e.to_string())?;
    let original_target = reference
        .target()
        .ok_or_else(|| format!("Branch reference '{ref_name}' has no direct target"))?;
    let target_commit = repo.find_commit(target).map_err(|e| e.to_string())?;
    let target_tree = target_commit.tree().map_err(|e| e.to_string())?;

    // Checkout while HEAD still identifies the old commit, so libgit2 can
    // distinguish the clean old worktree from uncommitted user changes.
    let mut checkout = git2::build::CheckoutBuilder::new();
    checkout.safe();
    repo.checkout_tree(target_tree.as_object(), Some(&mut checkout))
        .map_err(|e| format!("Fast-forward checkout failed: {e}"))?;

    if let Err(reference_error) = reference.set_target(target, "Fast-forward") {
        let rollback_result = repo
            .find_commit(original_target)
            .and_then(|commit| commit.tree())
            .and_then(|tree| {
                let mut rollback_checkout = git2::build::CheckoutBuilder::new();
                rollback_checkout.safe();
                repo.checkout_tree(tree.as_object(), Some(&mut rollback_checkout))
            });

        return match rollback_result {
            Ok(()) => Err(format!(
                "Fast-forward reference update failed; the checkout was restored: {reference_error}"
            )),
            Err(rollback_error) => Err(format!(
                "Fast-forward reference update failed ({reference_error}) and the checkout could not be restored ({rollback_error})"
            )),
        };
    }

    Ok(())
}

/// Merge a branch into the current HEAD
pub fn merge_branch(repo_path: &str, branch_name: &str) -> Result<String, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    ensure_clean_worktree(&repo)?;

    // 1. Resolve the branch to commit
    let (object, reference) = repo
        .revparse_ext(branch_name)
        .map_err(|e| format!("Branch not found: {}", e))?;

    let annotated_commit = match reference {
        Some(reference) => repo
            .reference_to_annotated_commit(&reference)
            .map_err(|e| e.to_string())?,
        None => repo
            .find_annotated_commit(object.id())
            .map_err(|e| e.to_string())?,
    };

    // 2. Analyze merge possibility
    let analysis = repo
        .merge_analysis(&[&annotated_commit])
        .map_err(|e| e.to_string())?;

    if analysis.0.is_fast_forward() {
        let head = repo.find_reference("HEAD").map_err(|e| e.to_string())?;
        let ref_target = head
            .symbolic_target()
            .ok_or_else(|| "Cannot fast-forward a detached HEAD".to_string())?;

        fast_forward_checked_out_branch(&repo, ref_target, annotated_commit.id())?;

        return Ok("Fast-forward merge successful".to_string());
    }

    if analysis.0.is_normal() {
        // Normal merge
        repo.merge(&[&annotated_commit], None, None)
            .map_err(|e| e.to_string())?;

        // Check for conflicts
        if repo.index().map_err(|e| e.to_string())?.has_conflicts() {
            return Ok("Merge result: Conflicts detected. Please resolve them.".to_string());
        }

        // Auto-commit if clean
        let mut index = repo.index().map_err(|e| e.to_string())?;
        if !index.has_conflicts() {
            let sig = repo
                .signature()
                .unwrap_or_else(|_| Signature::now("DataTeX", "user@datatex.local").unwrap());
            let head_commit = repo
                .head()
                .map_err(|e| e.to_string())?
                .peel_to_commit()
                .map_err(|e| e.to_string())?;
            let tree_id = index.write_tree().map_err(|e| e.to_string())?;
            let tree = repo.find_tree(tree_id).map_err(|e| e.to_string())?;
            let commit_msg = format!("Merge branch '{}' into HEAD", branch_name);
            let other_commit = repo
                .find_commit(annotated_commit.id())
                .map_err(|e| e.to_string())?;

            repo.commit(
                Some("HEAD"),
                &sig,
                &sig,
                &commit_msg,
                &tree,
                &[&head_commit, &other_commit],
            )
            .map_err(|e| e.to_string())?;

            repo.cleanup_state().map_err(|e| e.to_string())?;

            return Ok("Merge successful".to_string());
        } else {
            return Ok("Merge resulted in conflicts. Please resolve and commit.".to_string());
        }
    }

    if analysis.0.is_up_to_date() {
        return Ok("Already up to date.".to_string());
    }

    Err("Merge analysis failed or unsupported merge type".to_string())
}

/// Rename a branch
pub fn rename_branch(repo_path: &str, old_name: &str, new_name: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    let mut branch = repo
        .find_branch(old_name, git2::BranchType::Local)
        .map_err(|_| format!("Branch {} not found", old_name))?;

    branch
        .rename(new_name, false)
        .map_err(|e| format!("Failed to rename: {}", e))?;

    Ok(())
}

/// Remote Info
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RemoteInfo {
    pub name: String,
    pub url: String,
}

/// List remotes
pub fn list_remotes(repo_path: &str) -> Result<Vec<RemoteInfo>, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;
    let remotes = repo.remotes().map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for name in remotes.iter().flatten() {
        let remote = repo.find_remote(name).map_err(|e| e.to_string())?;
        let url = remote.url().unwrap_or("").to_string();
        result.push(RemoteInfo {
            name: name.to_string(),
            url,
        });
    }

    Ok(result)
}

/// Helper to create callbacks with credentials
fn create_callbacks<'a>() -> RemoteCallbacks<'a> {
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(|_url, username_from_url, allowed_types| {
        if allowed_types.contains(git2::CredentialType::SSH_KEY) {
            // Try ssh-agent
            if let Ok(cred) = Cred::ssh_key_from_agent(username_from_url.unwrap_or("git")) {
                return Ok(cred);
            }
        }
        if allowed_types.contains(git2::CredentialType::USER_PASS_PLAINTEXT) {
            if let Ok(cred) = Cred::credential_helper(
                &git2::Config::open_default().unwrap(),
                _url,
                username_from_url,
            ) {
                return Ok(cred);
            }
        }

        // Fallback to default (might fail if auth required and no agent/helper)
        Cred::default()
    });
    callbacks
}

/// Fetch from remote
pub fn fetch_remote(repo_path: &str, remote_name: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;
    let mut remote = repo.find_remote(remote_name).map_err(|e| e.to_string())?;

    let callbacks = create_callbacks();
    let mut fo = FetchOptions::new();
    fo.remote_callbacks(callbacks);

    // Always fetch all tags and update refs
    remote
        .fetch(&[] as &[&str], Some(&mut fo), None)
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Push to remote
pub fn push_to_remote(repo_path: &str, remote_name: &str, branch_name: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;
    let mut remote = repo.find_remote(remote_name).map_err(|e| e.to_string())?;

    let callbacks = create_callbacks();
    let mut po = PushOptions::new();
    po.remote_callbacks(callbacks);

    // Refspec: refs/heads/branch:refs/heads/branch
    let refspec = format!("refs/heads/{}:refs/heads/{}", branch_name, branch_name);

    remote
        .push(&[&refspec], Some(&mut po))
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Pull from remote (Fetch + Merge)
pub fn pull_from_remote(
    repo_path: &str,
    remote_name: &str,
    branch_name: &str,
) -> Result<(), String> {
    let ref_name = format!("refs/heads/{branch_name}");

    // Pull updates the currently checked-out branch only.  Validate this and
    // the working tree before the network operation, then check cleanliness
    // again immediately before checkout to cover edits made while fetching.
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;
    let head = repo.find_reference("HEAD").map_err(|e| e.to_string())?;
    let current_ref = head
        .symbolic_target()
        .ok_or_else(|| "Cannot pull while HEAD is detached".to_string())?;

    if current_ref != ref_name {
        return Err(format!(
            "Cannot pull branch '{branch_name}' while '{current_ref}' is checked out"
        ));
    }

    ensure_clean_worktree(&repo)?;
    drop(head);
    drop(repo);

    // 1. Fetch
    fetch_remote(repo_path, remote_name)?;

    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    // 2. Prepare for merge
    let remote_ref_name = format!("refs/remotes/{remote_name}/{branch_name}");
    let fetch_head = repo
        .find_reference(&remote_ref_name)
        .map_err(|e| format!("Fetched branch '{remote_name}/{branch_name}' was not found: {e}"))?;
    let fetch_commit = repo
        .reference_to_annotated_commit(&fetch_head)
        .map_err(|e| e.to_string())?;

    let analysis = repo
        .merge_analysis(&[&fetch_commit])
        .map_err(|e| e.to_string())?;

    if analysis.0.is_up_to_date() {
        return Ok(());
    }

    // libgit2 may report NORMAL together with FASTFORWARD.  Prefer the safe
    // fast-forward path whenever that flag is available.
    if analysis.0.is_fast_forward() {
        ensure_clean_worktree(&repo)?;
        return fast_forward_checked_out_branch(&repo, &ref_name, fetch_commit.id());
    }

    if analysis.0.is_normal() {
        // This command intentionally supports fast-forward pulls only.  Reject
        // a divergent history before calling `repo.merge`, because that call
        // mutates the index and working tree even if we subsequently return an
        // "unsupported" error.
        return Err("Only fast-forward pull is supported currently.".to_string());
    }

    Err("Pull cannot be completed with a fast-forward update.".to_string())
}

/// Read .gitignore content
pub fn read_gitignore(repo_path: &str) -> Result<String, String> {
    let gitignore_path = Path::new(repo_path).join(".gitignore");

    if !gitignore_path.exists() {
        return Ok(String::new());
    }

    std::fs::read_to_string(gitignore_path).map_err(|e| e.to_string())
}

/// Write .gitignore content
pub fn write_gitignore(repo_path: &str, content: &str) -> Result<(), String> {
    let gitignore_path = Path::new(repo_path).join(".gitignore");

    std::fs::write(gitignore_path, content).map_err(|e| e.to_string())
}

// ============================================================================
// Stash Support
// ============================================================================

/// Stash entry information
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StashInfo {
    pub index: usize,
    pub message: String,
    pub commit_id: String,
}

/// List all stashes
pub fn list_stashes(repo_path: &str) -> Result<Vec<StashInfo>, String> {
    let mut repo = Repository::open(repo_path).map_err(|e| e.to_string())?;
    let mut stashes = Vec::new();

    repo.stash_foreach(|index, message, oid| {
        stashes.push(StashInfo {
            index,
            message: message.to_string(),
            commit_id: oid.to_string(),
        });
        true // continue iteration
    })
    .map_err(|e| e.to_string())?;

    Ok(stashes)
}

/// Create a new stash
pub fn create_stash(repo_path: &str, message: Option<&str>) -> Result<Oid, String> {
    let mut repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    let sig = repo
        .signature()
        .unwrap_or_else(|_| Signature::now("DataTeX User", "user@datatex.local").unwrap());

    let oid = repo
        .stash_save(&sig, message.unwrap_or("WIP on stash"), None)
        .map_err(|e| e.to_string())?;

    Ok(oid)
}

/// Apply a stash by index (keeps stash in list)
pub fn apply_stash(repo_path: &str, index: usize) -> Result<(), String> {
    let mut repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    repo.stash_apply(index, None).map_err(|e| e.to_string())
}

/// Drop a stash by index
pub fn drop_stash(repo_path: &str, index: usize) -> Result<(), String> {
    let mut repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    repo.stash_drop(index).map_err(|e| e.to_string())
}

/// Pop a stash (apply + drop)
pub fn pop_stash(repo_path: &str, index: usize) -> Result<(), String> {
    let mut repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    repo.stash_pop(index, None).map_err(|e| e.to_string())
}

// ============================================================================
// Commit Amend
// ============================================================================

/// Get the message of the last commit
pub fn get_last_commit_message(repo_path: &str) -> Result<String, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    let head = repo.head().map_err(|e| e.to_string())?;
    let commit = head.peel_to_commit().map_err(|e| e.to_string())?;

    Ok(commit.message().unwrap_or("").to_string())
}

/// Amend the last commit with new message
pub fn commit_amend(repo_path: &str, message: &str) -> Result<String, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    // Get HEAD commit
    let head = repo.head().map_err(|e| e.to_string())?;
    let commit = head.peel_to_commit().map_err(|e| e.to_string())?;

    // Get current index (staged changes)
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let tree_oid = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_oid).map_err(|e| e.to_string())?;

    // Keep original author, update committer
    let author = commit.author();
    let committer = repo
        .signature()
        .unwrap_or_else(|_| Signature::now("DataTeX User", "user@datatex.local").unwrap());

    // Amend: create new commit with same parents as old commit
    let new_oid = commit
        .amend(
            Some("HEAD"),
            Some(&author),
            Some(&committer),
            None, // encoding
            Some(message),
            Some(&tree),
        )
        .map_err(|e| e.to_string())?;

    Ok(new_oid.to_string())
}

/// Checkout a specific commit (detached HEAD)
pub fn checkout_commit(repo_path: &str, commit_id: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    let oid = Oid::from_str(commit_id).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;

    // Checkout the commit's tree
    let tree = commit.tree().map_err(|e| e.to_string())?;

    repo.checkout_tree(tree.as_object(), None)
        .map_err(|e| e.to_string())?;

    // Set HEAD to the commit (detached)
    repo.set_head_detached(oid).map_err(|e| e.to_string())?;

    Ok(())
}

/// Cherry-pick a commit onto current HEAD
pub fn cherry_pick(repo_path: &str, commit_id: &str) -> Result<String, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    let oid = Oid::from_str(commit_id).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;

    // Get current HEAD
    let head = repo.head().map_err(|e| e.to_string())?;
    let head_commit = head.peel_to_commit().map_err(|e| e.to_string())?;

    // Perform cherry-pick (creates an index with the changes)
    let mut index = repo
        .cherrypick_commit(&commit, &head_commit, 0, None)
        .map_err(|e| e.to_string())?;

    if index.has_conflicts() {
        return Err("Cherry-pick resulted in conflicts. Please resolve manually.".to_string());
    }

    // Write index to tree
    let tree_oid = index.write_tree_to(&repo).map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_oid).map_err(|e| e.to_string())?;

    // Create the new commit
    let sig = repo
        .signature()
        .unwrap_or_else(|_| Signature::now("DataTeX User", "user@datatex.local").unwrap());

    let new_commit_oid = repo
        .commit(
            Some("HEAD"),
            &commit.author(),
            &sig,
            commit.message().unwrap_or(""),
            &tree,
            &[&head_commit],
        )
        .map_err(|e| e.to_string())?;

    Ok(new_commit_oid.to_string())
}

/// Blame line information
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BlameInfo {
    pub line_number: usize,
    pub commit_id: String,
    pub short_id: String,
    pub author: String,
    pub timestamp: i64,
    pub line_content: String,
}

/// Get blame information for a file
pub fn git_blame(repo_path: &str, file_path: &str) -> Result<Vec<BlameInfo>, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    // Get the relative path
    let repo_root = repo.workdir().ok_or("No workdir")?;
    let abs_path = Path::new(file_path);
    let rel_path = if abs_path.is_absolute() {
        abs_path
            .strip_prefix(repo_root)
            .map_err(|_| "File not in repo")?
    } else {
        abs_path
    };

    let blame = repo.blame_file(rel_path, None).map_err(|e| e.to_string())?;

    // Read file content to get line content
    let full_path = repo_root.join(rel_path);
    let content = std::fs::read_to_string(&full_path).unwrap_or_default();
    let lines: Vec<&str> = content.lines().collect();

    let mut result = Vec::new();

    for hunk in blame.iter() {
        let sig = hunk.final_signature();
        let commit_id = hunk.final_commit_id();

        // Git blame hunks can span multiple lines
        let start_line = hunk.final_start_line();
        let num_lines = hunk.lines_in_hunk();

        for offset in 0..num_lines {
            let line_num = start_line + offset;
            let line_content = lines
                .get(line_num.saturating_sub(1))
                .unwrap_or(&"")
                .to_string();

            result.push(BlameInfo {
                line_number: line_num,
                commit_id: commit_id.to_string(),
                short_id: commit_id.to_string()[..7.min(commit_id.to_string().len())].to_string(),
                author: sig.name().unwrap_or("Unknown").to_string(),
                timestamp: sig.when().seconds(),
                line_content,
            });
        }
    }

    // Sort by line number
    result.sort_by_key(|b| b.line_number);

    Ok(result)
}

/// Tag information
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TagInfo {
    pub name: String,
    pub commit_id: String,
    pub message: Option<String>,
    pub tagger: Option<String>,
    pub timestamp: Option<i64>,
}

/// List all tags
pub fn list_tags(repo_path: &str) -> Result<Vec<TagInfo>, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;
    let mut tags = Vec::new();

    repo.tag_foreach(|oid, name_bytes| {
        let name = String::from_utf8_lossy(name_bytes)
            .trim_start_matches("refs/tags/")
            .to_string();

        // Try to get tag object (annotated tag) or commit (lightweight tag)
        if let Ok(obj) = repo.find_object(oid, None) {
            if let Some(tag) = obj.as_tag() {
                // Annotated tag
                tags.push(TagInfo {
                    name: name.clone(),
                    commit_id: tag.target_id().to_string(),
                    message: tag.message().map(|s| s.to_string()),
                    tagger: tag.tagger().and_then(|t| t.name().map(|n| n.to_string())),
                    timestamp: tag.tagger().map(|t| t.when().seconds()),
                });
            } else if let Ok(commit) = obj.peel_to_commit() {
                // Lightweight tag
                tags.push(TagInfo {
                    name: name.clone(),
                    commit_id: commit.id().to_string(),
                    message: None,
                    tagger: None,
                    timestamp: Some(commit.time().seconds()),
                });
            }
        }
        true // Continue iteration
    })
    .map_err(|e| e.to_string())?;

    // Sort by name
    tags.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(tags)
}

/// Create a new tag
pub fn create_tag(
    repo_path: &str,
    name: &str,
    commit_id: Option<&str>,
    message: Option<&str>,
) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    let target_commit = if let Some(id) = commit_id {
        let oid = Oid::from_str(id).map_err(|e| e.to_string())?;
        repo.find_commit(oid).map_err(|e| e.to_string())?
    } else {
        // Tag current HEAD
        let head = repo.head().map_err(|e| e.to_string())?;
        head.peel_to_commit().map_err(|e| e.to_string())?
    };

    if let Some(msg) = message {
        // Annotated tag
        let sig = repo
            .signature()
            .unwrap_or_else(|_| Signature::now("DataTeX User", "user@datatex.local").unwrap());
        repo.tag(name, target_commit.as_object(), &sig, msg, false)
            .map_err(|e| e.to_string())?;
    } else {
        // Lightweight tag
        repo.tag_lightweight(name, target_commit.as_object(), false)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Delete a tag
pub fn delete_tag(repo_path: &str, name: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;
    repo.tag_delete(name).map_err(|e| e.to_string())?;
    Ok(())
}

/// Revert a commit
pub fn revert_commit(repo_path: &str, commit_id: &str) -> Result<String, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;

    let oid = Oid::from_str(commit_id).map_err(|e| e.to_string())?;
    let commit = repo.find_commit(oid).map_err(|e| e.to_string())?;

    // Get current HEAD
    let head = repo.head().map_err(|e| e.to_string())?;
    let head_commit = head.peel_to_commit().map_err(|e| e.to_string())?;

    // Revert the commit
    let mut revert_index = repo
        .revert_commit(&commit, &head_commit, 0, None)
        .map_err(|e| e.to_string())?;

    if revert_index.has_conflicts() {
        return Err("Revert resulted in conflicts. Please resolve manually.".to_string());
    }

    // Write the index to a tree
    let tree_oid = revert_index
        .write_tree_to(&repo)
        .map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_oid).map_err(|e| e.to_string())?;

    // Create revert commit
    let sig = repo
        .signature()
        .unwrap_or_else(|_| Signature::now("DataTeX User", "user@datatex.local").unwrap());

    let revert_msg = format!(
        "Revert \"{}\"",
        commit.message().unwrap_or("").lines().next().unwrap_or("")
    );

    let new_oid = repo
        .commit(
            Some("HEAD"),
            &sig,
            &sig,
            &revert_msg,
            &tree,
            &[&head_commit],
        )
        .map_err(|e| e.to_string())?;

    Ok(new_oid.to_string())
}

// ============================================================================
// Conflict Detection
// ============================================================================

/// Check if there are merge conflicts in the repository
pub fn has_conflicts(repo_path: &str) -> Result<bool, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;
    let index = repo.index().map_err(|e| e.to_string())?;
    Ok(index.has_conflicts())
}

/// Conflict file info
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ConflictFile {
    pub path: String,
    pub ancestor_oid: Option<String>,
    pub our_oid: Option<String>,
    pub their_oid: Option<String>,
}

/// Get list of files with conflicts
pub fn get_conflict_files(repo_path: &str) -> Result<Vec<ConflictFile>, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;
    let index = repo.index().map_err(|e| e.to_string())?;

    let mut conflicts = Vec::new();

    if let Ok(conflict_iter) = index.conflicts() {
        for entry in conflict_iter.flatten() {
            let path = entry
                .ancestor
                .as_ref()
                .or(entry.our.as_ref())
                .or(entry.their.as_ref())
                .map(|e| String::from_utf8_lossy(&e.path).to_string())
                .unwrap_or_default();

            conflicts.push(ConflictFile {
                path,
                ancestor_oid: entry.ancestor.map(|e| e.id.to_string()),
                our_oid: entry.our.map(|e| e.id.to_string()),
                their_oid: entry.their.map(|e| e.id.to_string()),
            });
        }
    }

    Ok(conflicts)
}

/// Get content of a blob for conflict resolution
pub fn get_blob_content(repo_path: &str, blob_oid: &str) -> Result<String, String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;
    let oid = Oid::from_str(blob_oid).map_err(|e| e.to_string())?;
    let blob = repo.find_blob(oid).map_err(|e| e.to_string())?;

    let content = std::str::from_utf8(blob.content())
        .map_err(|_| "Binary file or invalid UTF-8")?
        .to_string();

    Ok(content)
}

/// Mark a conflict as resolved by staging the file
pub fn mark_conflict_resolved(repo_path: &str, file_path: &str) -> Result<(), String> {
    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;

    // Remove conflict entries and add the working directory version
    let rel_path = Path::new(file_path);
    index.add_path(rel_path).map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================================================
// Side-by-side Diff (Enhanced)
// ============================================================================

/// Side-by-side diff line
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SideBySideLine {
    pub left_line_num: Option<usize>,
    pub right_line_num: Option<usize>,
    pub left_content: String,
    pub right_content: String,
    pub change_type: String, // "unchanged", "added", "removed", "modified"
}

/// Generate side-by-side diff between two strings
pub fn generate_side_by_side_diff(old_content: &str, new_content: &str) -> Vec<SideBySideLine> {
    use similar::{ChangeTag, TextDiff};

    let diff = TextDiff::from_lines(old_content, new_content);
    let mut result = Vec::new();
    let mut left_num = 1usize;
    let mut right_num = 1usize;

    for change in diff.iter_all_changes() {
        match change.tag() {
            ChangeTag::Equal => {
                result.push(SideBySideLine {
                    left_line_num: Some(left_num),
                    right_line_num: Some(right_num),
                    left_content: change.value().trim_end().to_string(),
                    right_content: change.value().trim_end().to_string(),
                    change_type: "unchanged".to_string(),
                });
                left_num += 1;
                right_num += 1;
            }
            ChangeTag::Delete => {
                result.push(SideBySideLine {
                    left_line_num: Some(left_num),
                    right_line_num: None,
                    left_content: change.value().trim_end().to_string(),
                    right_content: String::new(),
                    change_type: "removed".to_string(),
                });
                left_num += 1;
            }
            ChangeTag::Insert => {
                result.push(SideBySideLine {
                    left_line_num: None,
                    right_line_num: Some(right_num),
                    left_content: String::new(),
                    right_content: change.value().trim_end().to_string(),
                    change_type: "added".to_string(),
                });
                right_num += 1;
            }
        }
    }

    result
}

/// Get side-by-side diff for a file against HEAD
pub fn get_side_by_side_diff(
    repo_path: &str,
    file_path: &str,
) -> Result<Vec<SideBySideLine>, String> {
    let old_content = get_head_file_content(repo_path, file_path).unwrap_or_default();

    let repo = Repository::open(repo_path).map_err(|e| e.to_string())?;
    let workdir = repo.workdir().ok_or("No workdir")?;
    let full_path = workdir.join(file_path);

    let new_content = std::fs::read_to_string(&full_path).map_err(|e| e.to_string())?;

    Ok(generate_side_by_side_diff(&old_content, &new_content))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::{Path, PathBuf};

    struct TestWorkspace {
        path: PathBuf,
    }

    impl TestWorkspace {
        fn new(name: &str) -> Self {
            let path =
                std::env::temp_dir().join(format!("datatex-git-{name}-{}", uuid::Uuid::new_v4()));
            fs::create_dir_all(&path).unwrap();
            Self { path }
        }
    }

    impl Drop for TestWorkspace {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    fn commit_file(repo: &Repository, path: &str, content: &str, message: &str) -> Oid {
        fs::write(repo.workdir().unwrap().join(path), content).unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(Path::new(path)).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let signature = Signature::now("DataTeX Test", "test@datatex.local").unwrap();
        let parent = repo.head().ok().and_then(|head| head.peel_to_commit().ok());

        match parent.as_ref() {
            Some(parent) => repo
                .commit(
                    Some("HEAD"),
                    &signature,
                    &signature,
                    message,
                    &tree,
                    &[parent],
                )
                .unwrap(),
            None => repo
                .commit(Some("HEAD"), &signature, &signature, message, &tree, &[])
                .unwrap(),
        }
    }

    fn current_branch(repo: &Repository) -> String {
        repo.head().unwrap().shorthand().unwrap().to_string()
    }

    #[test]
    fn fast_forward_merge_preserves_untracked_local_file() {
        let workspace = TestWorkspace::new("dirty-merge");
        let repo = Repository::init(&workspace.path).unwrap();
        let repo_path = workspace.path.to_str().unwrap();

        let base_id = commit_file(&repo, "base.tex", "base", "base");
        let base_branch = current_branch(&repo);
        let base_commit = repo.find_commit(base_id).unwrap();
        repo.branch("feature", &base_commit, false).unwrap();
        drop(base_commit);

        switch_branch(repo_path, "feature").unwrap();
        commit_file(&repo, "new.tex", "feature version", "feature");
        switch_branch(repo_path, &base_branch).unwrap();

        // This path is tracked by the fast-forward target but untracked on the
        // current branch.  A forced checkout would overwrite it.
        fs::write(workspace.path.join("new.tex"), "local version").unwrap();

        let head_before = repo.head().unwrap().target().unwrap();
        let error = merge_branch(repo_path, "feature").unwrap_err();

        assert!(error.contains("Working tree has local changes"));
        assert_eq!(repo.head().unwrap().target().unwrap(), head_before);
        assert_eq!(
            fs::read_to_string(workspace.path.join("new.tex")).unwrap(),
            "local version"
        );
    }

    #[test]
    fn non_fast_forward_pull_does_not_mutate_head_index_or_worktree() {
        let workspace = TestWorkspace::new("divergent-pull");
        let source_path = workspace.path.join("source");
        let local_path = workspace.path.join("local");
        let source = Repository::init(&source_path).unwrap();

        commit_file(&source, "document.tex", "base", "base");
        let branch = current_branch(&source);
        let local = Repository::clone(source_path.to_str().unwrap(), &local_path).unwrap();

        commit_file(&local, "document.tex", "local commit", "local");
        commit_file(&source, "document.tex", "remote commit", "remote");

        let local_path_str = local_path.to_str().unwrap();
        let head_before = local.head().unwrap().target().unwrap();
        let error = pull_from_remote(local_path_str, "origin", &branch).unwrap_err();

        assert!(error.contains("Only fast-forward pull is supported"));
        assert_eq!(local.head().unwrap().target().unwrap(), head_before);
        assert_eq!(
            fs::read_to_string(local_path.join("document.tex")).unwrap(),
            "local commit"
        );
        assert_eq!(local.state(), git2::RepositoryState::Clean);
        assert!(!local.index().unwrap().has_conflicts());
        assert!(local.statuses(None).unwrap().is_empty());
    }

    #[test]
    fn clean_fast_forward_pull_updates_branch_and_worktree() {
        let workspace = TestWorkspace::new("fast-forward-pull");
        let source_path = workspace.path.join("source");
        let local_path = workspace.path.join("local");
        let source = Repository::init(&source_path).unwrap();

        commit_file(&source, "document.tex", "base", "base");
        let branch = current_branch(&source);
        let local = Repository::clone(source_path.to_str().unwrap(), &local_path).unwrap();
        let remote_id = commit_file(&source, "document.tex", "remote commit", "remote");

        pull_from_remote(local_path.to_str().unwrap(), "origin", &branch).unwrap();

        assert_eq!(local.head().unwrap().target().unwrap(), remote_id);
        assert_eq!(
            fs::read_to_string(local_path.join("document.tex")).unwrap(),
            "remote commit"
        );
        assert!(local.statuses(None).unwrap().is_empty());
    }
}
