import { useCallback, useEffect, useRef } from "react";
import type React from "react";

export interface UseResizeDragOptions {
  cursor: React.CSSProperties["cursor"];
  onStart?: (event: React.PointerEvent<HTMLElement>) => boolean | void;
  onMove: (event: PointerEvent) => void;
  onEnd?: (event: PointerEvent | null) => void;
  onActiveChange?: (active: boolean) => void;
}

export interface UseResizeDragReturn {
  startResizing: (event: React.PointerEvent<HTMLElement>) => void;
}

interface ResizeSession {
  finish: (
    event: PointerEvent | null,
    flushFinalPosition: boolean,
    notify: boolean,
  ) => void;
}

/**
 * Low-overhead pointer-drag primitive for resize handles.
 *
 * Pointer movement is coalesced to one callback per animation frame. The last
 * pointer position is synchronously flushed on pointer-up, so callers can
 * commit the exact final size without rendering React state during the drag.
 */
export function useResizeDrag({
  cursor,
  onStart,
  onMove,
  onEnd,
  onActiveChange,
}: UseResizeDragOptions): UseResizeDragReturn {
  const optionsRef = useRef<UseResizeDragOptions>({
    cursor,
    onStart,
    onMove,
    onEnd,
    onActiveChange,
  });
  const sessionRef = useRef<ResizeSession | null>(null);

  optionsRef.current = {
    cursor,
    onStart,
    onMove,
    onEnd,
    onActiveChange,
  };

  const startResizing = useCallback(
    (reactEvent: React.PointerEvent<HTMLElement>) => {
      if (
        sessionRef.current ||
        !reactEvent.isPrimary ||
        reactEvent.button !== 0
      ) {
        return;
      }

      reactEvent.preventDefault();

      const target = reactEvent.currentTarget;
      const pointerId = reactEvent.pointerId;
      const body = document.body;
      const activeCursor = optionsRef.current.cursor ?? "default";
      const previousCursor = body.style.getPropertyValue("cursor");
      const previousCursorPriority =
        body.style.getPropertyPriority("cursor");
      const previousUserSelect = body.style.getPropertyValue("user-select");
      const previousUserSelectPriority =
        body.style.getPropertyPriority("user-select");
      const hadResizingAttribute = body.hasAttribute("data-resizing");
      const previousResizingAttribute = body.getAttribute("data-resizing");

      let animationFrame: number | null = null;
      let latestEvent: PointerEvent | null = null;
      let finished = false;

      const runLatestMove = (finalEvent?: PointerEvent | null) => {
        if (animationFrame !== null) {
          cancelAnimationFrame(animationFrame);
          animationFrame = null;
        }

        const event = finalEvent ?? latestEvent;
        latestEvent = null;
        if (event) optionsRef.current.onMove(event);
      };

      const restoreDocumentState = () => {
        if (previousCursor) {
          body.style.setProperty(
            "cursor",
            previousCursor,
            previousCursorPriority,
          );
        } else {
          body.style.removeProperty("cursor");
        }

        if (previousUserSelect) {
          body.style.setProperty(
            "user-select",
            previousUserSelect,
            previousUserSelectPriority,
          );
        } else {
          body.style.removeProperty("user-select");
        }

        if (hadResizingAttribute) {
          body.setAttribute("data-resizing", previousResizingAttribute ?? "");
        } else {
          body.removeAttribute("data-resizing");
        }
      };

      const removeListeners = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);
        window.removeEventListener("blur", handleWindowBlur);
        target.removeEventListener("lostpointercapture", handleLostPointerCapture);
      };

      const finish = (
        event: PointerEvent | null,
        flushFinalPosition: boolean,
        notify: boolean,
      ) => {
        if (finished) return;
        finished = true;

        removeListeners();

        try {
          if (flushFinalPosition) runLatestMove(event);
          else if (animationFrame !== null) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
          }
        } finally {
          latestEvent = null;

          try {
            if (target.hasPointerCapture(pointerId)) {
              target.releasePointerCapture(pointerId);
            }
          } catch {
            // The browser may already have released capture on pointer-up.
          }

          restoreDocumentState();
          sessionRef.current = null;

          if (notify) {
            optionsRef.current.onActiveChange?.(false);
            optionsRef.current.onEnd?.(event);
          }
        }
      };

      function handlePointerMove(event: PointerEvent) {
        if (event.pointerId !== pointerId) return;

        event.preventDefault();
        latestEvent = event;

        if (animationFrame === null) {
          animationFrame = requestAnimationFrame(() => {
            animationFrame = null;
            const eventToProcess = latestEvent;
            latestEvent = null;
            if (eventToProcess) optionsRef.current.onMove(eventToProcess);
          });
        }
      }

      function handlePointerUp(event: PointerEvent) {
        if (event.pointerId !== pointerId) return;
        finish(event, true, true);
      }

      function handlePointerCancel(event: PointerEvent) {
        if (event.pointerId !== pointerId) return;
        finish(null, true, true);
      }

      function handleWindowBlur() {
        finish(null, true, true);
      }

      function handleLostPointerCapture(event: PointerEvent) {
        if (event.pointerId !== pointerId) return;
        finish(null, true, true);
      }

      sessionRef.current = { finish };

      body.style.setProperty("cursor", activeCursor);
      body.style.setProperty("user-select", "none");
      body.setAttribute("data-resizing", activeCursor);

      try {
        target.setPointerCapture(pointerId);
      } catch {
        // Window listeners still keep mouse-like pointer drags functional.
      }

      window.addEventListener("pointermove", handlePointerMove, {
        passive: false,
      });
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerCancel);
      window.addEventListener("blur", handleWindowBlur);
      target.addEventListener("lostpointercapture", handleLostPointerCapture);

      let shouldStart = true;
      try {
        shouldStart = optionsRef.current.onStart?.(reactEvent) !== false;
      } catch (error) {
        finish(null, false, false);
        throw error;
      }

      if (!shouldStart) {
        finish(null, false, false);
        return;
      }

      optionsRef.current.onActiveChange?.(true);
    },
    [],
  );

  useEffect(
    () => () => {
      sessionRef.current?.finish(null, false, false);
    },
    [],
  );

  return { startResizing };
}
