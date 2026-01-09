import { useState, useRef, useCallback, useEffect, RefObject } from "react";

interface UseAppPanelResizeOptions {
  initialSidebarWidth?: number;
  initialRightPanelWidth?: number;
  initialDatabasePanelWidth?: number;
}

interface UseAppPanelResizeReturn {
  // Widths
  sidebarWidth: number;
  rightPanelWidth: number;
  databasePanelWidth: number;

  // Width setters (for external control)
  setSidebarWidth: React.Dispatch<React.SetStateAction<number>>;
  setRightPanelWidth: React.Dispatch<React.SetStateAction<number>>;
  setDatabasePanelWidth: React.Dispatch<React.SetStateAction<number>>;

  // Resizing state
  isResizing: boolean;

  // Ghost element ref (for visual feedback during resize)
  ghostRef: RefObject<HTMLDivElement | null>;

  // Start resize handlers
  startResizeSidebar: (e: React.MouseEvent) => void;
  startResizeRightPanel: (e: React.MouseEvent) => void;
  startResizeDatabase: (e: React.MouseEvent) => void;
}

/**
 * Specialized resize hook for App.tsx panel layout.
 * Handles sidebar, right panel (PDF viewer), and database panel resizing
 * with ghost element visual feedback.
 *
 * @example
 * const {
 *   sidebarWidth,
 *   rightPanelWidth,
 *   ghostRef,
 *   startResizeSidebar,
 *   ...
 * } = useAppPanelResize({ initialSidebarWidth: 300 });
 */
export function useAppPanelResize({
  initialSidebarWidth = 300,
  initialRightPanelWidth = 600,
  initialDatabasePanelWidth = 400,
}: UseAppPanelResizeOptions = {}): UseAppPanelResizeReturn {
  // Panel widths
  const [sidebarWidth, setSidebarWidth] = useState(initialSidebarWidth);
  const [rightPanelWidth, setRightPanelWidth] = useState(
    initialRightPanelWidth
  );
  const [databasePanelWidth, setDatabasePanelWidth] = useState(
    initialDatabasePanelWidth
  );

  // Resizing states
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingRightPanel, setIsResizingRightPanel] = useState(false);
  const [isResizingDatabase, setIsResizingDatabase] = useState(false);

  // Refs
  const rafRef = useRef<number | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);

  // Start handlers
  const startResizeSidebar = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingSidebar(true);
    if (ghostRef.current) {
      ghostRef.current.style.display = "block";
      ghostRef.current.style.left = `${e.clientX}px`;
    }
  }, []);

  const startResizeRightPanel = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingRightPanel(true);
    if (ghostRef.current) {
      ghostRef.current.style.display = "block";
      ghostRef.current.style.left = `${e.clientX}px`;
    }
  }, []);

  const startResizeDatabase = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingDatabase(true);
    if (ghostRef.current) {
      ghostRef.current.style.display = "block";
      ghostRef.current.style.left = `${e.clientX}px`;
    }
  }, []);

  // Sync CSS variables
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-width",
      `${sidebarWidth}px`
    );
  }, [sidebarWidth]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--right-panel-width",
      `${rightPanelWidth}px`
    );
  }, [rightPanelWidth]);

  // Mouse move/up handlers
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        if (isResizingSidebar) {
          const x = Math.max(200, Math.min(650, e.clientX));
          if (ghostRef.current) ghostRef.current.style.left = `${x}px`;
        }
        if (isResizingRightPanel) {
          const minX = window.innerWidth - 1200;
          const maxX = window.innerWidth - 300;
          const x = Math.max(minX, Math.min(maxX, e.clientX));
          if (ghostRef.current) ghostRef.current.style.left = `${x}px`;
        }
        if (isResizingDatabase) {
          const x = Math.max(250, Math.min(window.innerWidth * 0.6, e.clientX));
          if (ghostRef.current) ghostRef.current.style.left = `${x}px`;
        }
        rafRef.current = null;
      });
    };

    const up = () => {
      if (isResizingSidebar && ghostRef.current) {
        const x = parseInt(ghostRef.current.style.left || "0", 10);
        if (x > 0) {
          const w = Math.max(150, Math.min(600, x - 50));
          setSidebarWidth(w);
        }
        ghostRef.current.style.display = "none";
      }
      if (isResizingRightPanel && ghostRef.current) {
        const x = parseInt(ghostRef.current.style.left || "0", 10);
        if (x > 0) {
          const newWidth = window.innerWidth - x;
          const w = Math.max(300, Math.min(1200, newWidth));
          setRightPanelWidth(w);
        }
        ghostRef.current.style.display = "none";
      }
      if (isResizingDatabase && ghostRef.current) {
        const x = parseInt(ghostRef.current.style.left || "0", 10);
        if (x > 0) {
          // Note: sidebarWidth dependency removed - caller can adjust if needed
          const w = Math.max(250, Math.min(window.innerWidth * 0.6, x - 50));
          setDatabasePanelWidth(w);
        }
        ghostRef.current.style.display = "none";
      }

      setIsResizingSidebar(false);
      setIsResizingRightPanel(false);
      setIsResizingDatabase(false);

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };

    const isAnyResizing =
      isResizingSidebar || isResizingRightPanel || isResizingDatabase;

    if (isAnyResizing) {
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
      document.body.style.cursor = "col-resize";
    } else {
      document.body.style.cursor = "default";
    }

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [isResizingSidebar, isResizingRightPanel, isResizingDatabase]);

  const isResizing =
    isResizingSidebar || isResizingRightPanel || isResizingDatabase;

  return {
    sidebarWidth,
    rightPanelWidth,
    databasePanelWidth,
    setSidebarWidth,
    setRightPanelWidth,
    setDatabasePanelWidth,
    isResizing,
    ghostRef,
    startResizeSidebar,
    startResizeRightPanel,
    startResizeDatabase,
  };
}
