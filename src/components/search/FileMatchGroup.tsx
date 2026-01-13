// File match group component - VSCode-style simplified display
import React, { useState } from "react";
import { Box, UnstyledButton, Text, Stack } from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronRight,
  faFile,
} from "@fortawesome/free-solid-svg-icons";
import { SearchMatch } from "../../services/searchService";

interface FileMatchGroupProps {
  filePath: string;
  fileName: string;
  matches: SearchMatch[];
  onOpenFile: (path: string, lineNumber: number) => void;
}

export const FileMatchGroup: React.FC<FileMatchGroupProps> = ({
  fileName,
  matches,
  onOpenFile,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Box>
      {/* File header - simple like VSCode */}
      <UnstyledButton
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: "100%",
          padding: "4px 8px",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <FontAwesomeIcon
          icon={isExpanded ? faChevronDown : faChevronRight}
          style={{
            width: 10,
            height: 10,
            color: "var(--mantine-color-dimmed)",
          }}
        />
        <FontAwesomeIcon
          icon={faFile}
          style={{
            width: 12,
            height: 12,
            color: "var(--mantine-color-dimmed)",
          }}
        />
        <Text size="sm" style={{ flex: 1 }}>
          {fileName}
        </Text>
        <Text size="xs" c="dimmed">
          {matches.length}
        </Text>
      </UnstyledButton>

      {/* Matches list - simplified */}
      {isExpanded && (
        <Stack gap={0} ml={-10}>
          {matches.map((match, idx) => (
            <MatchLineItem
              key={`${match.line_number}-${idx}`}
              match={match}
              onOpenFile={onOpenFile}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
};

// Individual match line item - very simple like VSCode
interface MatchLineItemProps {
  match: SearchMatch;
  onOpenFile: (path: string, lineNumber: number) => void;
}

const MatchLineItem: React.FC<MatchLineItemProps> = ({ match, onOpenFile }) => {
  const renderHighlightedText = () => {
    const text = match.line_content || "";
    if (!text) return "(empty line)";

    const start = match.match_start;
    const end = match.match_end;

    return (
      <>
        {text.substring(0, start)}
        <span
          style={{
            backgroundColor: "var(--mantine-color-yellow-3)",
            color: "var(--mantine-color-dark-9)",
            fontWeight: 500,
          }}
        >
          {text.substring(start, end)}
        </span>
        {text.substring(end)}
      </>
    );
  };

  return (
    <UnstyledButton
      onClick={() => onOpenFile(match.file_path, match.line_number)}
      style={{
        width: "100%",
        padding: "2px 8px",
        textAlign: "left",
        display: "flex",
        gap: 8,
        fontSize: "13px",
      }}
      styles={{
        root: {
          "&:hover": {
            backgroundColor: "var(--mantine-color-default-hover)",
          },
        },
      }}
    >
      <Text
        size="xs"
        c="dimmed"
        style={{ minWidth: 35, textAlign: "right", flexShrink: 0 }}
      >
        {match.line_number}
      </Text>
      <Text
        size="xs"
        component="div"
        style={{
          flex: 1,
          fontFamily: "monospace",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {renderHighlightedText()}
      </Text>
    </UnstyledButton>
  );
};
