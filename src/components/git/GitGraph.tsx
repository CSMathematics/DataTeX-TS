import React, { useMemo } from "react";
import { Box, Text } from "@mantine/core";
import { formatDistanceToNow } from "date-fns";

// Types
export interface GitCommitInfo {
  id: string;
  short_id: string;
  message: string;
  author_name: string;
  author_email: string;
  timestamp: number;
  parent_ids: string[];
}

interface GitGraphProps {
  commits: GitCommitInfo[];
  onSelectCommit: (commit: GitCommitInfo) => void;
  activeCommitId: string | null;
}

interface GraphNode {
  commit: GitCommitInfo;
  x: number;
  y: number;
  color: string;
  lane: number;
}

interface GraphEdge {
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  color: string;
}

const LANES_COLORS = [
  "#00bcd4", // Cyan
  "#e91e63", // Pink
  "#4caf50", // Green
  "#ff9800", // Orange
  "#9c27b0", // Purple
  "#2196f3", // Blue
  "#ffeb3b", // Yellow
];

const ROW_HEIGHT = 28; // Compact row height
const X_SPACING = 16;
const CIRCLE_RADIUS = 4;
const PADDING_TOP = ROW_HEIGHT / 2;

export const GitGraph: React.FC<GitGraphProps> = ({
  commits,
  onSelectCommit,
  activeCommitId,
}) => {
  const { nodes, edges, height } = useMemo(() => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Map types:
    // laneId -> commitId (last commit in this lane)
    const lanes: (string | null)[] = [];
    const commitLaneMap: Record<string, number> = {};

    commits.forEach((commit, index) => {
      // Determine lane
      let laneIndex = -1;

      // 1. Check if this commit is the first parent of any active lane
      // (Simpler: if any existing lane expects this commit)

      // Algorithm adaptation:
      // We need to know which lane tracks which branch "flow".
      // A commit roughly continues the lane of its first child (in reverse chrono order).
      // But here we iterate commits NEWEST first (Topological).

      // So:
      // A commit continues the lane if one of the 'active' lanes has this commit as a parent.
      // If multiple lanes point to this commit (merge), we merge them.
      // If no lane points to this commit, it's a new branch tip (or we just started).

      // Let's look at "active paths" coming from top.
      // `lanes` array stores the `next_parent_id` expected for that lane.

      const existingLaneIndex = lanes.findIndex(
        (parent_id) => parent_id === commit.id,
      );

      if (existingLaneIndex !== -1) {
        laneIndex = existingLaneIndex;
        lanes[laneIndex] = null; // Consumed
      } else {
        // New lane (tip of a branch we haven't seen, or disjoint history)
        // Find empty slot
        let freeSlot = lanes.findIndex((l) => l === null);
        if (freeSlot === -1) {
          lanes.push(null);
          freeSlot = lanes.length - 1;
        }
        laneIndex = freeSlot;
      }

      commitLaneMap[commit.id] = laneIndex;
      const color = LANES_COLORS[laneIndex % LANES_COLORS.length];

      const x = laneIndex * X_SPACING + X_SPACING / 2;
      const y = index * ROW_HEIGHT + PADDING_TOP;

      nodes.push({ commit, x, y, color, lane: laneIndex });

      // Process parents to propagate lanes
      // Commit can have multiple parents (Merge)
      // parent[0] usually continues the same lane (main line)
      // parent[1..n] branch off/merge in. (In reverse view: they split out)

      const parentIds = commit.parent_ids;

      if (parentIds.length > 0) {
        // First parent continues the current lane
        lanes[laneIndex] = parentIds[0];

        // Draw edge to NEXT node (which we don't know coords yet? No, we draw lines BACKWARDS?
        // Wait, standard way is to draw connection when we visit the parent, or draw from child to potential parent.
        // In React, we can just calculate edges after nodes? No, we need topology.)

        // Actually, for a static graph:
        // We know this node (child) is at (x, y).
        // We need to draw lines to its parents. But parents might be far away.
        // We track "active connections".

        // Simplified for MVP:
        // We generate nodes. Edges are tricky in single pass without knowing parent coords.
        // BUT, if we just process all nodes, we can calculate edges in a second pass or just look up?
        // Using a map for node coordinates.
      }

      // Handle merge parents (secondary parents)
      for (let i = 1; i < parentIds.length; i++) {
        const pId = parentIds[i];
        // This parent needs its own lane.
        // Check if it's already expected?
        const existing = lanes.findIndex((pid) => pid === pId);
        if (existing !== -1) {
          // Already tracked
        } else {
          // Start a new lane for this parent
          let freeSlot = lanes.findIndex((l) => l === null);
          if (freeSlot === -1) {
            lanes.push(pId);
          } else {
            lanes[freeSlot] = pId;
          }
        }
        // We need to draw a connector from current node to this new lane?
        // It gets complex.
      }
    });

    // Second pass for edges?
    // Since we have all nodes now, we can iterate nodes and draw lines to their parents.
    // We need a quick lookup for nodes
    const nodeMap = new Map(nodes.map((n) => [n.commit.id, n]));

    nodes.forEach((node) => {
      node.commit.parent_ids.forEach((pid) => {
        const parentNode = nodeMap.get(pid);
        if (parentNode) {
          edges.push({
            p1: { x: node.x, y: node.y },
            p2: { x: parentNode.x, y: parentNode.y },
            color: node.color, // Or parent color? Usually child color or gradient
          });
        } else {
          // Parent not in list (limit reached or detached history)
          // Draw a stub?
          edges.push({
            p1: { x: node.x, y: node.y },
            p2: { x: node.x, y: node.y + ROW_HEIGHT }, // fade out
            color: node.color,
          });
        }
      });
    });

    return { nodes, edges, height: commits.length * ROW_HEIGHT };
  }, [commits]);

  return (
    <Box
      style={{
        height: "100%",
        overflow: "auto",
        position: "relative",
        fontFamily: "monospace",
      }}
    >
      <svg
        width="100%"
        height={height}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
          minWidth: 200,
        }}
      >
        {edges.map((edge, i) => (
          <path
            key={`edge-${i}`}
            d={`M ${edge.p1.x} ${edge.p1.y} C ${edge.p1.x} ${edge.p1.y + ROW_HEIGHT / 2}, ${edge.p2.x} ${edge.p2.y - ROW_HEIGHT / 2}, ${edge.p2.x} ${edge.p2.y}`}
            stroke={edge.color}
            strokeWidth="2"
            fill="none"
            opacity={0.6}
          />
        ))}
        {nodes.map((node) => (
          <circle
            key={`node-${node.commit.id}`}
            cx={node.x}
            cy={node.y}
            r={CIRCLE_RADIUS}
            fill={node.color}
            stroke="#fff"
            strokeWidth="1"
          />
        ))}
      </svg>

      <Box style={{ position: "relative", width: "100%" }}>
        {nodes.map((node) => (
          <Box
            key={node.commit.id}
            onClick={() => onSelectCommit(node.commit)}
            style={{
              height: ROW_HEIGHT,
              display: "flex",
              alignItems: "center",
              paddingLeft: Math.max(...nodes.map((n) => n.x)) + 20, // Offset by graph width
              cursor: "pointer",
              backgroundColor:
                activeCommitId === node.commit.id
                  ? "var(--mantine-color-blue-light)"
                  : "transparent",
              borderBottom: "1px solid var(--mantine-color-default-border)",
            }}
          >
            <Text
              size="xs"
              c="dimmed"
              w={80}
              style={{ fontFamily: "monospace" }}
            >
              {node.commit.short_id}
            </Text>
            <Text size="sm" truncate flex={1} style={{ paddingRight: 10 }}>
              {node.commit.message}
            </Text>
            <Text size="xs" c="dimmed" w={100} truncate>
              {node.commit.author_name}
            </Text>
            <Text size="xs" c="dimmed" w={80} ta="right">
              {formatDistanceToNow(new Date(node.commit.timestamp * 1000), {
                addSuffix: true,
              })}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
