export interface LogEntry {
  type: "error" | "warning" | "info";
  message: string;
  line: number;
  file?: string;
}

import { invoke } from "@tauri-apps/api/core";

export interface LogEntry {
  type: "error" | "warning" | "info";
  message: string;
  line: number;
  file?: string;
}

export async function parseLatexLog(logContent: string): Promise<LogEntry[]> {
  try {
    return await invoke<LogEntry[]>("parse_log_cmd", { content: logContent });
  } catch (e) {
    console.error("Failed to parse log via Rust:", e);
    return [];
  }
}
