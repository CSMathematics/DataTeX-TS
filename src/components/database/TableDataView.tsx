import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  ScrollArea,
  Text,
  LoadingOverlay,
  Box,
  Group,
  Button,
  TextInput,
  Pagination,
  Code,
  ActionIcon,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faSync,
  faDatabase,
  faCheck,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { invoke } from "@tauri-apps/api/core";

// Type for data
type RowData = Record<string, any>;

interface TableDataViewProps {
  tableName: string;
  onOpenFile?: (path: string) => void;
}

export const TableDataView: React.FC<TableDataViewProps> = ({
  tableName,
  onOpenFile,
}) => {
  const [data, setData] = useState<RowData[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dbPath, setDbPath] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  // Editing state
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    col: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");

  // Initialize DB path
  useEffect(() => {
    const getPath = async () => {
      try {
        const path = await invoke<string>("get_db_path");
        setDbPath(path);
      } catch (e) {
        console.error("Failed to get DB path:", e);
      }
    };
    getPath();
  }, []);

  const fetchData = useCallback(async () => {
    if (!dbPath) return;

    setLoading(true);
    try {
      // Use Backend Command
      // Response: { data: RowData[], total_count: i64, columns: string[] }
      interface TableResponse {
        data: RowData[];
        total_count: number;
        columns: string[];
      }

      const result = await invoke<TableResponse>("get_table_data_cmd", {
        tableName,
        page,
        pageSize, // Pass as i64 equivalent (number in JS is fine)
        search,
        searchCols: columns,
      });

      // Update state
      setTotalCount(result.total_count);

      // Update columns if needed (or if they changed/search expanded them?)
      // We trust backend to return relevant columns or all columns if searchCols is empty?
      // Actually backend logic uses `searchCols` only for filtering. It returns ALL columns in `columns` field.
      if (columns.length === 0 && result.columns.length > 0) {
        setColumns(result.columns);
      }

      setData(result.data);
    } catch (e) {
      console.error("Failed to fetch data:", e);
    } finally {
      setLoading(false);
    }
  }, [dbPath, tableName, page, search, columns]);

  // Reset state when table changes
  useEffect(() => {
    setColumns([]);
    setData([]);
    setPage(1);
    setSearch("");
  }, [tableName]);

  useEffect(() => {
    if (dbPath) {
      fetchData();
    }
  }, [dbPath, tableName, page, fetchData]);

  const handleRefresh = () => {
    fetchData();
  };

  const handleStartEdit = (rowIndex: number, col: string, value: any) => {
    // Prevent editing ID or special columns if needed
    if (col === "id") return;

    setEditingCell({ rowIndex, col });
    setEditValue(
      typeof value === "object" ? JSON.stringify(value) : String(value)
    );
  };

  const handleSaveEdit = async () => {
    if (!editingCell || !dbPath) return;

    const { rowIndex, col } = editingCell;
    const row = data[rowIndex];
    const id = row.id;

    if (!id) {
      console.error("Cannot update row without ID");
      setEditingCell(null);
      return;
    }

    try {
      await invoke("update_cell_cmd", {
        tableName,
        id,
        column: col,
        value: editValue,
      });

      // Optimistic update
      const newData = [...data];
      newData[rowIndex] = { ...newData[rowIndex], [col]: editValue };
      setData(newData);

      setEditingCell(null);
    } catch (e) {
      console.error("Update failed:", e);
      alert("Update failed: " + String(e));
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const renderCellContent = (value: any) => {
    if (value === null || value === undefined)
      return (
        <Text size="xs" c="dimmed">
          NULL
        </Text>
      );

    if (
      typeof value === "object" ||
      (typeof value === "string" &&
        (value.startsWith("{") || value.startsWith("[")))
    ) {
      try {
        const obj = typeof value === "string" ? JSON.parse(value) : value;
        return (
          <Code
            block
            style={{ maxHeight: 50, overflow: "hidden", fontSize: 10 }}
          >
            {JSON.stringify(obj)}
          </Code>
        );
      } catch (e) {
        return (
          <Text
            size="sm"
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 300,
            }}
          >
            {String(value)}
          </Text>
        );
      }
    }

    return (
      <Text
        size="sm"
        style={{
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: 300,
        }}
      >
        {String(value)}
      </Text>
    );
  };

  return (
    <Box
      h="100%"
      style={{ display: "flex", flexDirection: "column" }}
      p="md"
      bg="var(--mantine-color-body)"
    >
      {/* Toolbar */}
      <Group mb="md" justify="space-between">
        <Group>
          <FontAwesomeIcon
            icon={faDatabase}
            style={{ width: 20, height: 20, color: "#69db7c" }}
          />
          <Text size="lg" fw={700} c="gray.3">
            Table:{" "}
            <Text span c="white">
              {tableName}
            </Text>
          </Text>
        </Group>
        <Group>
          <TextInput
            placeholder="Search..."
            leftSection={
              <FontAwesomeIcon
                icon={faSearch}
                style={{ width: 14, height: 14 }}
              />
            }
            size="xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") fetchData();
            }}
          />
          <Button
            variant="light"
            size="xs"
            leftSection={
              <FontAwesomeIcon
                icon={faSync}
                style={{ width: 14, height: 14 }}
              />
            }
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      {/* Table Area */}
      <Box
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          border: "1px solid #373A40",
          borderRadius: 4,
        }}
        bg="var(--mantine-color-default-hover)"
      >
        <LoadingOverlay visible={loading} />
        <ScrollArea h="100%">
          <Table stickyHeader striped highlightOnHover>
            <Table.Thead bg="var(--mantine-color-default)">
              <Table.Tr>
                {columns.map((col) => (
                  <Table.Th
                    key={col}
                    style={{ whiteSpace: "nowrap", color: "#ccc" }}
                  >
                    {col.toUpperCase()}
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((row, rowIndex) => (
                <Table.Tr
                  key={rowIndex}
                  onDoubleClick={() => {
                    if (onOpenFile && row.path) {
                      onOpenFile(row.path);
                    }
                  }}
                >
                  {columns.map((col) => {
                    const isEditing =
                      editingCell?.rowIndex === rowIndex &&
                      editingCell?.col === col;
                    return (
                      <Table.Td
                        key={`${rowIndex}-${col}`}
                        style={{
                          whiteSpace: "nowrap",
                          color: "#999",
                          maxWidth: 300,
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation(); // Prevent row double click
                          handleStartEdit(rowIndex, col, row[col]);
                        }}
                      >
                        {isEditing ? (
                          <Group gap={4} wrap="nowrap">
                            <TextInput
                              size="xs"
                              autoFocus
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveEdit();
                                if (e.key === "Escape") handleCancelEdit();
                              }}
                            />
                            <ActionIcon
                              size="xs"
                              color="green"
                              onClick={handleSaveEdit}
                            >
                              <FontAwesomeIcon icon={faCheck} />
                            </ActionIcon>
                            <ActionIcon
                              size="xs"
                              color="red"
                              onClick={handleCancelEdit}
                            >
                              <FontAwesomeIcon icon={faTimes} />
                            </ActionIcon>
                          </Group>
                        ) : (
                          renderCellContent(row[col])
                        )}
                      </Table.Td>
                    );
                  })}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Box>

      {/* Pagination */}
      <Group justify="flex-end" mt="md">
        <Text size="xs" c="dimmed">
          Total: {totalCount}
        </Text>
        <Pagination
          total={Math.ceil(totalCount / pageSize)}
          value={page}
          onChange={setPage}
          size="sm"
        />
      </Group>
    </Box>
  );
};
