import { useEffect } from "react";
import { useAIStore } from "../stores/aiStore";
import { useTabsStore, AppTab } from "../stores/useTabsStore";
import { readTextFile } from "@tauri-apps/plugin-fs";

export const usePendingWriteListener = () => {
  const pendingWrite = useAIStore((state) => state.pendingWrite);
  const { openTab, hasTab, setActiveTab } = useTabsStore();

  useEffect(() => {
    if (pendingWrite) {
      const tabId = `review-${pendingWrite.path}`;

      if (hasTab(tabId)) {
        setActiveTab(tabId);
        return;
      }

      // Read original content
      readTextFile(pendingWrite.path)
        .then((originalContent) => {
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
  }, [pendingWrite, openTab, hasTab, setActiveTab]);
};
