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
  PackageTopic,
  MacroCommandType,
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
  packageTopics: PackageTopic[];
  macroCommandTypes: MacroCommandType[];

  // Loading states
  isLoadingLookupData: boolean;

  // Load Actions
  loadFields: () => Promise<void>;
  loadChapters: (fieldId?: string) => Promise<void>;
  loadSections: (chapterId?: string) => Promise<void>;
  loadSubsections: (sectionId?: string) => Promise<void>;
  loadExerciseTypes: () => Promise<void>;
  loadFileTypes: () => Promise<void>;
  loadPackageTopics: () => Promise<void>;
  loadMacroCommandTypes: () => Promise<void>;
  loadAllLookupData: () => Promise<void>;

  // Create Actions (for creatable dropdowns)
  createField: (name: string) => Promise<Field>;
  createChapter: (name: string, fieldId: string) => Promise<Chapter>;
  createSection: (name: string, chapterId: string) => Promise<Section>;
  createSubsection: (name: string, sectionId: string) => Promise<Subsection>;
  createFileType: (name: string) => Promise<FileType>;
  createExerciseType: (name: string) => Promise<ExerciseType>;
  createPackageTopic: (name: string) => Promise<PackageTopic>;
  createMacroCommandType: (name: string) => Promise<MacroCommandType>;

  // Delete Actions
  deleteField: (id: string) => Promise<void>;
  deleteChapter: (id: string) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  deleteSubsection: (id: string) => Promise<void>;

  // Rename Actions
  renameField: (id: string, name: string) => Promise<void>;
  renameChapter: (id: string, name: string) => Promise<void>;
  renameSection: (id: string, name: string) => Promise<void>;
  renameSubsection: (id: string, name: string) => Promise<void>;

  saveTypedMetadata: (
    resourceId: string,
    resourceType: ResourceType,
    metadata: any
  ) => Promise<void>;
  loadTypedMetadata: (
    resourceId: string,
    resourceType: ResourceType
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

export const useTypedMetadataStore = create<TypedMetadataState>((set, get) => ({
  // Initial state
  fields: [],
  chapters: [],
  sections: [],
  subsections: [],
  exerciseTypes: [],
  fileTypes: [],
  packageTopics: [],
  macroCommandTypes: [],
  isLoadingLookupData: false,

  // Load fields
  loadFields: async () => {
    try {
      const fields = await invoke<Field[]>("get_fields_cmd");
      set({ fields });
    } catch (error) {
      console.error("Failed to load fields:", error);
      throw error;
    }
  },

  // Load chapters
  loadChapters: async (fieldId?: string) => {
    try {
      const chapters = await invoke<Chapter[]>("get_chapters_cmd", { fieldId });
      set({ chapters });
    } catch (error) {
      console.error("Failed to load chapters:", error);
      throw error;
    }
  },

  // Load sections
  loadSections: async (chapterId?: string) => {
    try {
      const sections = await invoke<Section[]>("get_sections_cmd", {
        chapterId,
      });
      set({ sections });
    } catch (error) {
      console.error("Failed to load sections:", error);
      throw error;
    }
  },

  // Load subsections
  loadSubsections: async (sectionId?: string) => {
    try {
      const subsections = await invoke<Subsection[]>("get_subsections_cmd", {
        sectionId,
      });
      set({ subsections });
    } catch (error) {
      console.error("Failed to load subsections:", error);
      throw error;
    }
  },

  // Load exercise types
  loadExerciseTypes: async () => {
    try {
      const exerciseTypes = await invoke<ExerciseType[]>(
        "get_exercise_types_cmd"
      );
      set({ exerciseTypes });
    } catch (error) {
      console.error("Failed to load exercise types:", error);
      throw error;
    }
  },

  // Load file types
  loadFileTypes: async () => {
    try {
      const fileTypes = await invoke<FileType[]>("get_file_types_cmd");
      set({ fileTypes });
    } catch (error) {
      console.error("Failed to load file types:", error);
      throw error;
    }
  },

  // Load package topics
  loadPackageTopics: async () => {
    try {
      const packageTopics = await invoke<PackageTopic[]>(
        "get_package_topics_cmd"
      );
      set({ packageTopics });
    } catch (error) {
      console.error("Failed to load package topics:", error);
      throw error;
    }
  },

  // Load macro command types
  loadMacroCommandTypes: async () => {
    try {
      const macroCommandTypes = await invoke<MacroCommandType[]>(
        "get_macro_command_types_cmd"
      );
      set({ macroCommandTypes });
    } catch (error) {
      console.error("Failed to load macro command types:", error);
      throw error;
    }
  },

  // Load all lookup data
  loadAllLookupData: async () => {
    set({ isLoadingLookupData: true });
    try {
      await Promise.all([
        get().loadFields(),
        get().loadChapters(),
        get().loadSections(),
        get().loadExerciseTypes(),
        get().loadFileTypes(),
        get().loadPackageTopics(),
        get().loadMacroCommandTypes(),
      ]);
    } finally {
      set({ isLoadingLookupData: false });
    }
  },

  // Create new field
  createField: async (name: string) => {
    try {
      const field = await invoke<Field>("create_field_cmd", { name });
      set((state) => ({ fields: [...state.fields, field] }));
      return field;
    } catch (error) {
      console.error("Failed to create field:", error);
      throw error;
    }
  },

  // Create new chapter
  createChapter: async (name: string, fieldId: string) => {
    try {
      const chapter = await invoke<Chapter>("create_chapter_cmd", {
        name,
        fieldId,
      });
      set((state) => ({ chapters: [...state.chapters, chapter] }));
      return chapter;
    } catch (error) {
      console.error("Failed to create chapter:", error);
      throw error;
    }
  },

  // Create new section
  createSection: async (name: string, chapterId: string) => {
    try {
      const section = await invoke<Section>("create_section_cmd", {
        name,
        chapterId,
      });
      set((state) => ({ sections: [...state.sections, section] }));
      return section;
    } catch (error) {
      console.error("Failed to create section:", error);
      throw error;
    }
  },

  // Create new subsection
  createSubsection: async (name: string, sectionId: string) => {
    try {
      const subsection = await invoke<Subsection>("create_subsection_cmd", {
        name,
        sectionId,
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
        { name }
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
        { name }
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
        ch.id === id ? { ...ch, name } : ch
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
        ss.id === id ? { ...ss, name } : ss
      ),
    }));
  },

  // Save typed metadata
  saveTypedMetadata: async (
    resourceId: string,
    resourceType: ResourceType,
    metadata: any
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
    (state) => state.getChaptersByField
  );

  if (!fieldId) return chapters;
  return getChaptersByField(fieldId);
};

// Hook to get sections for a specific chapter
export const useSectionsForChapter = (chapterId?: string) => {
  const sections = useTypedMetadataStore((state) => state.sections);
  const getSectionsByChapter = useTypedMetadataStore(
    (state) => state.getSectionsByChapter
  );

  if (!chapterId) return sections;
  return getSectionsByChapter(chapterId);
};

// Hook to initialize lookup data on mount
export const useInitializeLookupData = () => {
  const loadAllLookupData = useTypedMetadataStore(
    (state) => state.loadAllLookupData
  );
  const isLoadingLookupData = useTypedMetadataStore(
    (state) => state.isLoadingLookupData
  );

  React.useEffect(() => {
    loadAllLookupData();
  }, []);

  return { isLoading: isLoadingLookupData };
};
