import { create } from 'zustand';
import { FileSystemNode } from '../components/layout/Sidebar';

interface ProjectStoreState {
    // Project folder data
    projectData: FileSystemNode[];
    projectRoots: string[];
    rootPath: string | null;
    loadingFiles: boolean;
    
    // Actions
    setProjectData: (data: FileSystemNode[]) => void;
    setProjectRoots: (roots: string[]) => void;
    setRootPath: (path: string | null) => void;
    setLoadingFiles: (loading: boolean) => void;
    addProjectRoot: (root: string) => void;
    removeProjectRoot: (root: string) => void;
}

export const useProjectStore = create<ProjectStoreState>((set) => ({
    // State
    projectData: [],
    projectRoots: [],
    rootPath: null,
    loadingFiles: false,
    
    // Actions
    setProjectData: (data) => set({ projectData: data }),
    setProjectRoots: (roots) => set({ projectRoots: roots }),
    setRootPath: (path) => set({ rootPath: path }),
    setLoadingFiles: (loading) => set({ loadingFiles: loading }),
    addProjectRoot: (root) => set((state) => ({ 
        projectRoots: [...state.projectRoots, root] 
    })),
    removeProjectRoot: (root) => set((state) => ({ 
        projectRoots: state.projectRoots.filter(r => r !== root) 
    }))
}));
