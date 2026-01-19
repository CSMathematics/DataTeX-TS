import React, { useMemo, useState } from "react";
import { Box, Text, Badge, Group, Tooltip, Menu } from "@mantine/core";
import { formatDistanceToNow } from "date-fns";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCopy,
  faCodeBranch,
  faCheck,
  faUndo,
} from "@fortawesome/free-solid-svg-icons";

// Types
export interface GitCommitInfo {
  id: string;
  short_id: string;
  message: string;
  author_name: string;
  author_email: string;
  timestamp: number;
  parent_ids: string[];
  refs?: string[];
}

interface GitGraphProps {
  commits: GitCommitInfo[];
  onSelectCommit: (commit: GitCommitInfo) => void;
  activeCommitId: string | null;
  onCheckoutCommit?: (commitId: string) => void;
  onCherryPick?: (commitId: string) => void;
  onRevertCommit?: (commitId: string) => void;
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
  isMerge?: boolean;
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

const ROW_HEIGHT = 32;
const X_SPACING = 20;
const CIRCLE_RADIUS = 5;
const PADDING_TOP = ROW_HEIGHT / 2;

export const GitGraph: React.FC<GitGraphProps> = ({
  commits,
  onSelectCommit,
  activeCommitId,
  onCheckoutCommit,
  onCherryPick,
  onRevertCommit,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);

  const { nodes, edges, height, maxLane } = useMemo(() => {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    const lanes: (string | null)[] = [];
    const commitLaneMap: Record<string, number> = {};

    commits.forEach((commit, index) => {
      let laneIndex = -1;

      const existingLaneIndex = lanes.findIndex(
        (parent_id) => parent_id === commit.id,
      );

      if (existingLaneIndex !== -1) {
        laneIndex = existingLaneIndex;
        lanes[laneIndex] = null;
      } else {
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

      const parentIds = commit.parent_ids;

      if (parentIds.length > 0) {
        lanes[laneIndex] = parentIds[0];
      }

      // Track merge parents in separate lanes
      for (let i = 1; i < parentIds.length; i++) {
        const pId = parentIds[i];
        const existing = lanes.findIndex((pid) => pid === pId);
        if (existing === -1) {
          let freeSlot = lanes.findIndex((l) => l === null);
          if (freeSlot === -1) {
            lanes.push(pId);
          } else {
            lanes[freeSlot] = pId;
          }
        }
      }
    });

    const nodeMap = new Map(nodes.map((n) => [n.commit.id, n]));

    nodes.forEach((node) => {
      node.commit.parent_ids.forEach((pid, pidIndex) => {
        const parentNode = nodeMap.get(pid);
        const isMerge = pidIndex > 0; // Secondary parents are merge parents

        if (parentNode) {
          // Use parent's color for merge edges to show where they came from
          const edgeColor = isMerge ? parentNode.color : node.color;
          edges.push({
            p1: { x: node.x, y: node.y },
            p2: { x: parentNode.x, y: parentNode.y },
            color: edgeColor,
            isMerge,
          });
        } else {
          edges.push({
            p1: { x: node.x, y: node.y },
            p2: { x: node.x, y: node.y + ROW_HEIGHT },
            color: node.color,
            isMerge: false,
          });
        }
      });
    });

    const maxLane = Math.max(...nodes.map((n) => n.lane), 0);

    return { nodes, edges, height: commits.length * ROW_HEIGHT, maxLane };
  }, [commits]);

  const contentPadding = (maxLane + 1) * X_SPACING + 10;

  const handleCopySha = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatTooltipContent = (commit: GitCommitInfo) => (
    <Box style={{ maxWidth: 350 }}>
      <Text size="sm" fw={600} mb={4}>
        {commit.message}
      </Text>
      <Text size="xs" c="dimmed">
        SHA: {commit.id}
      </Text>
      <Text size="xs" c="dimmed">
        Author: {commit.author_name} &lt;{commit.author_email}&gt;
      </Text>
      <Text size="xs" c="dimmed">
        Date: {new Date(commit.timestamp * 1000).toLocaleString()}
      </Text>
      {commit.parent_ids.length > 0 && (
        <Text size="xs" c="dimmed">
          Parents: {commit.parent_ids.map((p) => p.slice(0, 7)).join(", ")}
        </Text>
      )}
      {commit.refs && commit.refs.length > 0 && (
        <Text size="xs" c="dimmed">
          Refs: {commit.refs.join(", ")}
        </Text>
      )}
    </Box>
  );

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
        {/* Draw non-merge edges first, then merge edges on top */}
        {edges
          .filter((e) => !e.isMerge)
          .map((edge, i) => (
            <path
              key={`edge-${i}`}
              d={`M ${edge.p1.x} ${edge.p1.y} C ${edge.p1.x} ${edge.p1.y + ROW_HEIGHT / 2}, ${edge.p2.x} ${edge.p2.y - ROW_HEIGHT / 2}, ${edge.p2.x} ${edge.p2.y}`}
              stroke={edge.color}
              strokeWidth="2"
              fill="none"
              opacity={0.6}
            />
          ))}
        {edges
          .filter((e) => e.isMerge)
          .map((edge, i) => (
            <path
              key={`merge-edge-${i}`}
              d={`M ${edge.p1.x} ${edge.p1.y} C ${edge.p1.x} ${edge.p1.y + ROW_HEIGHT / 2}, ${edge.p2.x} ${edge.p2.y - ROW_HEIGHT / 2}, ${edge.p2.x} ${edge.p2.y}`}
              stroke={edge.color}
              strokeWidth="2"
              strokeDasharray="4,2"
              fill="none"
              opacity={0.8}
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
          <Menu
            key={node.commit.id}
            shadow="md"
            width={200}
            position="bottom-start"
            opened={contextMenuId === node.commit.id}
            onClose={() => setContextMenuId(null)}
          >
            <Menu.Target>
              <Tooltip
                label={formatTooltipContent(node.commit)}
                position="right"
                withArrow
                multiline
                openDelay={300}
              >
                <Box
                  onClick={() => onSelectCommit(node.commit)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenuId(node.commit.id);
                  }}
                  style={{
                    height: ROW_HEIGHT,
                    display: "flex",
                    alignItems: "center",
                    paddingLeft: contentPadding,
                    cursor: "pointer",
                    backgroundColor:
                      activeCommitId === node.commit.id
                        ? "var(--mantine-color-blue-light)"
                        : "transparent",
                    borderBottom:
                      "1px solid var(--mantine-color-default-border)",
                  }}
                >
                  <Group
                    gap="xs"
                    wrap="nowrap"
                    style={{ width: "100%", overflow: "hidden" }}
                  >
                    <Text
                      size="xs"
                      c="dimmed"
                      style={{ fontFamily: "monospace", minWidth: 60 }}
                    >
                      {node.commit.short_id}
                    </Text>

                    {/* Refs (Branches/Tags) */}
                    {node.commit.refs && node.commit.refs.length > 0 && (
                      <Group gap={4} wrap="nowrap">
                        {node.commit.refs.map((ref) => (
                          <Badge
                            key={ref}
                            size="xs"
                            variant="filled"
                            color="yellow"
                            style={{ textTransform: "none" }}
                          >
                            {ref}
                          </Badge>
                        ))}
                      </Group>
                    )}

                    <Text size="sm" truncate style={{ flex: 1 }}>
                      {node.commit.message.split("\n")[0]}
                    </Text>

                    <Text
                      size="xs"
                      c="dimmed"
                      style={{ minWidth: 100 }}
                      truncate
                    >
                      {node.commit.author_name}
                    </Text>

                    <Text
                      size="xs"
                      c="dimmed"
                      style={{ minWidth: 80 }}
                      ta="right"
                    >
                      {formatDistanceToNow(
                        new Date(node.commit.timestamp * 1000),
                        {
                          addSuffix: true,
                        },
                      )}
                    </Text>
                  </Group>
                </Box>
              </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Commit Actions</Menu.Label>
              <Menu.Item
                leftSection={
                  copiedId === node.commit.id ? (
                    <FontAwesomeIcon icon={faCheck} />
                  ) : (
                    <FontAwesomeIcon icon={faCopy} />
                  )
                }
                onClick={() => handleCopySha(node.commit.id)}
              >
                {copiedId === node.commit.id ? "Copied!" : "Copy SHA"}
              </Menu.Item>
              {onCheckoutCommit && (
                <Menu.Item
                  leftSection={<FontAwesomeIcon icon={faCodeBranch} />}
                  onClick={() => onCheckoutCommit(node.commit.id)}
                >
                  Checkout this commit
                </Menu.Item>
              )}
              {onCherryPick && (
                <Menu.Item
                  leftSection={<FontAwesomeIcon icon={faCheck} />}
                  onClick={() => onCherryPick(node.commit.id)}
                >
                  Cherry-pick
                </Menu.Item>
              )}
              {onRevertCommit && (
                <Menu.Item
                  leftSection={<FontAwesomeIcon icon={faUndo} />}
                  onClick={() => onRevertCommit(node.commit.id)}
                  color="red"
                >
                  Revert this commit
                </Menu.Item>
              )}
            </Menu.Dropdown>
          </Menu>
        ))}
      </Box>
    </Box>
  );
};
