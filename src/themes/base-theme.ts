import { createTheme } from "@mantine/core";

export const baseTheme = createTheme({
  defaultRadius: "sm",
  fontFamily: "Inter, sans-serif",
  components: {
    Switch: {
      defaultProps: {
        thumbIcon: null,
      },
      styles: {
        root: { display: "flex", alignItems: "center" },
        track: {
          border: "1px solid var(--mantine-color-default-border)",
          cursor: "pointer",
          padding: 2,
          transition: "background-color 0.2s, border-color 0.2s",
          /* &[data-checked] is not supported in styles (inline styles) */
        },
        thumb: {
          borderRadius: "50%",
          border: "none",
          boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
        },
        label: {
          paddingLeft: 10,
          fontWeight: 500,
          color: "var(--mantine-color-text)",
        },
      },
    },
  },
});
