import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// Re-export the AppTab type for external use
export interface AppTab {
    id: string;
    title: string;
    type: 'editor' | 'start-page' | 'settings' | 'wizard' | 'table';
    content?: string;
    tableName?: string;
    language?: string;
    isDirty?: boolean;
}

interface TabsState {
    // State
    tabs: AppTab[];
    activeTabId: string;

    // Actions
    openTab: (tab: AppTab) => void;
    closeTab: (id: string) => boolean; // returns false if needs confirmation
    closeTabsById: (ids: string[]) => void;
    setActiveTab: (id: string) => void;
    updateTabContent: (id: string, content: string) => void;
    markDirty: (id: string, isDirty: boolean) => void;
    renameTab: (oldId: string, newId: string, newTitle: string) => void;
    
    // Derived selectors (computed from state)
    getActiveTab: () => AppTab | undefined;
    getTabById: (id: string) => AppTab | undefined;
    hasTab: (id: string) => boolean;
}

export const useTabsStore = create<TabsState>()(
    subscribeWithSelector((set, get) => ({
        // Initial state
        tabs: [{ id: 'start-page', title: 'Start Page', type: 'start-page' }],
        activeTabId: 'start-page',

        // Open a new tab or switch to existing
        openTab: (tab: AppTab) => {
            const { tabs } = get();
            const existing = tabs.find(t => t.id === tab.id);
            
            if (existing) {
                set({ activeTabId: tab.id });
            } else {
                set({
                    tabs: [...tabs, tab],
                    activeTabId: tab.id
                });
            }
        },

        // Close a tab - returns false if tab has unsaved changes
        closeTab: (id: string) => {
            const { tabs, activeTabId } = get();
            const tab = tabs.find(t => t.id === id);
            
            if (tab?.isDirty) {
                // Caller should handle confirmation dialog
                return false;
            }

            const newTabs = tabs.filter(t => t.id !== id);
            
            // If we're closing the active tab, switch to another
            let newActiveId = activeTabId;
            if (activeTabId === id && newTabs.length > 0) {
                newActiveId = newTabs[newTabs.length - 1].id;
            } else if (newTabs.length === 0) {
                // Re-open start page if all tabs closed
                const startPageTab: AppTab = { id: 'start-page', title: 'Start Page', type: 'start-page' };
                set({
                    tabs: [startPageTab],
                    activeTabId: 'start-page'
                });
                return true;
            }

            set({
                tabs: newTabs,
                activeTabId: newActiveId
            });
            return true;
        },

        // Force close multiple tabs (bypasses dirty check)
        closeTabsById: (ids: string[]) => {
            const { tabs, activeTabId } = get();
            const newTabs = tabs.filter(t => !ids.includes(t.id));
            
            let newActiveId = activeTabId;
            if (ids.includes(activeTabId)) {
                if (newTabs.length > 0) {
                    newActiveId = newTabs[newTabs.length - 1].id;
                } else {
                    const startPageTab: AppTab = { id: 'start-page', title: 'Start Page', type: 'start-page' };
                    set({
                        tabs: [startPageTab],
                        activeTabId: 'start-page'
                    });
                    return;
                }
            }

            set({
                tabs: newTabs,
                activeTabId: newActiveId
            });
        },

        // Switch active tab
        setActiveTab: (id: string) => {
            const { tabs } = get();
            if (tabs.some(t => t.id === id)) {
                set({ activeTabId: id });
            }
        },

        // Update tab content (used when syncing from editor)
        updateTabContent: (id: string, content: string) => {
            set(state => ({
                tabs: state.tabs.map(t =>
                    t.id === id ? { ...t, content } : t
                )
            }));
        },

        // Mark tab as dirty/clean
        markDirty: (id: string, isDirty: boolean) => {
            set(state => ({
                tabs: state.tabs.map(t =>
                    t.id === id && t.isDirty !== isDirty ? { ...t, isDirty } : t
                )
            }));
        },

        // Rename tab (used after file rename)
        renameTab: (oldId: string, newId: string, newTitle: string) => {
            const { activeTabId } = get();
            set(state => ({
                tabs: state.tabs.map(t =>
                    t.id === oldId ? { ...t, id: newId, title: newTitle } : t
                ),
                activeTabId: activeTabId === oldId ? newId : activeTabId
            }));
        },

        // Selectors
        getActiveTab: () => {
            const { tabs, activeTabId } = get();
            return tabs.find(t => t.id === activeTabId);
        },

        getTabById: (id: string) => {
            return get().tabs.find(t => t.id === id);
        },

        hasTab: (id: string) => {
            return get().tabs.some(t => t.id === id);
        }
    }))
);

// Selector hooks for optimized subscriptions
export const useActiveTab = () => useTabsStore(state => 
    state.tabs.find(t => t.id === state.activeTabId)
);

export const useIsTexFile = () => useTabsStore(state => {
    const activeTab = state.tabs.find(t => t.id === state.activeTabId);
    return activeTab?.title.toLowerCase().endsWith('.tex') ?? false;
});
