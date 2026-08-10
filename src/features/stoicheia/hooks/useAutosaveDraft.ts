import { useEffect, useRef } from 'react';
import { saveAutosaveDraft } from '../files';
import { useEditorStore } from '../store';

const AUTOSAVE_DELAY_MS = 900;

export function useAutosaveDraft(filename = 'autosave.tex', enabled = true) {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      useEditorStore.getState().setAutosaveError(null);
      return;
    }

    const clearPendingSave = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const scheduleSave = (source: string, enabled: boolean, draftFilename: string) => {
      clearPendingSave();
      if (!enabled) {
        useEditorStore.getState().setAutosaveError(null);
        return;
      }
      timerRef.current = window.setTimeout(() => {
        const result = saveAutosaveDraft(source, draftFilename);
        useEditorStore.getState().setAutosaveError(result.ok ? null : result.message);
        timerRef.current = null;
      }, AUTOSAVE_DELAY_MS);
    };

    const initialState = useEditorStore.getState();
    scheduleSave(initialState.source, initialState.settings.autoSaveDraft, initialState.documentFilename || filename);

    const unsubscribe = useEditorStore.subscribe((state, previousState) => {
      const autoSaveDraft = state.settings.autoSaveDraft;
      if (
        state.source === previousState.source &&
        autoSaveDraft === previousState.settings.autoSaveDraft &&
        state.documentFilename === previousState.documentFilename
      ) {
        return;
      }
      scheduleSave(state.source, autoSaveDraft, state.documentFilename || filename);
    });

    return () => {
      unsubscribe();
      clearPendingSave();
    };
  }, [enabled, filename]);
}
