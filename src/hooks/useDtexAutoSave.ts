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

  // Keep one debounce timer and metadata snapshot per file. Tracking the
  // snapshot prevents unrelated tab updates (for example savingStatus) from
  // continuously resetting every pending save.
  const timeoutsRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const scheduledMetadataRef = useRef<Record<string, unknown>>({});

  useEffect(() => {
    const dirtyTabIds = new Set<string>();

    tabs.forEach((tab) => {
      if (tab.isDtexFile && tab.metadataDirty && tab.dtexMetadata) {
        dirtyTabIds.add(tab.id);

        // A status-only store update keeps the same metadata object and must
        // not restart the debounce timer.
        if (scheduledMetadataRef.current[tab.id] === tab.dtexMetadata) {
          return;
        }

        if (timeoutsRef.current[tab.id]) {
          clearTimeout(timeoutsRef.current[tab.id]);
        }

        const metadataToSave = tab.dtexMetadata;
        scheduledMetadataRef.current[tab.id] = metadataToSave;

        if (tab.savingStatus !== "saving") {
          setSavingStatus(tab.id, "saving");
        }

        const timeout = setTimeout(async () => {
          try {
            await DtexService.saveMetadata(tab.id, metadataToSave);

            // Do not clear the dirty flag if metadata changed while this save
            // was in flight. A newer timer is responsible for that snapshot.
            const currentTab = useTabsStore.getState().getTabById(tab.id);
            if (currentTab?.dtexMetadata === metadataToSave) {
              markMetadataDirty(tab.id, false);
              setSavingStatus(tab.id, "saved");
            }
          } catch (error) {
            console.error("Auto-save failed for", tab.id, error);
            const currentTab = useTabsStore.getState().getTabById(tab.id);
            if (currentTab?.dtexMetadata === metadataToSave) {
              setSavingStatus(tab.id, "error");
            }
          } finally {
            // An older save must never erase the handle/snapshot belonging to
            // a newer edit.
            if (timeoutsRef.current[tab.id] === timeout) {
              delete timeoutsRef.current[tab.id];
              if (
                scheduledMetadataRef.current[tab.id] === metadataToSave
              ) {
                delete scheduledMetadataRef.current[tab.id];
              }
            }
          }
        }, 2000);

        timeoutsRef.current[tab.id] = timeout;
      }
    });

    // Cancel pending saves for tabs that became clean or were closed.
    Object.keys(timeoutsRef.current).forEach((tabId) => {
      if (!dirtyTabIds.has(tabId)) {
        clearTimeout(timeoutsRef.current[tabId]);
        delete timeoutsRef.current[tabId];
        delete scheduledMetadataRef.current[tabId];
      }
    });
  }, [tabs, markMetadataDirty, setSavingStatus]);

  useEffect(
    () => () => {
      Object.values(timeoutsRef.current).forEach(clearTimeout);
      timeoutsRef.current = {};
      scheduledMetadataRef.current = {};
    },
    [],
  );
};
