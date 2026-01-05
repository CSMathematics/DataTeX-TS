import { useState, useCallback } from 'react';
import { TreeNode, TreeState, TreeStateActions } from './types';

/**
 * Custom hook for shared tree state management.
 * Used by both Explorer and Database sidebars.
 */
export function useTreeState<T extends TreeNode = TreeNode>(): TreeState<T> & TreeStateActions {
    // Expand/collapse signals
    const [expandAllSignal, setExpandAllSignal] = useState(0);
    const [collapseAllSignal, setCollapseAllSignal] = useState(0);
    const [isToggleExpanded, setIsToggleExpanded] = useState(false);
    
    // Search and selection
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedNode, setSelectedNode] = useState<T | null>(null);

    /**
     * Trigger expand all - increments signal to notify tree items
     */
    const triggerExpandAll = useCallback(() => {
        setExpandAllSignal(prev => prev + 1);
        setIsToggleExpanded(true);
    }, []);

    /**
     * Trigger collapse all - increments signal to notify tree items
     */
    const triggerCollapseAll = useCallback(() => {
        setCollapseAllSignal(prev => prev + 1);
        setIsToggleExpanded(false);
    }, []);

    /**
     * Toggle between expand all and collapse all
     */
    const toggleExpandState = useCallback(() => {
        if (isToggleExpanded) {
            setCollapseAllSignal(prev => prev + 1);
        } else {
            setExpandAllSignal(prev => prev + 1);
        }
        setIsToggleExpanded(prev => !prev);
    }, [isToggleExpanded]);

    /**
     * Filter tree nodes recursively based on search query.
     * Returns nodes that match the query or have matching descendants.
     */
    const filterNodes = useCallback(<N extends TreeNode>(nodes: N[], query: string): N[] => {
        if (!query) return nodes;
        
        const lowerQuery = query.toLowerCase();
        
        return nodes.reduce((acc: N[], node) => {
            const nameMatches = node.name.toLowerCase().includes(lowerQuery);
            let filteredChildren: TreeNode[] | undefined;
            
            if (node.children && node.children.length > 0) {
                filteredChildren = filterNodes(node.children as N[], query);
            }
            
            // Include node if:
            // 1. Its name matches, or
            // 2. Any of its descendants match
            if (nameMatches || (filteredChildren && filteredChildren.length > 0)) {
                acc.push({
                    ...node,
                    children: filteredChildren || node.children
                });
            }
            
            return acc;
        }, []);
    }, []);

    return {
        // State
        expandAllSignal,
        collapseAllSignal,
        isToggleExpanded,
        searchQuery,
        selectedNode,
        
        // Actions
        setSearchQuery,
        setSelectedNode: setSelectedNode as TreeStateActions['setSelectedNode'],
        triggerExpandAll,
        triggerCollapseAll,
        toggleExpandState,
        filterNodes
    };
}

/**
 * Utility: Sort tree nodes - folders first, then files, alphabetically
 */
export function sortTreeNodes<T extends TreeNode>(nodes: T[]): T[] {
    return [...nodes].sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });
}

/**
 * Utility: Recursively sort all nodes in a tree
 */
export function sortTreeRecursive<T extends TreeNode>(nodes: T[]): T[] {
    return sortTreeNodes(nodes).map(node => ({
        ...node,
        children: node.children ? sortTreeRecursive(node.children as T[]) : undefined
    }));
}
