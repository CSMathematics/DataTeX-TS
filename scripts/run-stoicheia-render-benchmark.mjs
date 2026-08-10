#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vitest = path.join(repositoryRoot, "node_modules/vitest/vitest.mjs");
const result = spawnSync(
  process.execPath,
  [
    vitest,
    "run",
    "--config",
    "vitest.config.ts",
    "src/features/stoicheia/renderers/FastSvgRenderer.test.tsx",
    "-t",
    "benchmarks large instant renderer scenes",
    "--reporter",
    "verbose",
  ],
  {
    cwd: repositoryRoot,
    env: { ...process.env, STOICHEIA_RENDER_BENCHMARK: "1" },
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
