import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface Collection {
    name: string;
    description?: string;
    icon?: string;
    kind: string;
    created_at?: string;
}

export interface Resource {
    id: string;
    path: string;
    kind: string;
    collection: string;
    title?: string;
    content_hash?: string;
    metadata?: any;
    created_at?: string;
    updated_at?: string;
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
    selectResource: (id: string | null) => void;
    toggleCollectionLoaded: (name: string) => Promise<void>;
    fetchResourcesForLoadedCollections: () => Promise<void>;
    deleteCollection: (name: string) => Promise<void>;
    deleteResource: (id: string) => Promise<void>;
    createResource: (path: string, collection: string, content: string) => Promise<void>;
    importFile: (path: string, collection: string) => Promise<void>;
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
            const collections = await invoke<Collection[]>('get_collections_cmd');
            set({ collections, isLoading: false });
        } catch (err: any) {
            set({ error: err.toString(), isLoading: false });
        }
    },

    selectCollection: async (name: string) => {
        set({ activeCollection: name, isLoading: true, error: null });
        try {
            const resources = await invoke<Resource[]>('get_resources_by_collection_cmd', { collection: name });
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
            newLoadedCollections = loadedCollections.filter(c => c !== name);
        } else {
            // Add to loaded collections
            newLoadedCollections = [...loadedCollections, name];
        }
        
        set({ loadedCollections: newLoadedCollections, isLoading: true });
        
        // Fetch resources for all loaded collections
        try {
            const allResources: Resource[] = [];
            for (const collectionName of newLoadedCollections) {
                const resources = await invoke<Resource[]>('get_resources_by_collection_cmd', { collection: collectionName });
                allResources.push(...resources);
            }
            
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
            const allResources: Resource[] = [];
            for (const collectionName of loadedCollections) {
                const resources = await invoke<Resource[]>('get_resources_by_collection_cmd', { collection: collectionName });
                allResources.push(...resources);
            }
            
            set({ allLoadedResources: allResources, isLoading: false });
        } catch (err: any) {
            set({ error: err.toString(), isLoading: false });
        }
    },

    importFolder: async (path: string, name: string) => {
        set({ isLoading: true });
        try {
            await invoke('import_folder_cmd', { path, collectionName: name });
            // Refresh collections
            await get().fetchCollections();
            // Auto-load the newly imported collection
            await get().toggleCollectionLoaded(name);
        } catch (err: any) {
            set({ error: err.toString(), isLoading: false });
        }
    },

    deleteCollection: async (name: string) => {
        set({ isLoading: true, error: null });
        try {
            // Call the backend command to delete the collection
            await invoke('delete_collection_cmd', { collectionName: name });
            
            // If the collection was loaded, remove it from loadedCollections
            const { loadedCollections } = get();
            if (loadedCollections.includes(name)) {
                const newLoadedCollections = loadedCollections.filter(c => c !== name);
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
            await invoke('delete_resource_cmd', { id });
            
            // Remove from local state to avoid full re-fetch
            const { resources, allLoadedResources, activeResourceId } = get();
            
            set({
                resources: resources.filter(r => r.id !== id),
                allLoadedResources: allLoadedResources.filter(r => r.id !== id),
                // Deselect if the deleted resource was selected
                activeResourceId: activeResourceId === id ? null : activeResourceId,
                isLoading: false
            });
        } catch (err: any) {
            set({ error: err.toString(), isLoading: false });
        }
    },

    createResource: async (path: string, collection: string, content: string) => {
        set({ isLoading: true, error: null });
        try {
            await invoke('create_resource_cmd', { path, collectionName: collection, content });
            // Refresh to show new file
            await get().fetchResourcesForLoadedCollections();
            set({ isLoading: false });
        } catch (err: any) {
             set({ error: err.toString(), isLoading: false });
        }
    },

    importFile: async (path: string, collection: string) => {
        set({ isLoading: true, error: null });
        try {
            await invoke('import_file_cmd', { path, collectionName: collection });
            // Refresh to show new file
            await get().fetchResourcesForLoadedCollections();
            set({ isLoading: false });
        } catch (err: any) {
            set({ error: err.toString(), isLoading: false });
        }
    },

    isWizardOpen: false,
    setWizardOpen: (open: boolean) => set({ isWizardOpen: open }),
}));
