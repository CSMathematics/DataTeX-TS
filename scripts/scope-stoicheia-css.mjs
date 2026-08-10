#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  STOICHEIA_SCOPE,
  auditCss,
  scopeCss,
} from "./lib/scope-stoicheia-css.mjs";

function usage() {
  return [
    "Usage:",
    "  node scripts/scope-stoicheia-css.mjs --input <compiled.css> --output <embedded.css>",
    "  node scripts/scope-stoicheia-css.mjs --input <compiled.css> --output <embedded.css> --check",
    "  node scripts/scope-stoicheia-css.mjs --input <source.css> --audit-only",
    "",
    `All style selectors are constrained to ${STOICHEIA_SCOPE}.`,
    "The input must be compiled CSS: @import and uncompiled nested selectors are rejected.",
  ].join("\n");
}

function parseArguments(argv) {
  const result = {
    input: null,
    output: null,
    check: false,
    auditOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--input") {
      result.input = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (argument === "--output") {
      result.output = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (argument === "--check") {
      result.check = true;
      continue;
    }

    if (argument === "--audit-only") {
      result.auditOnly = true;
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      process.stdout.write(`${usage()}\n`);
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (!result.input) {
    throw new Error("--input is required.");
  }

  if (!result.auditOnly && !result.output) {
    throw new Error("--output is required unless --audit-only is used.");
  }

  if (result.auditOnly && result.check) {
    throw new Error("--audit-only and --check cannot be combined.");
  }

  return result;
}

async function readExistingOutput(outputPath) {
  try {
    return await fs.readFile(outputPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const inputPath = path.resolve(options.input);
  const css = await fs.readFile(inputPath, "utf8");

  if (options.auditOnly) {
    const audit = auditCss(css, { from: inputPath });
    process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
    return;
  }

  const outputPath = path.resolve(options.output);
  const scopedCss = scopeCss(css, { from: inputPath });

  if (options.check) {
    const existing = await readExistingOutput(outputPath);
    if (existing !== scopedCss) {
      throw new Error(
        `Scoped stylesheet is missing or stale: ${path.relative(process.cwd(), outputPath)}`,
      );
    }
    process.stdout.write(
      `Stoicheia scoped CSS is current: ${path.relative(process.cwd(), outputPath)}\n`,
    );
    return;
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, scopedCss, "utf8");
  process.stdout.write(
    `Wrote ${path.relative(process.cwd(), outputPath)} (${Buffer.byteLength(scopedCss)} bytes).\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`Stoicheia CSS scoping failed: ${error.message}\n`);
  process.stderr.write(`${usage()}\n`);
  process.exitCode = 1;
});
