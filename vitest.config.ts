import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/features/stoicheia/setupTests.ts"],
    include: ["src/features/stoicheia/**/*.test.{ts,tsx}"],
  },
});
