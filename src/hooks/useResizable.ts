import { useLayoutEffect, useRef, useState } from "react";
import type React from "react";
import { useResizeDrag } from "./useResizeDrag";

interface UseResizableOptions {
  /** Direction of resize: horizontal changes width, vertical changes height. */
  direction: "horizontal" | "vertical";
  /** Minimum size in percent or pixels, depending on usePercentage. */
  minSize?: number;
  /** Maximum size in percent or pixels, depending on usePercentage. */
  maxSize?: number;
  /** For pixel sizing, optionally keep this many pixels for the other pane. */
  maxSizeOffset?: number;
  /** Initial size in percent or pixels, depending on usePercentage. */
  initialSize?: number;
  /** Use percentages when true and pixels when false. */
  usePercentage?: boolean;
}

interface UseResizableReturn {
  size: number;
  startResizing: (event: React.PointerEvent<HTMLElement>) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  targetRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Resizes a target element without causing React renders during pointer move.
 * Attach containerRef to the measured split container and targetRef to the pane.
 */
export function useResizable({
  direction,
  minSize = 10,
  maxSize = 90,
  maxSizeOffset,
  initialSize = 50,
  usePercentage = true,
}: UseResizableOptions): UseResizableReturn {
  const clamp = (value: number, containerLength?: number) => {
    const effectiveMax =
      !usePercentage &&
      maxSizeOffset !== undefined &&
      containerLength !== undefined
        ? Math.min(maxSize, containerLength - maxSizeOffset)
        : maxSize;
    return Math.max(minSize, Math.min(value, Math.max(minSize, effectiveMax)));
  };
  const [size, setSize] = useState(() => clamp(initialSize));
  const sizeRef = useRef(size);
  const dragSizeRef = useRef(size);
  const containerRectRef = useRef<DOMRect | null>(null);
  const startPointerRef = useRef(0);
  const startSizeRef = useRef(size);
  const dragMinRef = useRef(minSize);
  const dragMaxRef = useRef(maxSize);
  const containerRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);

  sizeRef.current = size;

  const applyTargetSize = (nextSize: number) => {
    const target = targetRef.current;
    if (!target) return;

    const property = direction === "horizontal" ? "width" : "height";
    target.style[property] = `${nextSize}${usePercentage ? "%" : "px"}`;
  };

  useLayoutEffect(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    const containerLength = rect
      ? direction === "horizontal"
        ? rect.width
        : rect.height
      : undefined;
    const nextSize = clamp(sizeRef.current, containerLength);
    sizeRef.current = nextSize;
    dragSizeRef.current = nextSize;
    applyTargetSize(nextSize);
    if (nextSize !== size) setSize(nextSize);
  }, [direction, maxSize, maxSizeOffset, minSize, size, usePercentage]);

  const { startResizing } = useResizeDrag({
    cursor: direction === "horizontal" ? "col-resize" : "row-resize",
    onStart: (event) => {
      const rect = containerRef.current?.getBoundingClientRect() ?? null;
      const targetRect = targetRef.current?.getBoundingClientRect() ?? null;
      if (!rect || !targetRect) return false;

      containerRectRef.current = rect;
      const containerLength =
        direction === "horizontal" ? rect.width : rect.height;
      if (containerLength <= 0) return false;
      const targetLength =
        direction === "horizontal" ? targetRect.width : targetRect.height;
      const renderedSize = usePercentage
        ? (targetLength / containerLength) * 100
        : targetLength;
      const effectiveMax =
        !usePercentage && maxSizeOffset !== undefined
          ? Math.min(maxSize, containerLength - maxSizeOffset)
          : maxSize;
      startPointerRef.current =
        direction === "horizontal" ? event.clientX : event.clientY;
      startSizeRef.current = renderedSize;
      dragMinRef.current = Math.min(minSize, renderedSize);
      dragMaxRef.current = Math.max(
        renderedSize,
        Math.max(minSize, effectiveMax),
      );
      dragSizeRef.current = startSizeRef.current;
      return true;
    },
    onMove: (event) => {
      const rect = containerRectRef.current;
      if (!rect) return;

      const containerLength =
        direction === "horizontal" ? rect.width : rect.height;
      if (containerLength <= 0) return;

      const pointerPosition =
        direction === "horizontal"
          ? event.clientX
          : event.clientY;
      const pointerDelta = pointerPosition - startPointerRef.current;
      const rawSize = usePercentage
        ? startSizeRef.current + (pointerDelta / containerLength) * 100
        : startSizeRef.current + pointerDelta;
      const nextSize = Math.max(
        dragMinRef.current,
        Math.min(rawSize, dragMaxRef.current),
      );

      dragSizeRef.current = nextSize;
      applyTargetSize(nextSize);
    },
    onEnd: () => {
      containerRectRef.current = null;
      sizeRef.current = dragSizeRef.current;
      setSize(dragSizeRef.current);
    },
  });

  return {
    size,
    startResizing,
    containerRef,
    targetRef,
  };
}
