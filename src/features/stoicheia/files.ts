import { invoke, isTauri } from '@tauri-apps/api/core';
import { open as showTauriOpenDialog, save as showTauriSaveDialog } from '@tauri-apps/plugin-dialog';

export interface WritableFileHandle {
  name?: string;
  getFile?: () => Promise<File>;
  createWritable: () => Promise<{
    write: (contents: string) => Promise<void>;
    close: () => Promise<void>;
  }>;
}

export type SaveTarget = WritableFileHandle | string | null;

export type ExportFileResult =
  | { status: 'saved'; path: string }
  | { status: 'downloaded' }
  | { status: 'cancelled' };

export interface OpenTextFileResult {
  name: string;
  source: string;
  target: SaveTarget;
  id: string;
}

export interface RecentFileSnapshot {
  id: string;
  name: string;
  source: string;
  updatedAt: number;
}

export interface AutosaveDraft {
  source: string;
  filename: string;
  updatedAt: number;
}

export type StorageWriteResult =
  | { ok: true }
  | { ok: false; message: string };

type SaveFilePicker = (options: {
  suggestedName: string;
  types: Array<{ description: string; accept: Record<string, string[]> }>;
}) => Promise<WritableFileHandle>;

type OpenFilePicker = (options: {
  multiple?: boolean;
  types: Array<{ description: string; accept: Record<string, string[]> }>;
}) => Promise<WritableFileHandle[]>;

declare global {
  interface Window {
    showSaveFilePicker?: SaveFilePicker;
    showOpenFilePicker?: OpenFilePicker;
  }
}

export const RECENT_FILES_STORAGE_KEY = 'stoicheia-recent-files';
export const AUTOSAVE_STORAGE_KEY = 'stoicheia-autosave-draft';
const RECENT_FILES_LIMIT = 6;
const latexFileTypes = [{ description: 'LaTeX document', accept: { 'application/x-tex': ['.tex'] } }];

const filenameFromPath = (path: string) => path.split(/[\\/]/).pop() || 'source.tex';

export const canUseNativeOpenTextFile = () => isTauri() || Boolean(window.showOpenFilePicker);

const downloadFile = (contents: string, filename: string, mimeType: string) => {
  const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export async function openTextFile(): Promise<OpenTextFileResult | null> {
  if (isTauri()) {
    const selected = await showTauriOpenDialog({
      title: 'Open LaTeX document',
      multiple: false,
      filters: [{ name: 'LaTeX document', extensions: ['tex'] }],
    });
    const path = Array.isArray(selected) ? selected[0] : selected;
    if (!path) return null;
    const source = await invoke<string>('read_text_file', { path });
    return { name: filenameFromPath(path), source, target: path, id: path };
  }

  if (!window.showOpenFilePicker) return null;
  const [handle] = await window.showOpenFilePicker({ multiple: false, types: latexFileTypes });
  if (!handle?.getFile) return null;
  const file = await handle.getFile();
  const name = file.name || handle.name || 'source.tex';
  return { name, source: await file.text(), target: handle, id: handle.name || name };
}

export async function saveTextFile(
  contents: string,
  suggestedName: string,
  existingTarget?: SaveTarget,
): Promise<SaveTarget> {
  if (isTauri()) {
    const path = typeof existingTarget === 'string'
      ? existingTarget
      : await showTauriSaveDialog({
        title: 'Save LaTeX document',
        defaultPath: suggestedName,
        filters: [{ name: 'LaTeX document', extensions: ['tex'] }],
      });

    if (!path) return null;
    await invoke('save_text_file', { path, contents });
    return path;
  }

  let handle = typeof existingTarget === 'object' ? existingTarget : null;

  if (!handle && window.showSaveFilePicker) {
    handle = await window.showSaveFilePicker({
      suggestedName,
      types: latexFileTypes,
    });
  }

  if (handle) {
    const writable = await handle.createWritable();
    await writable.write(contents);
    await writable.close();
    return handle;
  }

  downloadFile(contents, suggestedName, 'application/x-tex;charset=utf-8');
  return null;
}

export async function exportSvgFile(contents: string, filename = 'stoicheia.svg'): Promise<ExportFileResult> {
  if (isTauri()) {
    const path = await showTauriSaveDialog({
      title: 'Export SVG',
      defaultPath: filename,
      filters: [{ name: 'SVG image', extensions: ['svg'] }],
    });

    if (!path) return { status: 'cancelled' };
    await invoke('save_text_file', { path, contents });
    return { status: 'saved', path };
  }

  downloadFile(contents, filename, 'image/svg+xml;charset=utf-8');
  return { status: 'downloaded' };
}

const safeReadJson = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
};

const storageErrorMessage = (error: unknown) => {
  if (error instanceof DOMException && error.name === 'QuotaExceededError') {
    return 'Local storage quota exceeded';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Local storage is unavailable';
};

const safeWriteJson = (key: string, value: unknown): StorageWriteResult => {
  if (typeof window === 'undefined') return { ok: true };
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: storageErrorMessage(error) };
  }
};

const normalizeRecentFile = (snapshot: Partial<RecentFileSnapshot>): RecentFileSnapshot | null => {
  if (typeof snapshot.source !== 'string') return null;
  const name = typeof snapshot.name === 'string' && snapshot.name.trim() ? snapshot.name.trim() : 'source.tex';
  return {
    id: typeof snapshot.id === 'string' && snapshot.id ? snapshot.id : name,
    name,
    source: snapshot.source,
    updatedAt: typeof snapshot.updatedAt === 'number' ? snapshot.updatedAt : Date.now(),
  };
};

export function getRecentFiles(): RecentFileSnapshot[] {
  const raw = safeReadJson<Array<Partial<RecentFileSnapshot>>>(RECENT_FILES_STORAGE_KEY, []);
  return raw
    .map(normalizeRecentFile)
    .filter((snapshot): snapshot is RecentFileSnapshot => Boolean(snapshot))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, RECENT_FILES_LIMIT);
}

export function rememberRecentFile(name: string, source: string, id = name) {
  const nextSnapshot = normalizeRecentFile({ id, name, source, updatedAt: Date.now() });
  if (!nextSnapshot) return { ok: true } as StorageWriteResult;
  const retained = getRecentFiles().filter(snapshot => snapshot.id !== nextSnapshot.id && snapshot.name !== nextSnapshot.name);
  return safeWriteJson(RECENT_FILES_STORAGE_KEY, [nextSnapshot, ...retained].slice(0, RECENT_FILES_LIMIT));
}

export function removeRecentFile(id: string) {
  return safeWriteJson(RECENT_FILES_STORAGE_KEY, getRecentFiles().filter(snapshot => snapshot.id !== id));
}

export function getAutosaveDraft(): AutosaveDraft | null {
  const draft = safeReadJson<Partial<AutosaveDraft> | null>(AUTOSAVE_STORAGE_KEY, null);
  if (!draft || typeof draft.source !== 'string') return null;
  return {
    source: draft.source,
    filename: typeof draft.filename === 'string' && draft.filename.trim() ? draft.filename : 'autosave.tex',
    updatedAt: typeof draft.updatedAt === 'number' ? draft.updatedAt : Date.now(),
  };
}

export function saveAutosaveDraft(source: string, filename: string) {
  return safeWriteJson(AUTOSAVE_STORAGE_KEY, { source, filename: filename || 'source.tex', updatedAt: Date.now() });
}

export function clearAutosaveDraft() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
  } catch {
    // No-op.
  }
}
