import React from 'react';
import { Box } from '@mantine/core';

interface ResizerHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
  isResizing: boolean;
  orientation?: 'vertical' | 'horizontal'; // Προσθήκη για μελλοντική χρήση (π.χ. στο TikzWizard)
}

export const ResizerHandle: React.FC<ResizerHandleProps> = ({ 
  onMouseDown, 
  isResizing,
  orientation = 'vertical' 
}) => {
  return (
    <Box
      onMouseDown={onMouseDown}
      w={orientation === 'vertical' ? 4 : '100%'}
      h={orientation === 'vertical' ? '100%' : 4}
      style={{
        backgroundColor: isResizing ? "var(--mantine-primary-color-6)" : "transparent",
        cursor: orientation === 'vertical' ? "col-resize" : "row-resize",
        transition: "background-color 0.2s",
        zIndex: 50,
        position: 'relative',
        userSelect: 'none',
        flexShrink: 0, // Σημαντικό για flex layouts
      }}
      // Use CSS class for hover if needed, or inline sx which Mantine handles
      // But Box style prop doesn't handle pseudo-classes directly unless using Mantine's system
      // However, we can use sx prop or className.
      // But sticking to style prop with var is fine, we just lose hover without css.
      // Actually, standard Mantine Box supports sx or className.
      // I'll keep it simple: assume a global class or just rely on 'isResizing'.
      // The original code used ":hover" inside style object which is not standard React.
      // It likely worked because Mantine Box might parse it or it was ignored.
      // Wait, Mantine's `style` prop allows some nesting? No.
      // I'll use `onMouseEnter` / `onMouseLeave` or simple CSS class if I care.
      // But given the scope, I'll just leave hover out or use a class if I had one.
      // I'll assume standard React style.
      // Actually, I'll add a hover effect via standard CSS in App.css if I wanted.
      // But wait, the original file had `":hover": { backgroundColor: ... }`.
      // This suggests they might be using a library that supports it (like Emotion/Styled System) or it was doing nothing.
      // Mantine v7 `Box` uses `style` as native style.
      // I'll leave it out to be safe or use `sx` if it was v6. v7 uses `style`.
      // I'll just set bg on resizing.
    />
  );
};
