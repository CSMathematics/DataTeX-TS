/**
 * DTEX Import Modal
 *
 * Modal dialog shown when opening a .dtex file whose source database
 * is not in the collections list. Shows preview of code and metadata,
 * with options to create database, add to existing, or open standalone.
 */

import React, { useState, useMemo } from "react";
import {
  Modal,
  Grid,
  Text,
  Group,
  Stack,
  Radio,
  Select,
  Button,
  Code,
  Table,
  ScrollArea,
  Badge,
  Divider,
  Alert,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDatabase,
  faFolderPlus,
  faFileImport,
  faFile,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import { useDatabaseStore } from "../../stores/databaseStore";
import type { DtexFile } from "../../types/dtex";

// ============================================================================
// Types
// ============================================================================

export type ImportOption =
  | { type: "create-database" }
  | { type: "add-to-existing"; collectionId: string }
  | { type: "standalone" };

interface DtexImportModalProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Callback when modal closes */
  onClose: () => void;
  /** The parsed .dtex file */
  dtexFile: DtexFile | null;
  /** Path to the .dtex file on disk */
  filePath: string;
  /** Callback when user selects an import option */
  onImport: (option: ImportOption) => void;
}

// ============================================================================
// Component
// ============================================================================

export const DtexImportModal: React.FC<DtexImportModalProps> = ({
  opened,
  onClose,
  dtexFile,
  onImport,
}) => {
  // filePath can be used for display if needed
  const collections = useDatabaseStore((state) => state.collections);

  const [selectedOption, setSelectedOption] = useState<string>("standalone");
  const [selectedCollection, setSelectedCollection] = useState<string | null>(
    null,
  );

  // Get available databases for dropdown
  const databaseOptions = useMemo(() => {
    return collections.map((c) => ({
      value: c.name, // Use name as unique identifier
      label: c.name,
    }));
  }, [collections]);

  // Extract first 15 lines of code for preview
  const codePreview = useMemo(() => {
    if (!dtexFile?.content?.latex) return "";
    const lines = dtexFile.content.latex.split("\n");
    return lines.slice(0, 15).join("\n") + (lines.length > 15 ? "\n..." : "");
  }, [dtexFile]);

  // Build metadata list for display
  const metadataItems = useMemo(() => {
    if (!dtexFile?.metadata) return [];

    const m = dtexFile.metadata;
    const items: { label: string; value: string }[] = [];

    items.push({ label: "File Type", value: m.fileType || "file" });

    if (m.description) {
      items.push({
        label: "Description",
        value:
          m.description.substring(0, 50) +
          (m.description.length > 50 ? "..." : ""),
      });
    }

    if (m.difficulty !== undefined) {
      items.push({ label: "Difficulty", value: String(m.difficulty) });
    }

    if (m.field) {
      items.push({ label: "Field", value: m.field });
    }

    if (m.taxonomy?.field?.name) {
      items.push({ label: "Taxonomy Field", value: m.taxonomy.field.name });
    }

    if (m.taxonomy?.chapter?.name) {
      items.push({ label: "Chapter", value: m.taxonomy.chapter.name });
    }

    if (m.taxonomy?.section?.name) {
      items.push({ label: "Section", value: m.taxonomy.section.name });
    }

    if (m.buildCommand) {
      items.push({ label: "Build Command", value: m.buildCommand });
    }

    return items;
  }, [dtexFile]);

  const handleImport = () => {
    if (selectedOption === "create-database") {
      onImport({ type: "create-database" });
    } else if (selectedOption === "add-to-existing" && selectedCollection) {
      onImport({ type: "add-to-existing", collectionId: selectedCollection });
    } else {
      onImport({ type: "standalone" });
    }
    onClose();
  };

  if (!dtexFile) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <FontAwesomeIcon icon={faFileImport} />
          <Text fw={600}>Import DTEX File</Text>
        </Group>
      }
      size="xl"
      centered
    >
      <Stack gap="md">
        {/* Database Info Alert */}
        <Alert
          icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
          color="yellow"
          variant="light"
        >
          <Text size="sm">
            The source database <strong>"{dtexFile.database.name}"</strong> is
            not in your collections.
          </Text>
          {dtexFile.database.path && (
            <Text size="xs" c="dimmed" mt={4}>
              Original path: {dtexFile.database.path}
            </Text>
          )}
        </Alert>

        {/* Split View: Code Preview + Metadata */}
        <Grid>
          {/* Code Preview */}
          <Grid.Col span={6}>
            <Text size="sm" fw={600} mb="xs">
              Code Preview
            </Text>
            <ScrollArea
              h={200}
              style={{
                border: "1px solid var(--mantine-color-default-border)",
                borderRadius: 4,
              }}
            >
              <Code block style={{ fontSize: 11, background: "transparent" }}>
                {codePreview || "No content"}
              </Code>
            </ScrollArea>
          </Grid.Col>

          {/* Metadata List */}
          <Grid.Col span={6}>
            <Text size="sm" fw={600} mb="xs">
              Metadata
            </Text>
            <ScrollArea
              h={200}
              style={{
                border: "1px solid var(--mantine-color-default-border)",
                borderRadius: 4,
              }}
            >
              <Table withColumnBorders={false}>
                <Table.Tbody>
                  {metadataItems.map((item, i) => (
                    <Table.Tr key={i}>
                      <Table.Td style={{ width: "40%" }}>
                        <Text size="xs" c="dimmed">
                          {item.label}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{item.value}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {metadataItems.length === 0 && (
                    <Table.Tr>
                      <Table.Td colSpan={2}>
                        <Text size="xs" c="dimmed">
                          No metadata available
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Grid.Col>
        </Grid>

        <Divider />

        {/* Import Options */}
        <Radio.Group
          value={selectedOption}
          onChange={setSelectedOption}
          label="How would you like to import this file?"
        >
          <Stack gap="sm" mt="xs">
            <Radio
              value="create-database"
              label={
                <Group gap="xs">
                  <FontAwesomeIcon icon={faFolderPlus} />
                  <Text size="sm">Create database at original path</Text>
                  {dtexFile.database.path && (
                    <Badge size="xs" variant="light" color="gray">
                      {dtexFile.database.path}
                    </Badge>
                  )}
                </Group>
              }
            />

            <Radio
              value="add-to-existing"
              label={
                <Group gap="xs">
                  <FontAwesomeIcon icon={faDatabase} />
                  <Text size="sm">Add to existing database</Text>
                </Group>
              }
            />

            {selectedOption === "add-to-existing" && (
              <Select
                placeholder="Select a database"
                data={databaseOptions}
                value={selectedCollection}
                onChange={setSelectedCollection}
                ml="xl"
                style={{ maxWidth: 300 }}
              />
            )}

            <Radio
              value="standalone"
              label={
                <Group gap="xs">
                  <FontAwesomeIcon icon={faFile} />
                  <Text size="sm">Open as standalone (no database sync)</Text>
                </Group>
              }
            />
          </Stack>
        </Radio.Group>

        {/* Action Buttons */}
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            leftSection={<FontAwesomeIcon icon={faFileImport} />}
            onClick={handleImport}
            disabled={
              selectedOption === "add-to-existing" && !selectedCollection
            }
          >
            Import
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default DtexImportModal;
