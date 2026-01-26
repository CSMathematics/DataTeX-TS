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

export async function parseLatexLog(filePath: string): Promise<LogEntry[]> {
  try {
    return await invoke<LogEntry[]>("parse_log_cmd", { file_path: filePath });
  } catch (e) {
    console.error("Failed to parse log via Rust:", e);
    return [];
  }
}
