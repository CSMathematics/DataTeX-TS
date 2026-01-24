import React, { useState, useEffect } from "react";
import {
  Modal,
  Stack,
  Text,
  Button,
  Group,
  Radio,
  Select,
  Progress,
  Box,
  ScrollArea,
  Alert,
} from "@mantine/core";
import { useDatabaseStore } from "../../stores/databaseStore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faExclamationCircle,
} from "@fortawesome/free-solid-svg-icons";

export interface BatchExportModalProps {
  opened: boolean;
  onClose: () => void;
  onExport: (
    scope: "all" | "collection",
    collectionName?: string,
  ) => Promise<void>;
  isExporting: boolean;
  progress?: {
    current: number;
    total: number;
    success: number;
    failed: number;
    currentFile?: string;
  };
  results?: {
    success: number;
    failed: number;
    errors: Array<{ file: string; error: string }>;
  } | null;
}

export const BatchExportModal: React.FC<BatchExportModalProps> = ({
  opened,
  onClose,
  onExport,
  isExporting,
  progress,
  results,
}) => {
  const collections = useDatabaseStore((state) => state.collections);
  const [scope, setScope] = useState<"all" | "collection">("all");
  const [selectedCollection, setSelectedCollection] = useState<string | null>(
    null,
  );

  // Reset state when opened
  useEffect(() => {
    if (opened && !isExporting && !results) {
      setScope("all");
      if (collections.length > 0) {
        setSelectedCollection(collections[0].name);
      }
    }
  }, [opened, collections, isExporting, results]);

  const handleStartExport = () => {
    if (scope === "collection" && !selectedCollection) return;
    onExport(scope, selectedCollection || undefined);
  };

  const collectionOptions = collections.map((c) => ({
    value: c.name,
    label: c.name,
  }));

  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (!isExporting) onClose();
      }}
      title="Batch Export to .dtex"
      size="md"
      closeOnClickOutside={!isExporting}
      closeOnEscape={!isExporting}
    >
      <Stack gap="md">
        {!isExporting && !results ? (
          <>
            <Text size="sm" c="dimmed">
              Convert existing TeX files in your database to the .dtex format.
              The new files will be created alongside the original files.
            </Text>

            <Radio.Group
              value={scope}
              onChange={(val) => setScope(val as "all" | "collection")}
              label="Export Scope"
              withAsterisk
            >
              <Group mt="xs">
                <Radio value="all" label="Entire Database" />
                <Radio value="collection" label="Specific Collection" />
              </Group>
            </Radio.Group>

            {scope === "collection" && (
              <Select
                label="Select Collection"
                placeholder="Choose a collection"
                data={collectionOptions}
                value={selectedCollection}
                onChange={setSelectedCollection}
                searchable
              />
            )}

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleStartExport}
                disabled={scope === "collection" && !selectedCollection}
              >
                Start Export
              </Button>
            </Group>
          </>
        ) : isExporting ? (
          <>
            <Text size="sm" fw={500}>
              Exporting files...
            </Text>
            {progress && (
              <>
                <Progress
                  value={(progress.current / progress.total) * 100}
                  animated
                  size="xl"
                  radius="xl"
                />
                <Group justify="space-between" mt="xs">
                  <Text size="xs" c="dimmed">
                    {progress.current} / {progress.total}
                  </Text>
                  <Text size="xs" c="dimmed" truncate style={{ maxWidth: 200 }}>
                    {progress.currentFile}
                  </Text>
                </Group>
              </>
            )}
          </>
        ) : results ? (
          <>
            <Alert
              icon={
                <FontAwesomeIcon
                  icon={
                    results.failed === 0 ? faCheckCircle : faExclamationCircle
                  }
                />
              }
              title={
                results.failed === 0
                  ? "Export Completed Successfully"
                  : "Export Completed with Errors"
              }
              color={results.failed === 0 ? "green" : "yellow"}
            >
              processed {results.success + results.failed} files.
              {results.success} succeeded, {results.failed} failed.
            </Alert>

            {results.failed > 0 && (
              <Stack mt="sm">
                <Text size="sm" fw={500}>
                  Failed Files:
                </Text>
                <ScrollArea h={150} type="always" offsetScrollbars>
                  <Stack gap="xs">
                    {results.errors.map((err, idx) => (
                      <Box
                        key={idx}
                        p="xs"
                        bg="var(--mantine-color-error-light)"
                      >
                        <Text size="xs" fw={700}>
                          {err.file}
                        </Text>
                        <Text size="xs" c="red">
                          {err.error}
                        </Text>
                      </Box>
                    ))}
                  </Stack>
                </ScrollArea>
              </Stack>
            )}

            <Group justify="flex-end" mt="md">
              <Button onClick={onClose}>Close</Button>
            </Group>
          </>
        ) : null}
      </Stack>
    </Modal>
  );
};
