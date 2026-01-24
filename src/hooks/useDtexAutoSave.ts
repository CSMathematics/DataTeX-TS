import { useEffect, useRef } from "react";
import { useTabsStore } from "../stores/useTabsStore";
import { DtexService } from "../services/dtexService";

/**
 * Hook to handle auto-saving of .dtex metadata
 * Subscribes to tabs store and triggers save when metadata is dirty
 */
export const useDtexAutoSave = () => {
  const tabs = useTabsStore((state) => state.tabs);
  const markMetadataDirty = useTabsStore((state) => state.markMetadataDirty);
  const setSavingStatus = useTabsStore((state) => state.setSavingStatus);

  // Keep track of timeouts per file
  const timeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    // Check for dirty tabs
    tabs.forEach((tab) => {
      if (tab.isDtexFile && tab.metadataDirty) {
        // If already scheduled, don't reschedule (unless we want to debounce every change? Yes)
        // Debounce: clear existing timeout, set new one

        if (timeoutsRef.current[tab.id]) {
          clearTimeout(timeoutsRef.current[tab.id]);
        }

        // precise logic:
        // When metadataDirty becomes TRUE, we start a timer.
        // If metadata changes again while dirty, we should reset timer?
        // The tabs dependency array means this effect runs on every tabs change.
        // So yes, every change re-evaluates.

        // Set "saving" status immediately on change
        if (tab.savingStatus !== "saving") {
          setSavingStatus(tab.id, "saving");
        }

        timeoutsRef.current[tab.id] = setTimeout(async () => {
          try {
            if (tab.dtexMetadata) {
              await DtexService.saveMetadata(tab.id, tab.dtexMetadata);

              // On success
              markMetadataDirty(tab.id, false);
              setSavingStatus(tab.id, "saved");

              // Clear "saved" status after a few seconds?
              // Or keep it until next change. "Saved" is good.
              setTimeout(() => {
                // Optional: clear status to plain state
                // setSavingStatus(tab.id, undefined);
              }, 3000);
            }
          } catch (error) {
            console.error("Auto-save failed for", tab.id, error);
            setSavingStatus(tab.id, "error");
          } finally {
            delete timeoutsRef.current[tab.id];
          }
        }, 2000); // 2 second debounce
      }
    });

    // Cleanup function not needed for individual timeouts since we want them to persist
    // But if component unmounts, we should clear?
    // For now, this hook lives in App, so only unmounts on close.
  }, [tabs, markMetadataDirty, setSavingStatus]);
};
