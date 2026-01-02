import { useState, useEffect, useCallback, useRef, RefObject } from 'react';

interface UseResizableOptions {
    /** Direction of resize: 'horizontal' for width, 'vertical' for height */
    direction: 'horizontal' | 'vertical';
    /** Minimum size as percentage (0-100) or pixels */
    minSize?: number;
    /** Maximum size as percentage (0-100) or pixels */
    maxSize?: number;
    /** Initial size as percentage (0-100) */
    initialSize?: number;
    /** Whether to use percentage (true) or pixels (false) */
    usePercentage?: boolean;
}

interface UseResizableReturn {
    /** Current size (percentage or pixels based on usePercentage) */
    size: number;
    /** Whether currently resizing */
    isResizing: boolean;
    /** Start resizing handler - attach to onMouseDown of handle */
    startResizing: (e: React.MouseEvent) => void;
    /** Ref for the container element that will be measured */
    containerRef: RefObject<HTMLDivElement | null>;
    /** Style object for the resize handle */
    handleStyle: React.CSSProperties;
}

/**
 * Hook for creating resizable panels with mouse drag support.
 * 
 * @example
 * const { size, isResizing, startResizing, containerRef, handleStyle } = useResizable({
 *     direction: 'vertical',
 *     initialSize: 55,
 *     minSize: 20,
 *     maxSize: 80
 * });
 */
export function useResizable({
    direction,
    minSize = 10,
    maxSize = 90,
    initialSize = 50,
    usePercentage = true
}: UseResizableOptions): UseResizableReturn {
    const [size, setSize] = useState(initialSize);
    const [isResizing, setIsResizing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || !containerRef.current) return;

            const rect = containerRef.current.getBoundingClientRect();
            
            let newSize: number;
            if (direction === 'horizontal') {
                if (usePercentage) {
                    newSize = ((e.clientX - rect.left) / rect.width) * 100;
                } else {
                    newSize = e.clientX - rect.left;
                }
            } else {
                if (usePercentage) {
                    newSize = ((e.clientY - rect.top) / rect.height) * 100;
                } else {
                    newSize = e.clientY - rect.top;
                }
            }

            // Clamp to min/max
            newSize = Math.max(minSize, Math.min(newSize, maxSize));
            setSize(newSize);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, direction, minSize, maxSize, usePercentage]);

    const handleStyle: React.CSSProperties = {
        width: direction === 'horizontal' ? 6 : '100%',
        height: direction === 'vertical' ? 6 : '100%',
        backgroundColor: isResizing 
            ? 'var(--mantine-color-blue-6)' 
            : 'var(--mantine-color-dark-6)',
        cursor: direction === 'horizontal' ? 'col-resize' : 'row-resize',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 0.2s'
    };

    return {
        size,
        isResizing,
        startResizing,
        containerRef,
        handleStyle
    };
}
