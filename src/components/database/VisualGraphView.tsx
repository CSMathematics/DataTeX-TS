import React, { useCallback, useRef, useEffect } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { useDatabaseStore } from "../../stores/databaseStore";
import {
  useMantineTheme,
  Text,
  Paper,
  Group,
  Badge,
  Stack,
  Checkbox,
  Slider,
  Select,
  Divider,
  ColorSwatch,
  ActionIcon,
  Tooltip,
  Autocomplete,
  Switch,
  Menu,
} from "@mantine/core";
import {
  IconZoomIn,
  IconZoomOut,
  IconTarget,
  IconSearch,
  IconFileText,
  IconTerminal,
  IconFolder,
  IconEye,
  IconEyeOff,
} from "@tabler/icons-react";
import { invoke } from "@tauri-apps/api/core";

interface VisualGraphViewProps {
  onOpenFile?: (path: string) => void;
}

export const VisualGraphView = ({ onOpenFile }: VisualGraphViewProps) => {
  const theme = useMantineTheme();
  // Granular selectors - prevents re-renders when unrelated state changes
  const fetchGraphLinks = useDatabaseStore((state) => state.fetchGraphLinks);
  const selectResource = useDatabaseStore((state) => state.selectResource);
  const activeResourceId = useDatabaseStore((state) => state.activeResourceId);
  const compileResource = useDatabaseStore((state) => state.compileResource);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [dimensions, setDimensions] = React.useState({
    width: 800,
    height: 600,
  });

  // Context Menu State
  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
    node: any;
  } | null>(null);

  // Filters State
  const [filters, setFilters] = React.useState({
    showPackages: false,
    showBibliographies: false,
    showImages: false,
    showClasses: false,
    showDtx: false,
    showIns: false,
  });

  // Physics State
  const [physics, setPhysics] = React.useState({
    linkDistance: 30,
    chargeStrength: -100,
  });

  const [dagMode, setDagMode] = React.useState<string | null>(null); // null, 'td', 'bu', 'lr', 'rl', 'zout', 'zin', 'radialout', 'radialin'

  // Search & Navigation State
  const [focusMode, setFocusMode] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  const [showControls, setShowControls] = React.useState(true);

  useEffect(() => {
    fetchGraphLinks();
  }, [fetchGraphLinks]);

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });

      const observer = new ResizeObserver((entries) => {
        for (let entry of entries) {
          setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, []);

  // Apply Physics
  useEffect(() => {
    if (graphRef.current) {
      // Apply forces dynamically
      graphRef.current.d3Force("link").distance(physics.linkDistance);
      graphRef.current.d3Force("charge").strength(physics.chargeStrength);
      // Re-heat simulation
      graphRef.current.d3ReheatSimulation();
    }
  }, [physics, graphRef.current]);

  // Graph Data State (fetched from Rust backend)
  const [graphData, setGraphData] = React.useState<{
    nodes: any[];
    links: any[];
  }>({ nodes: [], links: [] });

  // Fetch graph data from Rust backend when filters or loaded collections change
  const loadedCollections = useDatabaseStore(
    (state) => state.loadedCollections
  );

  useEffect(() => {
    let active = true;

    const fetchGraphData = async () => {
      if (loadedCollections.length === 0) {
        setGraphData({ nodes: [], links: [] });
        return;
      }

      try {
        const data = await invoke<{ nodes: any[]; links: any[] }>(
          "get_graph_data_cmd",
          {
            collections: loadedCollections,
            filters: {
              showPackages: filters.showPackages,
              showBibliographies: filters.showBibliographies,
              showImages: filters.showImages,
              showClasses: filters.showClasses,
              showDtx: filters.showDtx,
              showIns: filters.showIns,
            },
          }
        );
        console.log(
          "Graph data from Rust:",
          data,
          "collections:",
          loadedCollections
        );
        if (active) {
          setGraphData(data);
        }
      } catch (err) {
        console.error("Failed to fetch graph data:", err);
      }
    };

    fetchGraphData();

    return () => {
      active = false;
    };
  }, [loadedCollections, filters]);

  // Helper: Get connected nodes for focus mode
  const getNeighbors = useCallback((nodeId: string, links: any[]) => {
    const neighbors = new Set<string>();
    neighbors.add(nodeId);
    links.forEach((link) => {
      const sourceId =
        typeof link.source === "object" ? link.source.id : link.source;
      const targetId =
        typeof link.target === "object" ? link.target.id : link.target;
      if (sourceId === nodeId) neighbors.add(targetId);
      if (targetId === nodeId) neighbors.add(sourceId);
    });
    return neighbors;
  }, []);

  const handleSearch = (val: string) => {
    setSearchValue(val);
    const node = graphData.nodes.find((n) => n.name === val || n.path === val);
    if (node) {
      selectResource(node.id); // This will trigger the focus effect
    }
  };

  // Sync: Focus on active resource
  useEffect(() => {
    if (graphRef.current) {
      if (activeResourceId) {
        const node = graphData.nodes.find(
          (n) => n.id === activeResourceId
        ) as any;
        if (node) {
          // Zoom to node with transition
          graphRef.current.centerAt(node.x, node.y, 1000);
          graphRef.current.zoom(4, 2000);
        }
      } else if (graphData.nodes.length > 0) {
        // Initial Zoom to Fit if nothing selected
        // Small delay to allow layout to settle
        setTimeout(() => {
          if (graphRef.current) {
            graphRef.current.zoomToFit(400, 50);
          }
        }, 500);
      }
    }
  }, [activeResourceId, graphData.nodes.length]);

  // We need to re-run the focus effect if graphData changes and activeResourceId is set
  useEffect(() => {
    if (activeResourceId && graphRef.current) {
      const node = graphData.nodes.find((n) => n.id === activeResourceId);
      if (node) {
        // Optional: re-center
      }
    }
  }, [graphData, activeResourceId]);

  const handleNodeClick = useCallback(
    (node: any) => {
      selectResource(node.id);
      if (onOpenFile && node.path) {
        onOpenFile(node.path);
      }
      // Focus on click
      if (graphRef.current) {
        graphRef.current.centerAt(node.x, node.y, 1000);
        graphRef.current.zoom(4, 2000);
      }
    },
    [onOpenFile, selectResource]
  );

  const getAccentColor = useCallback(() => {
    // Custom accent color override
    if (theme.other?.accentColor) {
      return theme.other.accentColor;
    }
    // Fallback to primary color
    const primary = theme.primaryColor;
    return theme.colors[primary]?.[6] || theme.colors.blue[6];
  }, [theme]);

  const getNodeColor = (kind: string) => {
    switch (kind.toLowerCase()) {
      case "preamble":
        return theme.colors.teal[7];
      case "package":
        return theme.colors.orange[7];
      case "class":
        return theme.colors.violet[7];
      case "bibliography":
        return theme.colors.yellow[7];
      case "image":
        return theme.colors.pink[7];
      case "dtx":
        return theme.colors.cyan[7];
      case "ins":
        return theme.colors.grape[7];
      default:
        return theme.colors.blue[7]; // Standard document
    }
  };

  const legendItems = [
    { label: "Document", color: theme.colors.blue[7] },
    { label: "Preamble", color: theme.colors.teal[7] },
    { label: "Package", color: theme.colors.orange[7] },
    { label: "Class", color: theme.colors.violet[7] },
    { label: "Bibliography", color: theme.colors.yellow[7] },
    { label: "Image", color: theme.colors.pink[7] },
    { label: "DTX", color: theme.colors.cyan[7] },
    { label: "INS", color: theme.colors.grape[7] },
  ];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <Paper
        p="xs"
        style={{
          borderBottom: "1px solid var(--mantine-color-default-border)",
          zIndex: 10,
        }}
      >
        <Group justify="space-between">
          <Text fw={700} size="sm">
            Graph View
          </Text>
          {/* Search Overlay */}
          <Autocomplete
            placeholder="Search file..."
            data={graphData.nodes.map((n) => n.name)}
            value={searchValue}
            onChange={handleSearch}
            leftSection={<IconSearch size={16} />}
            size="xs"
          />
          {/* Zoom Controls */}

          <Group gap={2}>
            <Tooltip label="Zoom In" position="right">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => {
                  if (graphRef.current) {
                    graphRef.current.zoom(graphRef.current.zoom() * 1.2, 400); // 1.2x zoom
                  }
                }}
              >
                <IconZoomIn size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Zoom Out" position="right">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => {
                  if (graphRef.current) {
                    graphRef.current.zoom(graphRef.current.zoom() / 1.2, 400); // 1.2x zoom out
                  }
                }}
              >
                <IconZoomOut size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Fit to View" position="right">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => {
                  if (graphRef.current) {
                    graphRef.current.zoomToFit(400, 50);
                  }
                }}
              >
                <IconTarget size={14} />
              </ActionIcon>
            </Tooltip>
            <Divider my={2} />
            <Tooltip
              label={showControls ? "Hide Controls" : "Show Controls"}
              position="right"
            >
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => setShowControls(!showControls)}
              >
                {showControls ? (
                  <IconEyeOff size={14} />
                ) : (
                  <IconEye size={20} />
                )}
              </ActionIcon>
            </Tooltip>
          </Group>

          <Badge size="xs" variant="light">
            {graphData.nodes.length} nodes, {graphData.links.length} links
          </Badge>
        </Group>
      </Paper>

      {/* Controls Overlay */}
      {showControls && (
        <Paper
          shadow="sm"
          p="xs"
          withBorder
          style={{
            position: "absolute",
            top: 60,
            right: 10,
            zIndex: 100,
            width: 220, // Slightly wider for layout select
            maxHeight: "calc(100% - 80px)", // Prevent overflow
            overflowY: "auto",
            backgroundColor: "var(--mantine-color-body)",
          }}
        >
          <Stack gap="xs">
            <Text size="xs" fw={700} c="dimmed">
              FILTERS
            </Text>
            <Checkbox
              label="Packages"
              size="xs"
              checked={filters.showPackages}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  showPackages: event.currentTarget.checked,
                })
              }
            />
            <Checkbox
              label="Bibliographies"
              size="xs"
              checked={filters.showBibliographies}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  showBibliographies: event.currentTarget.checked,
                })
              }
            />
            <Checkbox
              label="Images"
              size="xs"
              checked={filters.showImages}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  showImages: event.currentTarget.checked,
                })
              }
            />
            <Checkbox
              label="Classes"
              size="xs"
              checked={filters.showClasses}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  showClasses: event.currentTarget.checked,
                })
              }
            />
            <Checkbox
              label="DTX Files"
              size="xs"
              checked={filters.showDtx}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  showDtx: event.currentTarget.checked,
                })
              }
            />
            <Checkbox
              label="INS Files"
              size="xs"
              checked={filters.showIns}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  showIns: event.currentTarget.checked,
                })
              }
            />

            <Divider my="xs" />

            <Text size="xs" fw={700} c="dimmed">
              LAYOUT
            </Text>
            <Select
              size="xs"
              data={[
                { value: "null", label: "Free (Force)" },
                { value: "td", label: "Tree (Top-Down)" },
                { value: "lr", label: "Tree (Left-Right)" },
                { value: "radialout", label: "Radial" },
              ]}
              value={dagMode || "null"}
              onChange={(val) => setDagMode(val === "null" ? null : val)}
              allowDeselect={false}
            />

            <Divider my="xs" />

            <Text size="xs" fw={700} c="dimmed">
              VIEW
            </Text>
            <Group justify="space-between">
              <Text size="xs">Focus Mode</Text>
              <Switch
                size="xs"
                checked={focusMode}
                onChange={(event) => setFocusMode(event.currentTarget.checked)}
              />
            </Group>
            <Divider my="xs" />

            <Text size="xs" fw={700} c="dimmed">
              PHYSICS
            </Text>

            <Text size="xs">Link Distance</Text>
            <Slider
              size="xs"
              min={0}
              max={200}
              value={physics.linkDistance}
              onChange={(val) => setPhysics({ ...physics, linkDistance: val })}
            />

            <Text size="xs">Repulsion</Text>
            <Slider
              size="xs"
              min={-500}
              max={0}
              value={physics.chargeStrength}
              onChange={(val) =>
                setPhysics({ ...physics, chargeStrength: val })
              }
            />
          </Stack>
        </Paper>
      )}

      {/* Legend Overlay */}
      {showControls && (
        <Paper
          shadow="sm"
          p="xs"
          withBorder
          style={{
            position: "absolute",
            top: 60,
            left: 10,
            zIndex: 100,
            backgroundColor: "var(--mantine-color-body)",
            pointerEvents: "none", // Allow clicking through if needed, but usually legend is info only
          }}
        >
          <Stack gap={4}>
            <Text size="xs" fw={700} c="dimmed" mb={2}>
              LEGEND
            </Text>
            {legendItems.map((item) => (
              <Group key={item.label} gap="xs">
                <ColorSwatch color={item.color} size={10} />
                <Text size="xs">{item.label}</Text>
              </Group>
            ))}
            <Divider my={4} />
            <Group gap="xs">
              <div
                style={{
                  width: 20,
                  height: 1,
                  backgroundColor: theme.colors.gray[5],
                }}
              ></div>
              <Text size="xs">Dependency</Text>
            </Group>
            <Group gap="xs">
              <div
                style={{
                  width: 20,
                  height: 1,
                  borderTop: `1px dashed ${theme.colors.gray[5]}`,
                }}
              ></div>
              <Text size="xs">Package</Text>
            </Group>
            <Group gap="xs">
              <div
                style={{
                  width: 20,
                  height: 1,
                  borderTop: `1px dotted ${theme.colors.gray[5]}`,
                }}
              ></div>
              <Text size="xs">Bibliography</Text>
            </Group>
          </Stack>
        </Paper>
      )}

      <div ref={containerRef} style={{ flex: 1, overflow: "hidden" }}>
        <ForceGraph2D
          ref={graphRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={graphData}
          dagMode={dagMode as any}
          nodeCanvasObject={(
            node: any,
            ctx: CanvasRenderingContext2D,
            globalScale: number
          ) => {
            // Node Sizing Application
            const sizeMult = Math.sqrt(node.val || 1);

            const label = node.name;
            const fontSize = (12 * sizeMult) / globalScale; // Scale font with centrality
            ctx.font = `${fontSize}px Sans-Serif`;
            const textWidth = ctx.measureText(label).width;
            const bckgDimensions = [textWidth + fontSize * 2, fontSize * 2]; // Increased padding

            // Highlight if active
            const isActive = node.id === activeResourceId;

            // Focus Mode Logic
            let opacity = 1.0;
            if (focusMode && activeResourceId) {
              const neighbors = getNeighbors(activeResourceId, graphData.links);
              if (!neighbors.has(node.id)) {
                opacity = 0.1;
              }
            }

            const color = getNodeColor(node.kind || "document");

            // Begin path is CRITICAL to prevent ghosting/trails
            ctx.beginPath();

            // Calculate position
            const x = node.x - bckgDimensions[0] / 2;
            const y = node.y - bckgDimensions[1] / 2;

            // Draw Shape
            if (ctx.roundRect) {
              ctx.roundRect(
                x,
                y,
                bckgDimensions[0],
                bckgDimensions[1],
                4 * sizeMult
              );
            } else {
              ctx.rect(x, y, bckgDimensions[0], bckgDimensions[1]);
            }

            // Fill with opacity
            const accentColor = getAccentColor();
            ctx.globalAlpha = (isActive ? 0.8 : 0.5) * opacity;
            ctx.fillStyle = isActive ? accentColor : color; // Highlight background if active
            ctx.fill();

            // Border with full opacity
            ctx.globalAlpha = 1.0 * opacity;
            ctx.strokeStyle = isActive ? accentColor : color;
            ctx.lineWidth = (isActive ? 3 : 1.5) / globalScale; // Thicker border if active
            ctx.stroke();

            // Draw Text
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = opacity < 0.5 ? "rgba(255,255,255,0.1)" : "white";
            ctx.fillText(label, node.x, node.y);

            // Interaction area
            node.__bckgDimensions = bckgDimensions;
          }}
          nodePointerAreaPaint={(
            node: any,
            color: string,
            ctx: CanvasRenderingContext2D
          ) => {
            // Must match the shape drawn in nodeCanvasObject for correct hover detection
            ctx.fillStyle = color;
            const bckgDimensions = node.__bckgDimensions;
            if (bckgDimensions) {
              ctx.fillRect(
                node.x - bckgDimensions[0] / 2,
                node.y - bckgDimensions[1] / 2,
                bckgDimensions[0],
                bckgDimensions[1]
              );
            }
          }}
          onNodeClick={handleNodeClick}
          onNodeRightClick={(node: any, event: any) => {
            // event is the interaction event.
            setContextMenu({ x: event.clientX, y: event.clientY, node });
          }}
          onNodeHover={(node: any) => {
            if (node) {
              if (containerRef.current)
                containerRef.current.style.cursor = "pointer";
            } else {
              if (containerRef.current)
                containerRef.current.style.cursor = "default";
            }
          }}
          nodeLabel={(node: any) => {
            const connections = (
              graphData.links.filter((l) => {
                const s =
                  typeof l.source === "object"
                    ? (l.source as any).id
                    : l.source;
                const t =
                  typeof l.target === "object"
                    ? (l.target as any).id
                    : l.target;
                return s === node.id || t === node.id;
              }) || []
            ).length;
            return `Title: ${node.name}\nType: ${
              node.kind || "file"
            }\nCollection: ${node.collection}\nPath: ${
              node.path
            }\nConnections: ${connections}`;
          }}
          linkColor={(link: any) => {
            if (focusMode && activeResourceId) {
              const s =
                typeof link.source === "object" ? link.source.id : link.source;
              const t =
                typeof link.target === "object" ? link.target.id : link.target;

              if (s === activeResourceId || t === activeResourceId)
                return theme.colors.gray[4];
              return "rgba(0,0,0,0.02)"; // Fade others
            }
            return theme.colors.gray[4];
          }}
          linkLineDash={(link: any) => {
            if (link.type === "package") return [5, 5];
            if (link.type === "bibliography") return [2, 2];
            if (link.type === "image") return [4, 2];
            return null; // Solid
          }}
          backgroundColor="var(--mantine-color-body)"
        />
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <Menu
          opened={true}
          onClose={() => setContextMenu(null)}
          shadow="md"
          width={200}
        >
          <Menu.Dropdown
            style={{
              position: "fixed",
              left: contextMenu.x,
              top: contextMenu.y,
              zIndex: 1000,
            }}
          >
            <Menu.Label>{contextMenu.node.name}</Menu.Label>
            <Menu.Item
              leftSection={<IconFileText size={14} />}
              onClick={() => {
                if (onOpenFile) onOpenFile(contextMenu.node.path);
                setContextMenu(null);
              }}
            >
              Open File
            </Menu.Item>
            <Menu.Item
              leftSection={<IconTerminal size={14} />}
              disabled={!contextMenu.node.path.endsWith(".tex")}
              onClick={() => {
                if (compileResource) compileResource(contextMenu.node.id);
                setContextMenu(null);
              }}
            >
              Compile
            </Menu.Item>
            <Menu.Item
              leftSection={<IconFolder size={14} />}
              onClick={() => {
                invoke("reveal_path_cmd", { path: contextMenu.node.path });
                setContextMenu(null);
              }}
            >
              Reveal in Folder
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )}
    </div>
  );
};
