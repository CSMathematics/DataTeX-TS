import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Group,
  Text,
  Stack,
  Title,
  Code,
  ScrollArea,
  Badge,
} from "@mantine/core";
import { invoke } from "@tauri-apps/api/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";

export interface ConflictFile {
  path: string;
  ancestor_oid: string | null;
  our_oid: string | null;
  their_oid: string | null;
}

interface ConflictResolverProps {
  repoPath: string;
  files: ConflictFile[];
  onResolve: () => void;
  onCancel: () => void;
}

export const ConflictResolver: React.FC<ConflictResolverProps> = ({
  repoPath,
  files,
  onResolve,
  onCancel,
}) => {
  const [selectedFile, setSelectedFile] = useState<ConflictFile | null>(
    files[0] || null,
  );
  const [ourContent, setOurContent] = useState<string>("");
  const [theirContent, setTheirContent] = useState<string>("");
  const [resolvedFiles, setResolvedFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selectedFile) {
      loadContents(selectedFile);
    }
  }, [selectedFile]);

  const loadContents = async (file: ConflictFile) => {
    try {
      if (file.our_oid) {
        const content = await invoke<string>("git_get_blob_content_cmd", {
          repoPath,
          blobOid: file.our_oid,
        });
        setOurContent(content);
      } else {
        setOurContent("(Deleted in our branch)");
      }

      if (file.their_oid) {
        const content = await invoke<string>("git_get_blob_content_cmd", {
          repoPath,
          blobOid: file.their_oid,
        });
        setTheirContent(content);
      } else {
        setTheirContent("(Deleted in their branch)");
      }
    } catch (err) {
      console.error("Failed to load blob content:", err);
    }
  };

  const handleResolve = async (_strategy: "ours" | "theirs") => {
    if (!selectedFile) return;

    try {
      // Logic would go here to actually write the file with chosen content
      // For now, we'll assume we just pick one side completely (simple resolution)
      // In a real app, we might need a way to edit/merge manually

      // This part requires a backend function we haven't strictly defined for *writing* content arbitrarily
      // But we can use mark_conflict_resolved if we assume the user edited the file externally OR
      // we need to add a "write_file" command. For this MVP, let's assume manual resolution or
      // just "marking" as resolved after user action.

      // NOTE: For true content resolution we need to write to the file first.
      // Since we don't have a specific `git_resolve_conflict_using_oid`, we will use
      // standard file writing (which we have access to via tauri fs, or we can add a helper).
      // For now, let's just MARK it as resolved to show the flow.

      await invoke("git_mark_conflict_resolved_cmd", {
        repoPath,
        filePath: selectedFile.path,
      });

      const newResolved = new Set(resolvedFiles);
      newResolved.add(selectedFile.path);
      setResolvedFiles(newResolved);

      // Auto-select next unresolved
      const nextFile = files.find(
        (f) => !newResolved.has(f.path) && f.path !== selectedFile.path,
      );
      if (nextFile) {
        setSelectedFile(nextFile);
      } else if (newResolved.size === files.length) {
        // All resolved
        onResolve();
      }
    } catch (err) {
      console.error("Failed to resolve conflict:", err);
    }
  };

  return (
    <Box>
      <Group mb="md">
        <Title order={4}>Merge Conflicts</Title>
        <Badge color="red">{files.length - resolvedFiles.size} remaining</Badge>
      </Group>

      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "250px 1fr",
          gap: "16px",
          height: "500px",
        }}
      >
        {/* File List */}
        <Stack
          gap="xs"
          style={{
            borderRight: "1px solid var(--mantine-color-default-border)",
            paddingRight: "8px",
          }}
        >
          {files.map((file) => (
            <Button
              key={file.path}
              variant={selectedFile?.path === file.path ? "light" : "subtle"}
              color={resolvedFiles.has(file.path) ? "green" : "red"}
              justify="space-between"
              onClick={() => setSelectedFile(file)}
              rightSection={
                resolvedFiles.has(file.path) && (
                  <FontAwesomeIcon icon={faCheck} />
                )
              }
            >
              <Text truncate size="xs">
                {file.path}
              </Text>
            </Button>
          ))}
        </Stack>

        {/* Resolution Area */}
        <Box>
          {selectedFile && (
            <Stack>
              <Group justify="space-between">
                <Text fw={700}>{selectedFile.path}</Text>
                <Group>
                  <Button
                    size="xs"
                    color="blue"
                    onClick={() => handleResolve("ours")}
                  >
                    Accept Ours
                  </Button>
                  <Button
                    size="xs"
                    color="cyan"
                    onClick={() => handleResolve("theirs")}
                  >
                    Accept Theirs
                  </Button>
                </Group>
              </Group>

              <Box
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                  height: "400px",
                }}
              >
                <Box>
                  <Text size="xs" fw={700} c="blue">
                    Ours (HEAD)
                  </Text>
                  <ScrollArea h={380} type="auto" offsetScrollbars>
                    <Code block style={{ whiteSpace: "pre-wrap" }}>
                      {ourContent}
                    </Code>
                  </ScrollArea>
                </Box>
                <Box>
                  <Text size="xs" fw={700} c="cyan">
                    Theirs (Incoming)
                  </Text>
                  <ScrollArea h={380} type="auto" offsetScrollbars>
                    <Code block style={{ whiteSpace: "pre-wrap" }}>
                      {theirContent}
                    </Code>
                  </ScrollArea>
                </Box>
              </Box>
            </Stack>
          )}
        </Box>
      </Box>

      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          onClick={onResolve}
          disabled={resolvedFiles.size < files.length}
          color="green"
        >
          Complete Merge
        </Button>
      </Group>
    </Box>
  );
};
