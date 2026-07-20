import { create } from "zustand";

export const ALL_BIBLIOGRAPHY_ENTRY_TYPES = "__all__";

export type BibliographySmartView =
  | "all"
  | "missing_metadata"
  | "with_doi"
  | "without_doi"
  | "duplicate_candidates";

interface BibliographyWorkspaceState {
  selectedSourceId: string | null;
  entryType: string;
  smartView: BibliographySmartView;
  selectedTag: string | null;
  query: string;
  refreshRevision: number;
  setSelectedSourceId: (sourceId: string | null) => void;
  toggleSelectedSourceId: (sourceId: string) => void;
  setEntryType: (entryType: string) => void;
  setSmartView: (smartView: BibliographySmartView | string) => void;
  setSelectedTag: (tag: string | null) => void;
  setQuery: (query: string) => void;
  requestRefresh: () => void;
  clearFilters: () => void;
}

const normalizeSmartView = (value: BibliographySmartView | string) => {
  if (
    value === "missing_metadata" ||
    value === "with_doi" ||
    value === "without_doi" ||
    value === "duplicate_candidates"
  ) {
    return value;
  }

  return "all";
};

export const useBibliographyWorkspaceStore =
  create<BibliographyWorkspaceState>((set) => ({
    selectedSourceId: null,
    entryType: ALL_BIBLIOGRAPHY_ENTRY_TYPES,
    smartView: "all",
    selectedTag: null,
    query: "",
    refreshRevision: 0,
    setSelectedSourceId: (selectedSourceId) => set({ selectedSourceId }),
    toggleSelectedSourceId: (sourceId) =>
      set((state) => ({
        selectedSourceId:
          state.selectedSourceId === sourceId ? null : sourceId,
      })),
    setEntryType: (entryType) =>
      set({ entryType: entryType || ALL_BIBLIOGRAPHY_ENTRY_TYPES }),
    setSmartView: (smartView) =>
      set({ smartView: normalizeSmartView(smartView) }),
    setSelectedTag: (selectedTag) => set({ selectedTag }),
    setQuery: (query) => set({ query }),
    requestRefresh: () =>
      set((state) => ({ refreshRevision: state.refreshRevision + 1 })),
    clearFilters: () =>
      set({
        selectedSourceId: null,
        entryType: ALL_BIBLIOGRAPHY_ENTRY_TYPES,
        smartView: "all",
        selectedTag: null,
        query: "",
      }),
  }));
