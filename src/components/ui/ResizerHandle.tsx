import React from "react";
import { Box } from "@mantine/core";

interface ResizerHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  isResizing: boolean;
  orientation?: "vertical" | "horizontal"; // Προσθήκη για μελλοντική χρήση (π.χ. στο TikzWizard)
}

export const ResizerHandle: React.FC<ResizerHandleProps> = ({
  onMouseDown,
  isResizing,
  orientation = "vertical",
}) => {
  return (
    <Box
      onMouseDown={onMouseDown}
      w={orientation === "vertical" ? 4 : "100%"}
      h={orientation === "vertical" ? "100%" : 4}
      style={{
        backgroundColor: isResizing
          ? "var(--mantine-primary-color-6)"
          : "transparent",
        cursor: orientation === "vertical" ? "col-resize" : "row-resize",
        transition: "background-color 0.2s",
        zIndex: 50,
        position: "relative",
        userSelect: "none",
        flexShrink: 0, // Σημαντικό για flex layouts
      }}
    />
  );
};
