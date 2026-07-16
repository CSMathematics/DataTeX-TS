import { useLayoutEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useResizeDrag } from "./useResizeDrag";

interface UseAppPanelResizeOptions {
  initialSidebarWidth?: number;
  initialRightPanelWidth?: number;
  initialDatabasePanelWidth?: number;
  initialDatabasePanelHeight?: number;
}

interface UseAppPanelResizeReturn {
  startResizeSidebar: (event: ReactPointerEvent<HTMLElement>) => void;
  startResizeRightPanel: (event: ReactPointerEvent<HTMLElement>) => void;
  startResizeDatabase: (event: ReactPointerEvent<HTMLElement>) => void;
  startResizeDatabaseHeight: (event: ReactPointerEvent<HTMLElement>) => void;
}

interface HorizontalBounds {
  startPointer: number;
  startSize: number;
  min: number;
  max: number;
  multiplier: 1 | -1;
}

interface RightPanelBounds extends HorizontalBounds {
  panel: HTMLElement | null;
  currentSize: number;
}

interface VerticalBounds {
  startPointer: number;
  startSize: number;
  min: number;
  max: number;
  multiplier: 1 | -1;
}

interface DatabaseHeightBounds extends VerticalBounds {
  layout: HTMLElement | null;
  panel: HTMLElement | null;
  currentSize: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, Math.max(min, max)));

const setPanelSize = (property: string, value: number) => {
  document.documentElement.style.setProperty(property, `${value}px`);
};

/**
 * Drives the four top-level panel splitters without rendering App during a
 * drag. Heavy right and bottom panels are updated directly because writing an
 * inherited root custom property every frame invalidates styles throughout
 * the application.
 */
export function useAppPanelResize({
  initialSidebarWidth = 300,
  initialRightPanelWidth = 600,
  initialDatabasePanelWidth = 400,
  initialDatabasePanelHeight = 300,
}: UseAppPanelResizeOptions = {}): UseAppPanelResizeReturn {
  const sidebarBoundsRef = useRef<HorizontalBounds>({
    startPointer: 0,
    startSize: initialSidebarWidth,
    min: 150,
    max: 600,
    multiplier: 1,
  });
  const rightPanelBoundsRef = useRef<RightPanelBounds>({
    startPointer: 0,
    startSize: initialRightPanelWidth,
    min: 300,
    max: 1200,
    multiplier: -1,
    panel: null,
    currentSize: initialRightPanelWidth,
  });
  const databaseBoundsRef = useRef<HorizontalBounds>({
    startPointer: 0,
    startSize: initialDatabasePanelWidth,
    min: 250,
    max: 800,
    multiplier: 1,
  });
  const databaseHeightBoundsRef = useRef<DatabaseHeightBounds>({
    startPointer: 0,
    startSize: initialDatabasePanelHeight,
    min: 100,
    max: Math.max(100, window.innerHeight * 0.8),
    multiplier: -1,
    layout: null,
    panel: null,
    currentSize: initialDatabasePanelHeight,
  });

  useLayoutEffect(() => {
    setPanelSize("--sidebar-width", initialSidebarWidth);
    setPanelSize("--right-panel-width", initialRightPanelWidth);
    setPanelSize("--database-panel-width", initialDatabasePanelWidth);
    setPanelSize("--database-panel-height", initialDatabasePanelHeight);
  }, [
    initialSidebarWidth,
    initialRightPanelWidth,
    initialDatabasePanelWidth,
    initialDatabasePanelHeight,
  ]);

  const sidebarDrag = useResizeDrag({
    cursor: "col-resize",
    onStart: (event) => {
      const handle = event.currentTarget;
      const content = handle.previousElementSibling as HTMLElement | null;
      const sidebar = handle.parentElement;
      const center = sidebar?.nextElementSibling as HTMLElement | null;
      if (!sidebar || !content) return false;

      const startSize = content.getBoundingClientRect().width;
      const centerWidth = center?.getBoundingClientRect().width ?? 300;
      sidebarBoundsRef.current = {
        startPointer: event.clientX,
        startSize,
        min: Math.min(150, startSize),
        max: Math.max(
          startSize,
          Math.min(600, Math.max(150, startSize + centerWidth - 250)),
        ),
        multiplier: 1,
      };
      return true;
    },
    onMove: ({ clientX }) => {
      const bounds = sidebarBoundsRef.current;
      setPanelSize(
        "--sidebar-width",
        clamp(
          bounds.startSize +
            (clientX - bounds.startPointer) * bounds.multiplier,
          bounds.min,
          bounds.max,
        ),
      );
    },
  });

  const rightPanelDrag = useResizeDrag({
    cursor: "col-resize",
    onStart: (event) => {
      const parent = event.currentTarget.parentElement;
      const panel = event.currentTarget.nextElementSibling as HTMLElement | null;
      const center = event.currentTarget
        .previousElementSibling as HTMLElement | null;
      if (!parent || !panel) return false;

      const startSize = panel.getBoundingClientRect().width;
      const centerWidth = center?.getBoundingClientRect().width ?? 250;
      rightPanelBoundsRef.current = {
        startPointer: event.clientX,
        startSize,
        min: Math.min(300, startSize),
        max: Math.max(
          startSize,
          Math.min(1200, Math.max(300, startSize + centerWidth - 250)),
        ),
        multiplier: -1,
        panel,
        currentSize: startSize,
      };

      // Keep the expensive inspector/PDF subtree at its current layout size
      // while only the lightweight outer viewport follows the pointer.
      panel.style.setProperty("--right-panel-frozen-width", `${startSize}px`);
      panel.setAttribute("data-resizing", "");
      return true;
    },
    onMove: ({ clientX }) => {
      const bounds = rightPanelBoundsRef.current;
      const nextSize = clamp(
        bounds.startSize +
          (clientX - bounds.startPointer) * bounds.multiplier,
        bounds.min,
        bounds.max,
      );
      bounds.currentSize = nextSize;
      bounds.panel?.style.setProperty("width", `${nextSize}px`);
    },
    onEnd: () => {
      const bounds = rightPanelBoundsRef.current;
      const { panel } = bounds;

      // Persist once after the drag. This single root write avoids global
      // per-frame invalidation and keeps the width when the panel is hidden
      // and later mounted again.
      setPanelSize("--right-panel-width", bounds.currentSize);

      if (panel) {
        panel.style.removeProperty("width");
        panel.removeAttribute("data-resizing");
        panel.style.removeProperty("--right-panel-frozen-width");
      }
      bounds.panel = null;
    },
  });

  const databaseDrag = useResizeDrag({
    cursor: "col-resize",
    onStart: (event) => {
      const parent = event.currentTarget.parentElement;
      const panel = event.currentTarget
        .previousElementSibling as HTMLElement | null;
      const editor = event.currentTarget.nextElementSibling as HTMLElement | null;
      if (!parent || !panel) return false;

      const startSize = panel.getBoundingClientRect().width;
      const editorWidth = editor?.getBoundingClientRect().width ?? 250;
      databaseBoundsRef.current = {
        startPointer: event.clientX,
        startSize,
        min: Math.min(250, startSize),
        max: Math.max(
          startSize,
          Math.min(800, Math.max(250, startSize + editorWidth - 250)),
        ),
        multiplier: 1,
      };
      return true;
    },
    onMove: ({ clientX }) => {
      const bounds = databaseBoundsRef.current;
      setPanelSize(
        "--database-panel-width",
        clamp(
          bounds.startSize +
            (clientX - bounds.startPointer) * bounds.multiplier,
          bounds.min,
          bounds.max,
        ),
      );
    },
  });

  const databaseHeightDrag = useResizeDrag({
    cursor: "row-resize",
    onStart: (event) => {
      const layout = event.currentTarget.parentElement;
      const editor = event.currentTarget
        .previousElementSibling as HTMLElement | null;
      const panel = event.currentTarget.nextElementSibling as HTMLElement | null;
      if (!layout || !editor || !panel) return false;

      const rect = layout.getBoundingClientRect();
      const handleHeight = event.currentTarget.getBoundingClientRect().height;
      const editorHeight = editor.clientHeight;
      const startSize = panel.getBoundingClientRect().height;
      const contentHeight =
        panel.firstElementChild?.getBoundingClientRect().height ??
        panel.clientHeight;
      databaseHeightBoundsRef.current = {
        startPointer: event.clientY,
        startSize,
        min: Math.min(100, startSize),
        max: Math.max(
          startSize,
          Math.min(
            rect.height * 0.8,
            Math.max(100, rect.height - 100 - handleHeight),
          ),
        ),
        multiplier: -1,
        layout,
        panel,
        currentSize: startSize,
      };

      // Monaco, the full database table and the graph view all observe their
      // container size. Keep both expensive subtrees at their starting
      // dimensions while only the lightweight outer split follows the drag.
      layout.style.setProperty(
        "--database-editor-frozen-height",
        `${editorHeight}px`,
      );
      layout.style.setProperty(
        "--database-content-frozen-height",
        `${contentHeight}px`,
      );
      layout.setAttribute("data-resizing", "");
      return true;
    },
    onMove: ({ clientY }) => {
      const bounds = databaseHeightBoundsRef.current;
      const nextSize = clamp(
        bounds.startSize +
          (clientY - bounds.startPointer) * bounds.multiplier,
        bounds.min,
        bounds.max,
      );
      bounds.currentSize = nextSize;
      bounds.panel?.style.setProperty("height", `${nextSize}px`);
    },
    onEnd: () => {
      const bounds = databaseHeightBoundsRef.current;
      const { layout, panel } = bounds;

      // Persist once after the drag, then release the frozen descendants for
      // one final Monaco/table/graph layout at the committed height.
      setPanelSize("--database-panel-height", bounds.currentSize);
      panel?.style.removeProperty("height");

      if (layout) {
        layout.removeAttribute("data-resizing");
        layout.style.removeProperty("--database-editor-frozen-height");
        layout.style.removeProperty("--database-content-frozen-height");
      }

      bounds.layout = null;
      bounds.panel = null;
    },
  });

  return {
    startResizeSidebar: sidebarDrag.startResizing,
    startResizeRightPanel: rightPanelDrag.startResizing,
    startResizeDatabase: databaseDrag.startResizing,
    startResizeDatabaseHeight: databaseHeightDrag.startResizing,
  };
}
