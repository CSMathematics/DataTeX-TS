import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAutosaveDraft, getAutosaveDraft, getRecentFiles, rememberRecentFile, removeRecentFile, saveAutosaveDraft, exportSvgFile, openTextFile, saveTextFile, WritableFileHandle } from './files';

const invokeMock = vi.hoisted(() => vi.fn());
const isTauriMock = vi.hoisted(() => vi.fn(() => false));
const saveDialogMock = vi.hoisted(() => vi.fn());
const openDialogMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
  isTauri: isTauriMock,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: openDialogMock,
  save: saveDialogMock,
}));

const installLocalStorageMock = () => {
  const values = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    },
  });
};

beforeEach(() => {
  installLocalStorageMock();
  invokeMock.mockReset();
  isTauriMock.mockReturnValue(false);
  saveDialogMock.mockReset();
  openDialogMock.mockReset();
});

afterEach(() => {
  delete window.showSaveFilePicker;
  delete window.showOpenFilePicker;
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('file operations', () => {
  it('writes to an existing file handle', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const handle: WritableFileHandle = {
      name: 'drawing.tex',
      createWritable: vi.fn().mockResolvedValue({ write, close }),
    };

    await expect(saveTextFile('source', 'source.tex', handle)).resolves.toBe(handle);
    expect(write).toHaveBeenCalledWith('source');
    expect(close).toHaveBeenCalledOnce();
  });

  it('asks for a destination when no handle exists', async () => {
    const handle: WritableFileHandle = {
      createWritable: vi.fn().mockResolvedValue({
        write: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      }),
    };
    window.showSaveFilePicker = vi.fn().mockResolvedValue(handle);

    await saveTextFile('source', 'source.tex');
    expect(window.showSaveFilePicker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: 'source.tex' }));
  });

  it('opens a text file through the browser file picker and keeps its handle', async () => {
    const file = new File(['opened source'], 'opened.tex', { type: 'application/x-tex' });
    const handle: WritableFileHandle = {
      name: 'opened.tex',
      getFile: vi.fn().mockResolvedValue(file),
      createWritable: vi.fn(),
    };
    window.showOpenFilePicker = vi.fn().mockResolvedValue([handle]);

    await expect(openTextFile()).resolves.toEqual({
      name: 'opened.tex',
      source: 'opened source',
      target: handle,
      id: 'opened.tex',
    });
  });

  it('opens a text file through the Tauri open dialog', async () => {
    isTauriMock.mockReturnValue(true);
    openDialogMock.mockResolvedValue('/tmp/opened.tex');
    invokeMock.mockResolvedValue('opened source');

    await expect(openTextFile()).resolves.toEqual({
      name: 'opened.tex',
      source: 'opened source',
      target: '/tmp/opened.tex',
      id: '/tmp/opened.tex',
    });
    expect(invokeMock).toHaveBeenCalledWith('read_text_file', { path: '/tmp/opened.tex' });
  });

  it('saves back to an existing Tauri path without asking again', async () => {
    isTauriMock.mockReturnValue(true);
    invokeMock.mockResolvedValue(undefined);

    await expect(saveTextFile('source', 'source.tex', '/tmp/opened.tex')).resolves.toBe('/tmp/opened.tex');

    expect(saveDialogMock).not.toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledWith('save_text_file', {
      path: '/tmp/opened.tex',
      contents: 'source',
    });
  });

  it('downloads SVG when exporting outside Tauri', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    await expect(exportSvgFile('<svg />')).resolves.toEqual({ status: 'downloaded' });
    expect(click).toHaveBeenCalledOnce();
  });

  it('exports SVG through the Tauri save dialog', async () => {
    isTauriMock.mockReturnValue(true);
    saveDialogMock.mockResolvedValue('/tmp/proof.svg');
    invokeMock.mockResolvedValue(undefined);

    await expect(exportSvgFile('<svg />', 'proof.svg')).resolves.toEqual({ status: 'saved', path: '/tmp/proof.svg' });

    expect(saveDialogMock).toHaveBeenCalledWith({
      title: 'Export SVG',
      defaultPath: 'proof.svg',
      filters: [{ name: 'SVG image', extensions: ['svg'] }],
    });
    expect(invokeMock).toHaveBeenCalledWith('save_text_file', {
      path: '/tmp/proof.svg',
      contents: '<svg />',
    });
  });

  it('reports cancelled SVG export when the Tauri dialog is dismissed', async () => {
    isTauriMock.mockReturnValue(true);
    saveDialogMock.mockResolvedValue(null);

    await expect(exportSvgFile('<svg />', 'proof.svg')).resolves.toEqual({ status: 'cancelled' });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('stores recent files and autosave drafts in local storage', () => {
    rememberRecentFile('first.tex', 'A');
    rememberRecentFile('second.tex', 'B');

    expect(getRecentFiles().map(file => file.name)).toEqual(['second.tex', 'first.tex']);

    removeRecentFile('second.tex');
    expect(getRecentFiles().map(file => file.name)).toEqual(['first.tex']);

    saveAutosaveDraft('draft source', 'draft.tex');
    expect(getAutosaveDraft()).toMatchObject({ source: 'draft source', filename: 'draft.tex' });

    clearAutosaveDraft();
    expect(getAutosaveDraft()).toBeNull();
  });

  it('reports autosave storage write failures', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });

    const result = saveAutosaveDraft('draft source', 'draft.tex');

    expect(result).toEqual({ ok: false, message: 'Local storage quota exceeded' });
    expect(getAutosaveDraft()).toBeNull();
  });
});
