import { useEffect } from "react";
import { useAIStore } from "../stores/aiStore";
import { useTabsStore, AppTab } from "../stores/useTabsStore";
import { readTextFile } from "@tauri-apps/plugin-fs";

export const usePendingWriteListener = () => {
  const pendingWrite = useAIStore((state) => state.pendingWrite);
  const openTab = useTabsStore((state) => state.openTab);
  const hasTab = useTabsStore((state) => state.hasTab);
  const setActiveTab = useTabsStore((state) => state.setActiveTab);

  useEffect(() => {
    let cancelled = false;

    if (pendingWrite) {
      const tabId = `review-${pendingWrite.path}`;

      if (hasTab(tabId)) {
        setActiveTab(tabId);
        return;
      }

      // Read original content
      readTextFile(pendingWrite.path)
        .then((originalContent) => {
          if (cancelled) return;
          const newTab: AppTab = {
            id: tabId,
            title: `Review: ${pendingWrite.path.split(/[\\/]/).pop()}`,
            type: "diff-view",
            diffData: {
              original: originalContent,
              modified: pendingWrite.content,
              originalPath: pendingWrite.path,
            },
          };
          openTab(newTab);
        })
        .catch((err) => {
          if (cancelled) return;
          console.error("Failed to read original file for diff", err);
          // Fallback if file doesn't exist (new file creation)
          const newTab: AppTab = {
            id: tabId,
            title: `Review: ${pendingWrite.path.split(/[\\/]/).pop()}`,
            type: "diff-view",
            diffData: {
              original: "", // Empty for new file
              modified: pendingWrite.content,
              originalPath: pendingWrite.path,
            },
          };
          openTab(newTab);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [pendingWrite, openTab, hasTab, setActiveTab]);
};
