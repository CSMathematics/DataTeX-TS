import { useState, useRef, useCallback, useEffect, RefObject } from "react";

interface UseAppPanelResizeOptions {
  initialSidebarWidth?: number;
  initialRightPanelWidth?: number;
  initialDatabasePanelWidth?: number;
  initialDatabasePanelHeight?: number;
  isSidebarOpen?: boolean;
}

interface UseAppPanelResizeReturn {
  // Widths/Heights
  sidebarWidth: number;
  rightPanelWidth: number;
  databasePanelWidth: number;
  databasePanelHeight: number;

  // Setters
  setSidebarWidth: React.Dispatch<React.SetStateAction<number>>;
  setRightPanelWidth: React.Dispatch<React.SetStateAction<number>>;
  setDatabasePanelWidth: React.Dispatch<React.SetStateAction<number>>;
  setDatabasePanelHeight: React.Dispatch<React.SetStateAction<number>>;

  // Resizing state
  isResizing: boolean;

  // Ghost element ref (for visual feedback during resize)
  ghostRef: RefObject<HTMLDivElement | null>;

  // Start resize handlers
  startResizeSidebar: (e: React.MouseEvent) => void;
  startResizeRightPanel: (e: React.MouseEvent) => void;
  startResizeDatabase: (e: React.MouseEvent) => void;
  startResizeDatabaseHeight: (e: React.MouseEvent) => void;
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
  initialDatabasePanelHeight = 300,
  isSidebarOpen = false,
}: UseAppPanelResizeOptions = {}): UseAppPanelResizeReturn {
  // Panel dimensions
  const [sidebarWidth, setSidebarWidth] = useState(initialSidebarWidth);
  const [rightPanelWidth, setRightPanelWidth] = useState(
    initialRightPanelWidth
  );
  const [databasePanelWidth, setDatabasePanelWidth] = useState(
    initialDatabasePanelWidth
  );
  const [databasePanelHeight, setDatabasePanelHeight] = useState(
    initialDatabasePanelHeight
  );

  // Resizing states
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingRightPanel, setIsResizingRightPanel] = useState(false);
  const [isResizingDatabase, setIsResizingDatabase] = useState(false);
  const [isResizingDatabaseHeight, setIsResizingDatabaseHeight] =
    useState(false);

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
      ghostRef.current.style.width = "4px";
      ghostRef.current.style.height = "100%";
      ghostRef.current.style.top = "0";
      ghostRef.current.style.left = `${e.clientX}px`;
      ghostRef.current.style.cursor = "col-resize";
    }
  }, []);

  const startResizeDatabaseHeight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingDatabaseHeight(true);
    if (ghostRef.current) {
      ghostRef.current.style.display = "block";
      ghostRef.current.style.height = "4px";
      ghostRef.current.style.width = "100%";
      ghostRef.current.style.left = "0";
      ghostRef.current.style.top = `${e.clientY}px`;
      ghostRef.current.style.cursor = "row-resize";
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

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--database-panel-width",
      `${databasePanelWidth}px`
    );
  }, [databasePanelWidth]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--database-panel-height",
      `${databasePanelHeight}px`
    );
  }, [databasePanelHeight]);

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
        if (isResizingDatabaseHeight) {
          // Bottom panel resizing (drag up/down).
          const minY = 100;
          const maxY = window.innerHeight - 100;
          const y = Math.max(minY, Math.min(maxY, e.clientY));
          if (ghostRef.current) ghostRef.current.style.top = `${y}px`;
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
          // Calculate offset based on sidebar state
          const sidebarOffset = isSidebarOpen ? sidebarWidth + 50 : 50;
          const w = Math.max(
            250,
            Math.min(window.innerWidth * 0.6, x - sidebarOffset)
          );
          setDatabasePanelWidth(w);
        }
        ghostRef.current.style.display = "none";
      }
      if (isResizingDatabaseHeight && ghostRef.current) {
        const y = parseInt(ghostRef.current.style.top || "0", 10);
        if (y > 0) {
          const h = Math.max(
            100,
            Math.min(window.innerHeight - 100, window.innerHeight - y)
          );
          setDatabasePanelHeight(h);
        }
        ghostRef.current.style.display = "none";
      }

      setIsResizingSidebar(false);
      setIsResizingRightPanel(false);
      setIsResizingDatabase(false);
      setIsResizingDatabaseHeight(false);

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };

    const isAnyResizing =
      isResizingSidebar ||
      isResizingRightPanel ||
      isResizingDatabase ||
      isResizingDatabaseHeight;

    if (isAnyResizing) {
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
      document.body.style.cursor = isResizingDatabaseHeight
        ? "row-resize"
        : "col-resize";
    } else {
      document.body.style.cursor = "default";
    }

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [
    isResizingSidebar,
    isResizingRightPanel,
    isResizingDatabase,
    isResizingDatabaseHeight,
    isSidebarOpen,
    sidebarWidth,
  ]);

  const isResizing =
    isResizingSidebar ||
    isResizingRightPanel ||
    isResizingDatabase ||
    isResizingDatabaseHeight;

  return {
    sidebarWidth,
    rightPanelWidth,
    databasePanelWidth,
    databasePanelHeight,
    setSidebarWidth,
    setRightPanelWidth,
    setDatabasePanelWidth,
    setDatabasePanelHeight,
    isResizing,
    ghostRef,
    startResizeSidebar,
    startResizeRightPanel,
    startResizeDatabase,
    startResizeDatabaseHeight,
  };
}
