import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface Collection {
  name: string;
  description?: string;
  icon?: string;
  kind: string;
  path?: string;
  created_at?: string;
}

export interface LatexFileMetadata {
  description?: string;
  difficulty?: number; // 1-5
  field?: string;
  chapters?: string[];
  sections?: string[];
  solved_prooved?: boolean;
  bibliography?: string[]; // Citation keys
  label?: string; // LaTeX Label
  requiredPackages?: string[];
  requiredImages?: string[];
  contentType?: string;
  preamble?: string; // Reference to preamble resource ID or 'builtin:...'
  buildCommand?: "pdflatex" | "xelatex" | "lualatex";
}

export interface Resource {
  id: string;
  path: string;
  kind: string;
  collection: string;
  title?: string;
  content_hash?: string;
  metadata?: LatexFileMetadata | any; // Use specific type for LaTeX files
  created_at?: string;
  updated_at?: string;
}

export interface LatexFileResource extends Resource {
  kind: "file";
  metadata: LatexFileMetadata;
}

interface DatabaseState {
  collections: Collection[];
  resources: Resource[];
  activeCollection: string | null;
  activeResourceId: string | null;
  isLoading: boolean;
  error: string | null;
  loadedCollections: string[];

  allLoadedResources: Resource[];
  isWizardOpen: boolean;
  setWizardOpen: (open: boolean) => void;

  fetchCollections: () => Promise<void>;
  selectCollection: (name: string) => Promise<void>;
  importFolder: (path: string, name: string) => Promise<void>;
  addFolderToCollection: (
    collectionName: string,
    path: string,
  ) => Promise<void>;
  createCollection: (name: string, path: string) => Promise<void>;
  selectResource: (id: string | null) => void;
  toggleCollectionLoaded: (name: string) => Promise<void>;
  setLoadedCollections: (collections: string[]) => Promise<void>;
  fetchResourcesForLoadedCollections: () => Promise<void>;
  deleteCollection: (name: string) => Promise<void>;
  deleteResource: (id: string) => Promise<void>;
  createResource: (
    path: string,
    collection: string,
    content: string,
    metadata?: LatexFileMetadata,
  ) => Promise<void>;
  createFolder: (path: string, collection: string) => Promise<void>;
  importFile: (path: string, collection: string) => Promise<void>;
  updateResourceMetadata: (
    id: string,
    metadata: LatexFileMetadata,
  ) => Promise<void>;
  linkResources: (
    sourceId: string,
    targetId: string,
    relationType: string,
  ) => Promise<void>;
  getLinkedResources: (
    sourceId: string,
    relationType?: string,
  ) => Promise<Resource[]>;
  updateResourceKind: (id: string, kind: string) => Promise<void>;
  moveResource: (id: string, newCollection: string) => Promise<void>;
  compileResource: (id: string) => Promise<string>; // Returns PDF path

  // Graph
  graphLinks: GraphLink[];
  fetchGraphLinks: () => Promise<void>;

  // Insert Mode
  insertMode: boolean;
  insertTargetDocumentId: string | null;
  setInsertMode: (active: boolean, targetDocId?: string | null) => void;
  toggleInsertMode: (targetDocId?: string | null) => void;
}

export interface GraphLink {
  source: string;
  target: string;
  type: string;
}

export const useDatabaseStore = create<DatabaseState>((set, get) => ({
  collections: [],
  resources: [],
  activeCollection: null,
  isLoading: false,
  error: null,
  loadedCollections: [],
  allLoadedResources: [],

  fetchCollections: async () => {
    set({ isLoading: true, error: null });
    try {
      const collections = await invoke<Collection[]>("get_collections_cmd");
      set({ collections, isLoading: false });
    } catch (err: any) {
      set({ error: err.toString(), isLoading: false });
    }
  },

  selectCollection: async (name: string) => {
    set({ activeCollection: name, isLoading: true, error: null });
    try {
      const resources = await invoke<Resource[]>(
        "get_resources_by_collection_cmd",
        { collection: name },
      );
      set({ resources, isLoading: false });
    } catch (err: any) {
      set({ error: err.toString(), isLoading: false });
    }
  },

  toggleCollectionLoaded: async (name: string) => {
    const { loadedCollections } = get();
    let newLoadedCollections: string[];

    if (loadedCollections.includes(name)) {
      // Remove from loaded collections
      newLoadedCollections = loadedCollections.filter((c) => c !== name);
    } else {
      // Add to loaded collections
      newLoadedCollections = [...loadedCollections, name];
    }

    set({ loadedCollections: newLoadedCollections, isLoading: true });

    // Fetch resources for all loaded collections
    try {
      const allResources = await invoke<Resource[]>(
        "get_resources_by_collections_cmd",
        {
          collections: newLoadedCollections,
        },
      );

      set({ allLoadedResources: allResources, isLoading: false });
    } catch (err: any) {
      set({ error: err.toString(), isLoading: false });
    }
  },

  setLoadedCollections: async (collections: string[]) => {
    set({ loadedCollections: collections, isLoading: true });

    if (collections.length === 0) {
      set({ allLoadedResources: [], isLoading: false });
      return;
    }

    try {
      const allResources = await invoke<Resource[]>(
        "get_resources_by_collections_cmd",
        {
          collections,
        },
      );

      set({ allLoadedResources: allResources, isLoading: false });
    } catch (err: any) {
      set({ error: err.toString(), isLoading: false });
    }
  },

  fetchResourcesForLoadedCollections: async () => {
    const { loadedCollections } = get();
    if (loadedCollections.length === 0) {
      set({ allLoadedResources: [] });
      return;
    }

    set({ isLoading: true });
    try {
      // Fetch all collections using batch command (single IPC call)
      const allResources = await invoke<Resource[]>(
        "get_resources_by_collections_cmd",
        {
          collections: loadedCollections,
        },
      );

      set({ allLoadedResources: allResources, isLoading: false });
    } catch (err: any) {
      set({ error: err.toString(), isLoading: false });
    }
  },

  importFolder: async (path: string, name: string) => {
    set({ isLoading: true });
    try {
      await invoke("import_folder_cmd", { path, collectionName: name });
      // Refresh collections
      await get().fetchCollections();
      // Auto-load the newly imported collection
      await get().toggleCollectionLoaded(name);
    } catch (err: any) {
      set({ error: err.toString(), isLoading: false });
    }
  },

  addFolderToCollection: async (collectionName: string, path: string) => {
    set({ isLoading: true });
    try {
      await invoke("import_folder_cmd", { path, collectionName });
      // Refresh if currently loaded
      if (get().loadedCollections.includes(collectionName)) {
        await get().fetchResourcesForLoadedCollections();
      }
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.toString(), isLoading: false });
    }
  },

  createCollection: async (name: string, path: string) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("create_collection_cmd", { name, path });
      await get().fetchCollections();
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.toString(), isLoading: false });
    }
  },

  deleteCollection: async (name: string) => {
    set({ isLoading: true, error: null });
    try {
      // Call the backend command to delete the collection
      await invoke("delete_collection_cmd", { collectionName: name });

      // If the collection was loaded, remove it from loadedCollections
      const { loadedCollections } = get();
      if (loadedCollections.includes(name)) {
        const newLoadedCollections = loadedCollections.filter(
          (c) => c !== name,
        );
        set({ loadedCollections: newLoadedCollections });

        // Refresh resources for remaining loaded collections
        await get().fetchResourcesForLoadedCollections();
      }

      // Refresh the collections list
      await get().fetchCollections();

      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.toString(), isLoading: false });
    }
  },

  activeResourceId: null as string | null,
  selectResource: (id: string | null) => set({ activeResourceId: id }),

  deleteResource: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("delete_resource_cmd", { id });

      // Remove from local state to avoid full re-fetch
      const { resources, allLoadedResources, activeResourceId } = get();

      set({
        resources: resources.filter((r) => r.id !== id),
        allLoadedResources: allLoadedResources.filter((r) => r.id !== id),
        // Deselect if the deleted resource was selected
        activeResourceId: activeResourceId === id ? null : activeResourceId,
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.toString(), isLoading: false });
    }
  },

  createResource: async (
    path: string,
    collection: string,
    content: string,
    metadata?: LatexFileMetadata,
  ) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("create_resource_cmd", {
        path,
        collectionName: collection,
        content,
        metadata,
      });
      // Refresh to show new file
      await get().fetchResourcesForLoadedCollections();
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.toString(), isLoading: false });
    }
  },

  createFolder: async (path: string, collection: string) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("create_folder_cmd", {
        path,
        collectionName: collection,
      });
      // Refresh to show new folder
      await get().fetchResourcesForLoadedCollections();
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.toString(), isLoading: false });
    }
  },

  importFile: async (path: string, collection: string) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("import_file_cmd", { path, collectionName: collection });
      // Refresh to show new file
      await get().fetchResourcesForLoadedCollections();
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.toString(), isLoading: false });
    }
  },

  updateResourceMetadata: async (id: string, metadata: LatexFileMetadata) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("update_cell_cmd", {
        tableName: "resources",
        id,
        column: "metadata",
        value: JSON.stringify(metadata),
      });

      // Update local state to reflect changes immediately without refetching everything
      const { resources, allLoadedResources } = get();

      const updateResource = (r: Resource) =>
        r.id === id ? { ...r, metadata } : r;

      set({
        resources: resources.map(updateResource),
        allLoadedResources: allLoadedResources.map(updateResource),
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.toString(), isLoading: false });
    }
  },

  linkResources: async (
    sourceId: string,
    targetId: string,
    relationType: string,
  ) => {
    try {
      await invoke("link_resources_cmd", { sourceId, targetId, relationType });
    } catch (err: any) {
      console.error("Failed to link resources", err);
      throw err;
    }
  },

  getLinkedResources: async (sourceId: string, relationType?: string) => {
    try {
      return await invoke("get_linked_resources_cmd", {
        sourceId,
        relationType,
      });
    } catch (err: any) {
      console.error("Failed to get linked resources", err);
      console.error("Failed to get linked resources", err);
      return [];
    }
  },

  updateResourceKind: async (id: string, kind: string) => {
    try {
      await invoke("update_cell_cmd", {
        tableName: "resources",
        id,
        column: "type", // DB column is 'type', struct field is 'kind'
        value: kind,
      });

      // Update local state
      const { resources, allLoadedResources } = get();
      const update = (r: Resource) => (r.id === id ? { ...r, kind } : r);
      set({
        resources: resources.map(update),
        allLoadedResources: allLoadedResources.map(update),
      });
    } catch (err: any) {
      set({ error: err.toString() });
    }
  },

  moveResource: async (id: string, newCollection: string) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("update_cell_cmd", {
        tableName: "resources",
        id,
        column: "collection",
        value: newCollection,
      });

      // Update local state
      const { resources, allLoadedResources } = get();
      const update = (r: Resource) =>
        r.id === id ? { ...r, collection: newCollection } : r;

      set({
        resources: resources.map(update),
        allLoadedResources: allLoadedResources.map(update),
        isLoading: false,
      });
    } catch (err: any) {
      set({ error: err.toString(), isLoading: false });
    }
  },

  compileResource: async (id: string) => {
    try {
      return await invoke("compile_resource_cmd", { id });
    } catch (err: any) {
      console.error("Failed to compile resource", err);
      throw err;
    }
  },

  isWizardOpen: false,
  setWizardOpen: (open: boolean) => set({ isWizardOpen: open }),

  graphLinks: [],
  fetchGraphLinks: async () => {
    try {
      const rawLinks = await invoke<[string, string, string][]>(
        "get_all_dependencies_cmd",
      );
      const links = rawLinks.map(([source, target, type]) => ({
        source,
        target,
        type,
      }));
      set({ graphLinks: links });
    } catch (err) {
      console.error("Failed to fetch graph links", err);
    }
  },

  // Insert Mode
  insertMode: false,
  insertTargetDocumentId: null,
  setInsertMode: (active: boolean, targetDocId?: string | null) => {
    set({
      insertMode: active,
      insertTargetDocumentId: active ? (targetDocId ?? null) : null,
    });
  },
  toggleInsertMode: (targetDocId?: string | null) => {
    const { insertMode } = get();
    set({
      insertMode: !insertMode,
      insertTargetDocumentId: !insertMode ? (targetDocId ?? null) : null,
    });
  },
}));
