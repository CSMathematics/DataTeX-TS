import React from "react";
// ============================================================================
// Typed Metadata Store
// Zustand store for managing typed metadata and lookup data
// ============================================================================

import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

// ============================================================================
// Store State
// ============================================================================

// Lookup type definitions
import type {
  Field,
  Chapter,
  Section,
  Subsection,
  ExerciseType,
  FileType,
  DocumentType,
  TableType,
  FigureType,
  PackageTopic,
  MacroCommandType,
  CommandType,
  PreambleType,
  ResourceType,
} from "../types/typedMetadata";

interface TypedMetadataState {
  // Lookup data cache
  fields: Field[];
  chapters: Chapter[];
  sections: Section[];
  subsections: Subsection[];
  exerciseTypes: ExerciseType[];
  fileTypes: FileType[];
  documentTypes: DocumentType[];
  tableTypes: TableType[];
  figureTypes: FigureType[];
  packageTopics: PackageTopic[];
  macroCommandTypes: MacroCommandType[];
  commandTypes: CommandType[];
  preambleTypes: PreambleType[];

  // Loading states
  isLoadingLookupData: boolean;

  // Load Actions
  loadFields: (collectionName?: string) => Promise<void>;
  loadChapters: (fieldId?: string, collectionName?: string) => Promise<void>;
  loadSections: (chapterId?: string, collectionName?: string) => Promise<void>;
  loadSubsections: (
    sectionId?: string,
    collectionName?: string,
  ) => Promise<void>;
  loadExerciseTypes: () => Promise<void>;
  loadFileTypes: () => Promise<void>;
  loadDocumentTypes: () => Promise<void>;
  loadTableTypes: () => Promise<void>;
  loadFigureTypes: () => Promise<void>;
  loadPackageTopics: () => Promise<void>;
  loadMacroCommandTypes: () => Promise<void>;
  loadCommandTypes: () => Promise<void>;
  loadPreambleTypes: () => Promise<void>;
  loadAllLookupData: (collectionName?: string) => Promise<void>;
  clearAllLookupData: () => void;

  // Create Actions (for creatable dropdowns)
  createField: (name: string, collectionName?: string) => Promise<Field>;
  createChapter: (
    name: string,
    fieldId: string,
    collectionName?: string,
  ) => Promise<Chapter>;
  createSection: (
    name: string,
    chapterId: string,
    collectionName?: string,
  ) => Promise<Section>;
  createSubsection: (
    name: string,
    sectionId: string,
    collectionName?: string,
  ) => Promise<Subsection>;
  createFileType: (name: string) => Promise<FileType>;
  createExerciseType: (name: string) => Promise<ExerciseType>;
  createDocumentType: (name: string) => Promise<DocumentType>;
  createTableType: (name: string) => Promise<TableType>;
  createFigureType: (name: string) => Promise<FigureType>;
  createPackageTopic: (name: string) => Promise<PackageTopic>;
  createMacroCommandType: (name: string) => Promise<MacroCommandType>;
  createCommandType: (name: string) => Promise<CommandType>;
  createPreambleType: (name: string) => Promise<PreambleType>;

  // Delete Actions
  deleteField: (id: string) => Promise<void>;
  deleteChapter: (id: string) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  deleteSubsection: (id: string) => Promise<void>;
  deleteFileType: (id: string) => Promise<void>;
  deleteExerciseType: (id: string) => Promise<void>;
  deleteDocumentType: (id: string) => Promise<void>;
  deleteTableType: (id: string) => Promise<void>;
  deleteFigureType: (id: string) => Promise<void>;
  deleteCommandType: (id: string) => Promise<void>;
  deletePreambleType: (id: string) => Promise<void>;

  // Rename Actions
  renameField: (id: string, name: string) => Promise<void>;
  renameChapter: (id: string, name: string) => Promise<void>;
  renameSection: (id: string, name: string) => Promise<void>;
  renameSubsection: (id: string, name: string) => Promise<void>;
  renameFileType: (id: string, name: string) => Promise<void>;
  renameExerciseType: (id: string, name: string) => Promise<void>;
  renameDocumentType: (id: string, name: string) => Promise<void>;
  renameTableType: (id: string, name: string) => Promise<void>;
  renameFigureType: (id: string, name: string) => Promise<void>;
  renameCommandType: (id: string, name: string) => Promise<void>;
  renamePreambleType: (id: string, name: string) => Promise<void>;

  saveTypedMetadata: (
    resourceId: string,
    resourceType: ResourceType,
    metadata: any,
  ) => Promise<void>;
  loadTypedMetadata: (
    resourceId: string,
    resourceType: ResourceType,
  ) => Promise<any>;
  migrateResourceToTyped: (resourceId: string) => Promise<string>;

  // Helpers
  getChaptersByField: (fieldId: string) => Chapter[];
  getSectionsByChapter: (chapterId: string) => Section[];
  getSubsectionsBySection: (sectionId: string) => Subsection[];
  getFieldById: (fieldId: string) => Field | undefined;
  getChapterById: (chapterId: string) => Chapter | undefined;
  getSectionById: (sectionId: string) => Section | undefined;
}

// ============================================================================
// Store Implementation
// ============================================================================

const ALL_COLLECTIONS_LOOKUP_KEY = "__all_collections__";
let loadedLookupKey: string | null = null;
let lookupLoadGeneration = 0;
let lookupLoadInFlight: { key: string; promise: Promise<void> } | null = null;

export const useTypedMetadataStore = create<TypedMetadataState>((set, get) => ({
  // Initial state
  fields: [],
  chapters: [],
  sections: [],
  subsections: [],
  exerciseTypes: [],
  fileTypes: [],
  documentTypes: [],
  tableTypes: [],
  figureTypes: [],
  packageTopics: [],
  macroCommandTypes: [],
  commandTypes: [],
  preambleTypes: [],

  isLoadingLookupData: false,

  // Clear all lookup data (reset to empty)
  clearAllLookupData: () => {
    lookupLoadGeneration += 1;
    loadedLookupKey = null;
    lookupLoadInFlight = null;
    set({
      fields: [],
      chapters: [],
      sections: [],
      subsections: [],
      exerciseTypes: [],
      fileTypes: [],
      documentTypes: [],
      tableTypes: [],
      figureTypes: [],
      packageTopics: [],
      macroCommandTypes: [],
      commandTypes: [],
      preambleTypes: [],
      isLoadingLookupData: false,
    });
  },

  // Load fields
  loadFields: async (collectionName?: string) => {
    try {
      const fields = await invoke<Field[]>("get_fields_cmd", {
        collectionName,
      });
      set({ fields });
    } catch (error) {
      console.error("Failed to load fields:", error);
    }
  },

  // Load chapters
  loadChapters: async (fieldId?: string, collectionName?: string) => {
    try {
      const chapters = await invoke<Chapter[]>("get_chapters_cmd", {
        fieldId,
        collectionName,
      });
      set({ chapters });
    } catch (error) {
      console.error("Failed to load chapters:", error);
    }
  },

  // Load sections
  loadSections: async (chapterId?: string, collectionName?: string) => {
    try {
      const sections = await invoke<Section[]>("get_sections_cmd", {
        chapterId,
        collectionName,
      });
      set({ sections });
    } catch (error) {
      console.error("Failed to load sections:", error);
    }
  },

  // Load subsections
  loadSubsections: async (sectionId?: string, collectionName?: string) => {
    try {
      const subsections = await invoke<Subsection[]>("get_subsections_cmd", {
        sectionId,
        collectionName,
      });
      set({ subsections });
    } catch (error) {
      console.error("Failed to load subsections:", error);
    }
  },

  // Load exercise types
  loadExerciseTypes: async () => {
    try {
      const exerciseTypes = await invoke<ExerciseType[]>(
        "get_exercise_types_cmd",
      );
      set({ exerciseTypes });
    } catch (error) {
      console.error("Failed to load exercise types:", error);
    }
  },

  // Load file types
  loadFileTypes: async () => {
    try {
      const fileTypes = await invoke<FileType[]>("get_file_types_cmd");
      set({ fileTypes });
    } catch (error) {
      console.error("Failed to load file types:", error);
    }
  },

  // Load document types
  loadDocumentTypes: async () => {
    try {
      const documentTypes = await invoke<DocumentType[]>(
        "get_document_types_cmd",
      );
      set({ documentTypes });
    } catch (error) {
      console.error("Failed to load document types:", error);
    }
  },

  // Load table types
  loadTableTypes: async () => {
    try {
      const tableTypes = await invoke<TableType[]>("get_table_types_cmd");
      set({ tableTypes });
    } catch (error) {
      console.error("Failed to load table types:", error);
    }
  },

  // Load figure types
  loadFigureTypes: async () => {
    try {
      const figureTypes = await invoke<FigureType[]>("get_figure_types_cmd");
      set({ figureTypes });
    } catch (error) {
      console.error("Failed to load figure types:", error);
    }
  },

  // Load package topics
  loadPackageTopics: async () => {
    try {
      const packageTopics = await invoke<PackageTopic[]>(
        "get_package_topics_cmd",
      );
      set({ packageTopics });
    } catch (error) {
      console.error("Failed to load package topics:", error);
    }
  },

  // Load macro command types
  loadMacroCommandTypes: async () => {
    try {
      const macroCommandTypes = await invoke<MacroCommandType[]>(
        "get_macro_command_types_cmd",
      );
      set({ macroCommandTypes });
    } catch (error) {
      console.error("Failed to load macro command types:", error);
    }
  },

  // Load command types
  loadCommandTypes: async () => {
    try {
      const commandTypes = await invoke<CommandType[]>("get_command_types_cmd");
      set({ commandTypes });
    } catch (error) {
      console.error("Failed to load command types:", error);
    }
  },

  // Load preamble types
  loadPreambleTypes: async () => {
    try {
      const preambleTypes = await invoke<PreambleType[]>(
        "get_preamble_types_cmd",
      );
      set({ preambleTypes });
    } catch (error) {
      console.error("Failed to load preamble types:", error);
    }
  },

  // Load all lookup data
  loadAllLookupData: (collectionName?: string) => {
    const key = collectionName ?? ALL_COLLECTIONS_LOOKUP_KEY;
    if (loadedLookupKey === key) return Promise.resolve();
    if (lookupLoadInFlight?.key === key) return lookupLoadInFlight.promise;

    const generation = lookupLoadGeneration;
    set({ isLoadingLookupData: true });
    const promise = Promise.all([
      get().loadFields(collectionName),
      get().loadChapters(undefined, collectionName),
      get().loadSections(undefined, collectionName),
      get().loadSubsections(undefined, collectionName),
      get().loadExerciseTypes(),
      get().loadFileTypes(),
      get().loadDocumentTypes(),
      get().loadTableTypes(),
      get().loadFigureTypes(),
      get().loadPackageTopics(),
      get().loadMacroCommandTypes(),
      get().loadCommandTypes(),
      get().loadPreambleTypes(),
    ]).then(() => {
        if (generation === lookupLoadGeneration) {
          loadedLookupKey = key;
        }
      })
      .finally(() => {
        if (lookupLoadInFlight?.promise === promise) {
          lookupLoadInFlight = null;
        }
        if (generation === lookupLoadGeneration) {
          set({ isLoadingLookupData: false });
        }
      });

    lookupLoadInFlight = { key, promise };
    return promise;
  },

  // Create new field
  createField: async (name: string, collectionName?: string) => {
    try {
      const field = await invoke<Field>("create_field_cmd", {
        name,
        collectionName,
      });
      set((state) => ({ fields: [...state.fields, field] }));
      return field;
    } catch (error) {
      console.error("Failed to create field:", error);
      throw error;
    }
  },

  // Create new chapter
  createChapter: async (
    name: string,
    fieldId: string,
    collectionName?: string,
  ) => {
    try {
      const chapter = await invoke<Chapter>("create_chapter_cmd", {
        name,
        fieldId,
        collectionName,
      });
      set((state) => ({ chapters: [...state.chapters, chapter] }));
      return chapter;
    } catch (error) {
      console.error("Failed to create chapter:", error);
      throw error;
    }
  },

  // Create new section
  createSection: async (
    name: string,
    chapterId: string,
    collectionName?: string,
  ) => {
    try {
      const section = await invoke<Section>("create_section_cmd", {
        name,
        chapterId,
        collectionName,
      });
      set((state) => ({ sections: [...state.sections, section] }));
      return section;
    } catch (error) {
      console.error("Failed to create section:", error);
      throw error;
    }
  },

  // Create new subsection
  createSubsection: async (
    name: string,
    sectionId: string,
    collectionName?: string,
  ) => {
    try {
      const subsection = await invoke<Subsection>("create_subsection_cmd", {
        name,
        sectionId,
        collectionName,
      });
      set((state) => ({ subsections: [...state.subsections, subsection] }));
      return subsection;
    } catch (error) {
      console.error("Failed to create subsection:", error);
      throw error;
    }
  },

  // Create new file type
  createFileType: async (name: string) => {
    try {
      const fileType = await invoke<FileType>("create_file_type_cmd", { name });
      set((state) => ({ fileTypes: [...state.fileTypes, fileType] }));
      return fileType;
    } catch (error) {
      console.error("Failed to create file type:", error);
      throw error;
    }
  },

  // Create new exercise type
  createExerciseType: async (name: string) => {
    try {
      const exerciseType = await invoke<ExerciseType>(
        "create_exercise_type_cmd",
        { name },
      );
      set((state) => ({
        exerciseTypes: [...state.exerciseTypes, exerciseType],
      }));
      return exerciseType;
    } catch (error) {
      console.error("Failed to create exercise type:", error);
      throw error;
    }
  },

  // Create new document type
  createDocumentType: async (name: string) => {
    try {
      const documentType = await invoke<DocumentType>(
        "create_document_type_cmd",
        { name },
      );
      set((state) => ({
        documentTypes: [...state.documentTypes, documentType],
      }));
      return documentType;
    } catch (error) {
      console.error("Failed to create document type:", error);
      throw error;
    }
  },

  // Create new table type
  createTableType: async (name: string) => {
    try {
      const tableType = await invoke<TableType>("create_table_type_cmd", {
        name,
      });
      set((state) => ({
        tableTypes: [...state.tableTypes, tableType],
      }));
      return tableType;
    } catch (error) {
      console.error("Failed to create table type:", error);
      throw error;
    }
  },

  // Create new figure type
  createFigureType: async (name: string) => {
    try {
      const figureType = await invoke<FigureType>("create_figure_type_cmd", {
        name,
      });
      set((state) => ({
        figureTypes: [...state.figureTypes, figureType],
      }));
      return figureType;
    } catch (error) {
      console.error("Failed to create figure type:", error);
      throw error;
    }
  },

  // Create new package topic
  createPackageTopic: async (name: string) => {
    try {
      const topic = await invoke<PackageTopic>("create_package_topic_cmd", {
        name,
      });
      set((state) => ({ packageTopics: [...state.packageTopics, topic] }));
      return topic;
    } catch (error) {
      console.error("Failed to create package topic:", error);
      throw error;
    }
  },

  // Create new macro command type
  createMacroCommandType: async (name: string) => {
    try {
      const type = await invoke<MacroCommandType>(
        "create_macro_command_type_cmd",
        { name },
      );
      set((state) => ({
        macroCommandTypes: [...state.macroCommandTypes, type],
      }));
      return type;
    } catch (error) {
      console.error("Failed to create macro command type:", error);
      throw error;
    }
  },

  // Create new command type
  createCommandType: async (name: string) => {
    try {
      const type = await invoke<CommandType>("create_command_type_cmd", {
        name,
      });
      set((state) => ({
        commandTypes: [...state.commandTypes, type],
      }));
      return type;
    } catch (error) {
      console.error("Failed to create command type:", error);
      throw error;
    }
  },

  // Create new preamble type
  createPreambleType: async (name: string) => {
    try {
      const type = await invoke<PreambleType>("create_preamble_type_cmd", {
        name,
      });
      set((state) => ({
        preambleTypes: [...state.preambleTypes, type],
      }));
      return type;
    } catch (error) {
      console.error("Failed to create preamble type:", error);
      throw error;
    }
  },

  // Delete Actions
  deleteField: async (id: string) => {
    await invoke("delete_field_cmd", { id });
    set((state) => ({
      fields: state.fields.filter((f) => f.id !== id),
      chapters: state.chapters.filter((ch) => ch.fieldId !== id),
    }));
  },

  deleteChapter: async (id: string) => {
    await invoke("delete_chapter_cmd", { id });
    set((state) => ({
      chapters: state.chapters.filter((ch) => ch.id !== id),
      sections: state.sections.filter((s) => s.chapterId !== id),
    }));
  },

  deleteSection: async (id: string) => {
    await invoke("delete_section_cmd", { id });
    set((state) => ({
      sections: state.sections.filter((s) => s.id !== id),
      subsections: state.subsections.filter((ss) => ss.sectionId !== id),
    }));
  },

  deleteSubsection: async (id: string) => {
    await invoke("delete_subsection_cmd", { id });
    set((state) => ({
      subsections: state.subsections.filter((ss) => ss.id !== id),
    }));
  },

  // Rename Actions
  renameField: async (id: string, name: string) => {
    await invoke("rename_field_cmd", { id, name });
    set((state) => ({
      fields: state.fields.map((f) => (f.id === id ? { ...f, name } : f)),
    }));
  },

  renameChapter: async (id: string, name: string) => {
    await invoke("rename_chapter_cmd", { id, name });
    set((state) => ({
      chapters: state.chapters.map((ch) =>
        ch.id === id ? { ...ch, name } : ch,
      ),
    }));
  },

  renameSection: async (id: string, name: string) => {
    await invoke("rename_section_cmd", { id, name });
    set((state) => ({
      sections: state.sections.map((s) => (s.id === id ? { ...s, name } : s)),
    }));
  },

  renameSubsection: async (id: string, name: string) => {
    await invoke("rename_subsection_cmd", { id, name });
    set((state) => ({
      subsections: state.subsections.map((ss) =>
        ss.id === id ? { ...ss, name } : ss,
      ),
    }));
  },

  // FileType Rename/Delete Actions
  deleteFileType: async (id: string) => {
    await invoke("delete_file_type_cmd", { id });
    set((state) => ({
      fileTypes: state.fileTypes.filter((ft) => ft.id !== id),
    }));
  },

  renameFileType: async (id: string, name: string) => {
    await invoke("rename_file_type_cmd", { id, name });
    set((state) => ({
      fileTypes: state.fileTypes.map((ft) =>
        ft.id === id ? { ...ft, name } : ft,
      ),
    }));
  },

  // ExerciseType Rename/Delete Actions
  deleteExerciseType: async (id: string) => {
    await invoke("delete_exercise_type_cmd", { id });
    set((state) => ({
      exerciseTypes: state.exerciseTypes.filter((et) => et.id !== id),
    }));
  },

  renameExerciseType: async (id: string, name: string) => {
    await invoke("rename_exercise_type_cmd", { id, name });
    set((state) => ({
      exerciseTypes: state.exerciseTypes.map((et) =>
        et.id === id ? { ...et, name } : et,
      ),
    }));
  },

  // DocumentType Rename/Delete Actions
  deleteDocumentType: async (id: string) => {
    await invoke("delete_document_type_cmd", { id });
    set((state) => ({
      documentTypes: state.documentTypes.filter((dt) => dt.id !== id),
    }));
  },

  renameDocumentType: async (id: string, name: string) => {
    await invoke("rename_document_type_cmd", { id, name });
    set((state) => ({
      documentTypes: state.documentTypes.map((dt) =>
        dt.id === id ? { ...dt, name } : dt,
      ),
    }));
  },

  // TableType Rename/Delete Actions
  deleteTableType: async (id: string) => {
    await invoke("delete_table_type_cmd", { id });
    set((state) => ({
      tableTypes: state.tableTypes.filter((tt) => tt.id !== id),
    }));
  },

  renameTableType: async (id: string, name: string) => {
    await invoke("rename_table_type_cmd", { id, name });
    set((state) => ({
      tableTypes: state.tableTypes.map((tt) =>
        tt.id === id ? { ...tt, name } : tt,
      ),
    }));
  },

  // FigureType Rename/Delete Actions
  deleteFigureType: async (id: string) => {
    await invoke("delete_figure_type_cmd", { id });
    set((state) => ({
      figureTypes: state.figureTypes.filter((ft) => ft.id !== id),
    }));
  },

  renameFigureType: async (id: string, name: string) => {
    await invoke("rename_figure_type_cmd", { id, name });
    set((state) => ({
      figureTypes: state.figureTypes.map((ft) =>
        ft.id === id ? { ...ft, name } : ft,
      ),
    }));
  },

  // CommandType Rename/Delete Actions
  deleteCommandType: async (id: string) => {
    await invoke("delete_command_type_cmd", { id });
    set((state) => ({
      commandTypes: state.commandTypes.filter((ct) => ct.id !== id),
    }));
  },

  renameCommandType: async (id: string, name: string) => {
    await invoke("rename_command_type_cmd", { id, name });
    set((state) => ({
      commandTypes: state.commandTypes.map((ct) =>
        ct.id === id ? { ...ct, name } : ct,
      ),
    }));
  },

  // PreambleType Rename/Delete Actions
  deletePreambleType: async (id: string) => {
    await invoke("delete_preamble_type_cmd", { id });
    set((state) => ({
      preambleTypes: state.preambleTypes.filter((pt) => pt.id !== id),
    }));
  },

  renamePreambleType: async (id: string, name: string) => {
    await invoke("rename_preamble_type_cmd", { id, name });
    set((state) => ({
      preambleTypes: state.preambleTypes.map((pt) =>
        pt.id === id ? { ...pt, name } : pt,
      ),
    }));
  },

  // Save typed metadata
  saveTypedMetadata: async (
    resourceId: string,
    resourceType: ResourceType,
    metadata: any,
  ) => {
    try {
      await invoke("save_typed_metadata_cmd", {
        resourceId,
        resourceType,
        metadata,
      });
    } catch (error) {
      console.error("Failed to save typed metadata:", error);
      throw error;
    }
  },

  // Load typed metadata
  loadTypedMetadata: async (resourceId: string, resourceType: ResourceType) => {
    try {
      const metadata = await invoke("load_typed_metadata_cmd", {
        resourceId,
        resourceType,
      });
      return metadata;
    } catch (error) {
      console.error("Failed to load typed metadata:", error);
      throw error;
    }
  },

  // Migrate resource to typed metadata
  migrateResourceToTyped: async (resourceId: string) => {
    try {
      const result = await invoke<string>("migrate_resource_to_typed_cmd", {
        resourceId,
      });
      return result;
    } catch (error) {
      console.error("Failed to migrate resource:", error);
      throw error;
    }
  },

  // Helper: Get chapters by field
  getChaptersByField: (fieldId: string) => {
    return get().chapters.filter((c) => c.fieldId === fieldId);
  },

  // Helper: Get sections by chapter
  getSectionsByChapter: (chapterId: string) => {
    return get().sections.filter((s) => s.chapterId === chapterId);
  },

  // Helper: Get subsections by section
  getSubsectionsBySection: (sectionId: string) => {
    return get().subsections.filter((ss) => ss.sectionId === sectionId);
  },

  // Helper: Get field by ID
  getFieldById: (fieldId: string) => {
    return get().fields.find((f) => f.id === fieldId);
  },

  // Helper: Get chapter by ID
  getChapterById: (chapterId: string) => {
    return get().chapters.find((c) => c.id === chapterId);
  },

  // Helper: Get section by ID
  getSectionById: (sectionId: string) => {
    return get().sections.find((s) => s.id === sectionId);
  },
}));

// ============================================================================
// Custom Hooks
// ============================================================================

// Hook to get chapters for a specific field
export const useChaptersForField = (fieldId?: string) => {
  const chapters = useTypedMetadataStore((state) => state.chapters);
  const getChaptersByField = useTypedMetadataStore(
    (state) => state.getChaptersByField,
  );

  if (!fieldId) return chapters;
  return getChaptersByField(fieldId);
};

// Hook to get sections for a specific chapter
export const useSectionsForChapter = (chapterId?: string) => {
  const sections = useTypedMetadataStore((state) => state.sections);
  const getSectionsByChapter = useTypedMetadataStore(
    (state) => state.getSectionsByChapter,
  );

  if (!chapterId) return sections;
  return getSectionsByChapter(chapterId);
};

// Hook to initialize lookup data on mount
export const useInitializeLookupData = () => {
  const loadAllLookupData = useTypedMetadataStore(
    (state) => state.loadAllLookupData,
  );
  const isLoadingLookupData = useTypedMetadataStore(
    (state) => state.isLoadingLookupData,
  );

  React.useEffect(() => {
    loadAllLookupData();
  }, []);

  return { isLoading: isLoadingLookupData };
};
