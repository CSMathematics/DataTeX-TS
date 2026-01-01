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

    fetchCollections: () => Promise<void>;
    selectCollection: (name: string) => Promise<void>;
    importFolder: (path: string, name: string) => Promise<void>;
    selectResource: (id: string | null) => void;
    toggleCollectionLoaded: (name: string) => Promise<void>;
    fetchResourcesForLoadedCollections: () => Promise<void>;
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
            
            // Filter to only .tex files
            const texResources = allResources.filter(r => r.path.toLowerCase().endsWith('.tex'));
            
            set({ allLoadedResources: texResources, isLoading: false });
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
            
            // Filter to only .tex files
            const texResources = allResources.filter(r => r.path.toLowerCase().endsWith('.tex'));
            
            set({ allLoadedResources: texResources, isLoading: false });
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

    activeResourceId: null as string | null,
    selectResource: (id: string | null) => set({ activeResourceId: id })
}));
