import type React from "react";
import { Box } from "@mantine/core";

interface ResizerHandleProps {
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  orientation?: "vertical" | "horizontal";
}

export const ResizerHandle: React.FC<ResizerHandleProps> = ({
  onPointerDown,
  orientation = "vertical",
}) => {
  return (
    <Box
      className={`resize-handle resize-handle--${orientation}`}
      onPointerDown={onPointerDown}
      role="separator"
      aria-orientation={orientation}
    />
  );
};
