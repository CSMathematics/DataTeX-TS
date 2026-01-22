import { invoke } from "@tauri-apps/api/core";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useDatabaseStore } from "../stores/databaseStore";
import { aiProxy } from "./aiService";
import { notifications } from "@mantine/notifications";

// Types corresponding to Rust backend
interface VectorItem {
  id: string; // File Path
  vector: number[];
  metadata?: Record<string, string>;
}

export const indexingService = {
  isIndexing: false,
  progress: 0,
  total: 0,
  stopRequested: false,

  async buildIndex(
    onProgress: (current: number, total: number) => void,
  ): Promise<void> {
    if (this.isIndexing) return;
    this.isIndexing = true;
    this.stopRequested = false;
    this.progress = 0;

    try {
      // 1. Fetch all relevant files
      // We'll use the store's loaded resources or fetch all
      // Ideally we should fetch all from backend command, but using store for now
      // assuming the user has opened a project.
      const collections = useDatabaseStore.getState().collections;
      const collectionNames = collections.map((c) => c.name);

      // Use the batch command to get all resources
      const resources: any[] = await invoke(
        "get_resources_by_collections_cmd",
        {
          collections: collectionNames,
        },
      );

      // Filter for text-based files
      const textFiles = resources.filter((r) => {
        const ext = r.path.split(".").pop()?.toLowerCase();
        return ["tex", "bib", "txt", "md", "sty", "cls"].includes(ext || "");
      });

      this.total = textFiles.length;
      onProgress(0, this.total);

      const items: VectorItem[] = [];
      const BATCH_SIZE = 5; // Process and save in batches

      for (let i = 0; i < textFiles.length; i++) {
        if (this.stopRequested) break;

        const file = textFiles[i];

        try {
          const content = await readTextFile(file.path);

          // Limit content size to avoid token limits (simple truncation for Phase 2)
          // Phase 3 could do smart chunking
          const truncated = content.slice(0, 8000);
          if (!truncated.trim()) continue;

          const vector = await aiProxy.getEmbedding(truncated);

          items.push({
            id: file.path,
            vector: vector,
            metadata: {
              title: file.title || "",
              collection: file.collection || "",
            },
          });

          // Save batch
          if (items.length >= BATCH_SIZE || i === textFiles.length - 1) {
            await invoke("store_embeddings", { items });
            items.length = 0; // Clear array
          }
        } catch (e) {
          console.warn(`Failed to index ${file.path}:`, e);
        }

        this.progress = i + 1;
        onProgress(this.progress, this.total);
      }

      notifications.show({
        title: "Indexing Complete",
        message: `Successfully indexed ${this.progress} files.`,
        color: "green",
      });
    } catch (e: any) {
      console.error("Indexing failed", e);
      notifications.show({
        title: "Indexing Failed",
        message: e.message,
        color: "red",
      });
    } finally {
      this.isIndexing = false;
    }
  },

  stop() {
    this.stopRequested = true;
  },
};
