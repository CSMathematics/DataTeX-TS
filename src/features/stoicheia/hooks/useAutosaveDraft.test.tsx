import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTOSAVE_STORAGE_KEY } from '../files';
import { DEFAULT_APP_SETTINGS, useEditorStore } from '../store';
import { useAutosaveDraft } from './useAutosaveDraft';

function AutosaveHarness() {
  useAutosaveDraft();
  return null;
}

function DisabledAutosaveHarness() {
  useAutosaveDraft('autosave.tex', false);
  return null;
}

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

describe('useAutosaveDraft', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installLocalStorageMock();
    window.localStorage.clear();
    useEditorStore.setState({
      source: 'source A',
      documentFilename: 'source.tex',
      settings: { ...DEFAULT_APP_SETTINGS, autoSaveDraft: true },
      autosaveError: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('saves the latest source after the autosave debounce', async () => {
    render(<AutosaveHarness />);

    act(() => useEditorStore.getState().setSource('source B'));
    act(() => useEditorStore.getState().setSource('source C'));

    await act(async () => vi.advanceTimersByTimeAsync(899));
    expect(window.localStorage.getItem(AUTOSAVE_STORAGE_KEY)).toBeNull();

    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(JSON.parse(window.localStorage.getItem(AUTOSAVE_STORAGE_KEY) ?? '{}')).toMatchObject({
      source: 'source C',
      filename: 'source.tex',
    });
  });

  it('uses the latest document filename for the autosave draft', async () => {
    render(<AutosaveHarness />);

    act(() => useEditorStore.getState().setDocumentFilename('diagram.tex'));

    await act(async () => vi.advanceTimersByTimeAsync(900));
    expect(JSON.parse(window.localStorage.getItem(AUTOSAVE_STORAGE_KEY) ?? '{}')).toMatchObject({
      source: 'source A',
      filename: 'diagram.tex',
    });
  });

  it('cancels a pending autosave when autosave is disabled', async () => {
    render(<AutosaveHarness />);

    act(() => useEditorStore.getState().setSource('source B'));
    act(() => useEditorStore.getState().updateSettings({ autoSaveDraft: false }));

    await act(async () => vi.advanceTimersByTimeAsync(900));
    expect(window.localStorage.getItem(AUTOSAVE_STORAGE_KEY)).toBeNull();
  });

  it('does not schedule or subscribe to autosave in an embedded host', async () => {
    render(<DisabledAutosaveHarness />);

    act(() => useEditorStore.getState().setSource('source B'));
    await act(async () => vi.advanceTimersByTimeAsync(900));

    expect(window.localStorage.getItem(AUTOSAVE_STORAGE_KEY)).toBeNull();
  });

  it('records autosave storage failures in the editor store', async () => {
    window.localStorage.setItem = vi.fn(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });
    render(<AutosaveHarness />);

    act(() => useEditorStore.getState().setSource('source B'));
    await act(async () => vi.advanceTimersByTimeAsync(900));

    expect(useEditorStore.getState().autosaveError).toBe('Local storage quota exceeded');
  });
});
