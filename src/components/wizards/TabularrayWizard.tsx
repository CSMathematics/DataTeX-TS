import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Grid,
  Button,
  TextInput,
  Switch,
  ActionIcon,
  Group,
  Stack,
  Text,
  ScrollArea,
  Divider,
  Code,
  Tooltip,
  Box,
  Select,
  ColorPicker,
  Popover,
  SegmentedControl,
  Tabs,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAlignLeft,
  faAlignCenter,
  faAlignRight,
  faBold,
  faItalic,
  faFillDrip,
  faCompressAlt,
  faExpandAlt,
  faEraser,
  faGripLines,
  faCog,
  faPlus,
  faTrash,
  faBorderAll,
  faGripVertical,
} from "@fortawesome/free-solid-svg-icons";

interface TabularrayWizardProps {
  onInsert: (code: string) => void;
}

// Extended Cell Data for Tabularray
interface CellData {
  id: string;
  content: string;
  rowSpan: number;
  colSpan: number;
  hidden: boolean; // For merged cells hidden by a master cell
  // Styling
  bold?: boolean;
  italic?: boolean;
  fgColor?: string;
  bgColor?: string;
  halign?: "l" | "c" | "r" | "j"; // Left, Center, Right, Justify
  valign?: "h" | "m" | "f"; // Head, Middle, Foot
  font?: string; // Custom font commands e.g. \bfseries
}

// Column Options
interface ColOption {
  type: string; // 'l', 'c', 'r', 'Q', 'X'
  width?: string; // For Q/X e.g. '2' or '1cm'
  sep?: string; // Custom colsep if needed
}

// Row Options
interface RowOption {
  sep?: string; // Custom rowsep
  valign?: "h" | "m" | "f";
}

interface Selection {
  startR: number;
  startC: number;
  endR: number;
  endC: number;
}

export const TabularrayWizard: React.FC<TabularrayWizardProps> = ({
  onInsert,
}) => {
  // --- Grid State ---
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(4);

  const createCell = (r: number, c: number): CellData => ({
    id: `${r}-${c}`,
    content: "",
    rowSpan: 1,
    colSpan: 1,
    hidden: false,
  });

  const [grid, setGrid] = useState<CellData[][]>(() => {
    const initialGrid: CellData[][] = [];
    for (let r = 0; r < 4; r++) {
      const row: CellData[] = [];
      for (let c = 0; c < 4; c++) {
        row.push(createCell(r, c));
      }
      initialGrid.push(row);
    }
    return initialGrid;
  });

  // --- Layout State ---
  const [colOptions, setColOptions] = useState<ColOption[]>(
    Array(4).fill({ type: "c" })
  );
  const [rowOptions, setRowOptions] = useState<RowOption[]>(Array(4).fill({}));

  // --- Selection State ---
  const [isSelecting, setIsSelecting] = useState(false);
  const [selection, setSelection] = useState<Selection>({
    startR: 0,
    startC: 0,
    endR: 0,
    endC: 0,
  });
  const [activeCell, setActiveCell] = useState<{ r: number; c: number }>({
    r: 0,
    c: 0,
  });

  // --- Global Options ---
  const [theme, setTheme] = useState(""); // e.g. 'booktabs'
  const [hlines, setHlines] = useState<boolean>(true);
  const [vlines, setVlines] = useState<boolean>(true);
  const [caption, setCaption] = useState("");
  const [label, setLabel] = useState("");
  const [width, setWidth] = useState(""); // Table width if applicable
  const [longTable, setLongTable] = useState(false); // longtblr vs tblr

  // --- Toolbar State ---
  const [activeColor, setActiveColor] = useState("#f0f0f0");
  const [activeColorMode, setActiveColorMode] = useState<"bg" | "fg">("bg");

  // --- Resize Logic ---
  const [splitRatio, setSplitRatio] = useState(60);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Handlers: Grid Management ---
  const addRow = () => {
    const newGrid = [...grid];
    const newRow: CellData[] = [];
    for (let c = 0; c < cols; c++) {
      newRow.push(createCell(rows, c));
    }
    newGrid.push(newRow);
    setGrid(newGrid);
    setRowOptions([...rowOptions, {}]);
    setRows((r) => r + 1);
  };

  const addCol = () => {
    const newGrid = grid.map((row, r) => [...row, createCell(r, cols)]);
    setGrid(newGrid);
    setColOptions([...colOptions, { type: "c" }]);
    setCols((c) => c + 1);
  };

  const deleteRow = () => {
    if (rows <= 1) return;
    const r = activeCell.r;
    if (grid[r].some((cell) => cell.content.trim() !== "")) {
      if (!confirm("Row contains data. Delete anyway?")) return;
    }
    const newGrid = grid.filter((_, idx) => idx !== r);
    setGrid(newGrid);
    setRowOptions(rowOptions.filter((_, idx) => idx !== r));
    setRows((prev) => prev - 1);
    setActiveCell((prev) => ({
      ...prev,
      r: Math.max(0, newGrid.length - 1),
    }));
  };

  const deleteCol = () => {
    if (cols <= 1) return;
    const c = activeCell.c;
    if (grid.some((row) => row[c].content.trim() !== "")) {
      if (!confirm("Column contains data. Delete anyway?")) return;
    }
    const newGrid = grid.map((row) => row.filter((_, idx) => idx !== c));
    setGrid(newGrid);
    setColOptions(colOptions.filter((_, idx) => idx !== c));
    setCols((prev) => prev - 1);
    setActiveCell((prev) => ({
      ...prev,
      c: Math.max(0, newGrid[0].length - 1),
    }));
  };

  // --- Render Helpers ---
  const getSelectedRange = () => {
    const minR = Math.min(selection.startR, selection.endR);
    const maxR = Math.max(selection.startR, selection.endR);
    const minC = Math.min(selection.startC, selection.endC);
    const maxC = Math.max(selection.startC, selection.endC);
    return { minR, maxR, minC, maxC };
  };

  // --- Check Cell Merging Compliance ---
  // If selection is multiple cells, we can merge.
  // If single cell is merged (span > 1), we can split.

  const mergeCells = () => {
    const { minR, maxR, minC, maxC } = getSelectedRange();
    if (minR === maxR && minC === maxC) return; // Single cell selected

    const newGrid = [...grid];
    const master = newGrid[minR][minC];
    master.rowSpan = maxR - minR + 1;
    master.colSpan = maxC - minC + 1;
    master.hidden = false;

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (r === minR && c === minC) continue;
        newGrid[r][c].hidden = true;
        newGrid[r][c].rowSpan = 1;
        newGrid[r][c].colSpan = 1;
        newGrid[r][c].content = ""; // Clear content of merged cells
      }
    }
    setGrid(newGrid);
  };

  const splitCells = () => {
    const { minR, maxR, minC, maxC } = getSelectedRange();
    const newGrid = [...grid];
    // Check all selected cells. If any is a master of a merge, split it.
    let changed = false;

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cell = newGrid[r][c];
        if (!cell.hidden && (cell.rowSpan > 1 || cell.colSpan > 1)) {
          // Restore hidden cells
          for (let i = 0; i < cell.rowSpan; i++) {
            for (let j = 0; j < cell.colSpan; j++) {
              if (i === 0 && j === 0) continue;
              newGrid[r + i][c + j].hidden = false;
            }
          }
          cell.rowSpan = 1;
          cell.colSpan = 1;
          changed = true;
        }
      }
    }
    if (changed) setGrid(newGrid);
  };

  // --- Styling ---
  const updateSelectedCells = (updater: (cell: CellData) => CellData) => {
    const { minR, maxR, minC, maxC } = getSelectedRange();
    const newGrid = [...grid];
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (!newGrid[r][c].hidden) {
          newGrid[r][c] = updater(newGrid[r][c]);
        }
      }
    }
    setGrid(newGrid);
  };

  const handleApplyColor = () => {
    updateSelectedCells((c) => ({
      ...c,
      [activeColorMode === "bg" ? "bgColor" : "fgColor"]: activeColor,
    }));
  };

  // --- Selection Mouse Handlers ---
  const handleMouseDown = (r: number, c: number) => {
    setIsSelecting(true);
    setSelection({ startR: r, startC: c, endR: r, endC: c });
    setActiveCell({ r, c });
  };
  const handleMouseEnter = (r: number, c: number) => {
    if (isSelecting) {
      setSelection((prev) => ({ ...prev, endR: r, endC: c }));
    }
  };
  const handleMouseUp = () => setIsSelecting(false);

  // --- Code Generation ---
  const generateCode = () => {
    // Determine Environment
    const env = longTable ? "longtblr" : "tblr";
    let code = `\\begin{${env}}[\n`;

    // 1. General Options
    if (caption) code += `  caption = {${caption}},\n`;
    if (label) code += `  label = {${label}},\n`;
    if (theme) code += `  theme = ${theme},\n`;

    // 2. Column Specifications
    // Build colspec string e.g. colspec = { |c|X[2]|Q[r]| }
    // We utilize global hlines/vlines options for simplicity, or build intricate ones if needed.
    // For now, let's use the 'vlines' option of tabularray if global is checked.
    if (vlines) code += `  vlines,\n`;
    if (hlines) code += `  hlines,\n`;

    const colSpecParts = colOptions.map((opt) => {
      let spec = opt.type;
      if ((opt.type === "X" || opt.type === "Q") && opt.width) {
        spec += `[${opt.width}]`;
      }
      return spec;
    });
    code += `  colspec = {${colSpecParts.join(" ")}},\n`;

    // 3. Row Specifications
    // If specific row options exist (like specific row customization), add here.
    // row{1} = {font=\bfseries} etc.

    // 4. Cell Specifications (Merging, Colors, Styles)
    // We iterate grid to find exceptions.
    const cellSpecs: string[] = [];

    grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell.hidden) return;
        const props: string[] = [];

        // Spanning
        if (cell.rowSpan > 1) props.push(`r=${cell.rowSpan}`);
        if (cell.colSpan > 1) props.push(`c=${cell.colSpan}`);

        // Alignment
        if (cell.halign) props.push(`halign=${cell.halign}`);
        if (cell.valign) props.push(`valign=${cell.valign}`);

        // Colors
        if (cell.bgColor) props.push(`bg=${cell.bgColor}`);
        if (cell.fgColor) props.push(`fg=${cell.fgColor}`);

        // Styles
        if (cell.bold) props.push(`font=\\bfseries`);
        if (cell.italic) props.push(`font=\\itshape`); // Assuming italic overrides bold or appends? Tabularray font key replaces. simple for now.

        // If we have properties, add a spec
        if (props.length > 0) {
          // Tabularray uses 1-based indexing
          cellSpecs.push(`  cell{${r + 1}}{${c + 1}} = {${props.join(", ")}},`);
        }
      });
    });

    if (cellSpecs.length > 0) {
      code += cellSpecs.join("\n") + "\n";
    }

    code += `]{\n`;

    // 5. Content

    // Correct Content Generation Loop
    grid.forEach((row) => {
      const lineCells = row.map((cell) => {
        if (cell.hidden) return ""; // Empty for covered cells
        return cell.content;
      });
      code += `  ${lineCells.join(" & ")} \\\\\n`;
    });

    code += `\\end{${env}}`;
    return code;
  };

  // --- Resize Handler Code ---
  // (Identical to TableWizard)
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (isResizing && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        const percentage = (offsetY / rect.height) * 100;
        setSplitRatio(Math.max(20, Math.min(percentage, 80)));
      }
    };
    const up = () => setIsResizing(false);
    if (isResizing) {
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
      document.body.style.cursor = "row-resize";
    } else {
      document.body.style.cursor = "default";
    }
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [isResizing]);

  const { minR, maxR, minC, maxC } = getSelectedRange();

  return (
    <Stack
      gap={0}
      h="100%"
      ref={containerRef}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ overflow: "hidden" }}
    >
      {/* Toolbar */}
      <Group
        p="xs"
        bg="var(--mantine-color-default)"
        style={{
          borderBottom: "1px solid var(--mantine-color-default-border)",
        }}
        gap={4}
      >
        {/* ROW OPS */}
        <Group gap={0}>
          <Tooltip label="Add Row">
            <ActionIcon variant="subtle" size="sm" onClick={addRow}>
              <FontAwesomeIcon icon={faPlus} style={{ width: 14 }} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete Row">
            <ActionIcon
              variant="subtle"
              size="sm"
              color="red"
              onClick={deleteRow}
            >
              <FontAwesomeIcon icon={faTrash} style={{ width: 14 }} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Divider orientation="vertical" />

        {/* COL OPS */}
        <Group gap={0}>
          <Tooltip label="Add Column">
            <ActionIcon variant="subtle" size="sm" onClick={addCol}>
              <FontAwesomeIcon
                icon={faPlus}
                transform={{ rotate: 90 }}
                style={{ width: 14 }}
              />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete Column">
            <ActionIcon
              variant="subtle"
              size="sm"
              color="red"
              onClick={deleteCol}
            >
              <FontAwesomeIcon
                icon={faTrash}
                transform={{ rotate: 90 }}
                style={{ width: 14 }}
              />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Divider orientation="vertical" />

        {/* MERGE/SPLIT */}
        <Tooltip label="Merge">
          <ActionIcon variant="subtle" size="sm" onClick={mergeCells}>
            <FontAwesomeIcon icon={faCompressAlt} style={{ width: 14 }} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Split">
          <ActionIcon variant="subtle" size="sm" onClick={splitCells}>
            <FontAwesomeIcon icon={faExpandAlt} style={{ width: 14 }} />
          </ActionIcon>
        </Tooltip>
        <Divider orientation="vertical" />

        {/* FORMATTING */}
        <Tooltip label="Bold">
          <ActionIcon
            variant={
              grid[activeCell.r][activeCell.c].bold ? "filled" : "subtle"
            }
            size="sm"
            onClick={() =>
              updateSelectedCells((c) => ({ ...c, bold: !c.bold }))
            }
          >
            <FontAwesomeIcon icon={faBold} style={{ width: 14 }} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Italic">
          <ActionIcon
            variant={
              grid[activeCell.r][activeCell.c].italic ? "filled" : "subtle"
            }
            size="sm"
            onClick={() =>
              updateSelectedCells((c) => ({ ...c, italic: !c.italic }))
            }
          >
            <FontAwesomeIcon icon={faItalic} style={{ width: 14 }} />
          </ActionIcon>
        </Tooltip>

        <Divider orientation="vertical" />
        {/* ALIGNMENT */}
        <Tooltip label="Left">
          <ActionIcon
            variant={
              grid[activeCell.r][activeCell.c].halign === "l"
                ? "filled"
                : "subtle"
            }
            size="sm"
            onClick={() => updateSelectedCells((c) => ({ ...c, halign: "l" }))}
          >
            <FontAwesomeIcon icon={faAlignLeft} style={{ width: 14 }} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Center">
          <ActionIcon
            variant={
              grid[activeCell.r][activeCell.c].halign === "c"
                ? "filled"
                : "subtle"
            }
            size="sm"
            onClick={() => updateSelectedCells((c) => ({ ...c, halign: "c" }))}
          >
            <FontAwesomeIcon icon={faAlignCenter} style={{ width: 14 }} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Right">
          <ActionIcon
            variant={
              grid[activeCell.r][activeCell.c].halign === "r"
                ? "filled"
                : "subtle"
            }
            size="sm"
            onClick={() => updateSelectedCells((c) => ({ ...c, halign: "r" }))}
          >
            <FontAwesomeIcon icon={faAlignRight} style={{ width: 14 }} />
          </ActionIcon>
        </Tooltip>

        <Divider orientation="vertical" />
        {/* COLORS */}
        <SegmentedControl
          size="xs"
          value={activeColorMode}
          onChange={(v: any) => setActiveColorMode(v)}
          data={[
            { label: "BG", value: "bg" },
            { label: "FG", value: "fg" },
          ]}
        />
        <Popover position="bottom" withArrow shadow="md">
          <Popover.Target>
            <ActionIcon
              variant="subtle"
              size="sm"
              bg={activeColorMode === "bg" ? activeColor : undefined}
              c={activeColorMode === "fg" ? activeColor : undefined}
            >
              <FontAwesomeIcon icon={faFillDrip} style={{ width: 14 }} />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap="xs">
              <ColorPicker
                size="xs"
                value={activeColor}
                onChange={setActiveColor}
                format="hex"
              />
              <Button size="xs" fullWidth onClick={handleApplyColor}>
                Apply
              </Button>
            </Stack>
          </Popover.Dropdown>
        </Popover>
        <Tooltip label="Clear Styles">
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={() =>
              updateSelectedCells((c) => ({
                ...c,
                bold: undefined,
                italic: undefined,
                bgColor: undefined,
                fgColor: undefined,
                halign: undefined,
              }))
            }
          >
            <FontAwesomeIcon icon={faEraser} style={{ width: 14 }} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* Grid Editor */}
      <Box
        style={{
          height: `${splitRatio}%`,
          overflow: "auto",
          position: "relative",
        }}
        bg="var(--mantine-color-body)"
        p="md"
      >
        <div style={{ display: "inline-block" }}>
          <table
            style={{
              borderCollapse: "collapse",
              color: "var(--mantine-color-gray-3)",
            }}
          >
            <tbody>
              {grid.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => {
                    if (cell.hidden) return null;
                    const isSelected =
                      r >= minR && r <= maxR && c >= minC && c <= maxC;
                    const isActive = r === activeCell.r && c === activeCell.c;
                    return (
                      <td
                        key={cell.id}
                        rowSpan={cell.rowSpan}
                        colSpan={cell.colSpan}
                        onMouseDown={() => handleMouseDown(r, c)}
                        onMouseEnter={() => handleMouseEnter(r, c)}
                        style={{
                          border: "1px solid #444",
                          padding: 0,
                          minWidth: 60,
                          height: 30,
                          backgroundColor: isSelected
                            ? "rgba(51, 154, 240, 0.2)"
                            : cell.bgColor || "transparent",
                          color: cell.fgColor || "inherit",
                          textAlign:
                            cell.halign === "l"
                              ? "left"
                              : cell.halign === "r"
                              ? "right"
                              : cell.halign === "c"
                              ? "center"
                              : "left",
                          fontWeight: cell.bold ? "bold" : "normal",
                          fontStyle: cell.italic ? "italic" : "normal",
                          cursor: "cell",
                          position: "relative",
                        }}
                      >
                        <input
                          value={cell.content}
                          onChange={(e) => {
                            const val = e.target.value;
                            const newGrid = [...grid];
                            newGrid[r][c].content = val;
                            setGrid(newGrid);
                          }}
                          onFocus={() => setActiveCell({ r, c })}
                          style={{
                            width: "100%",
                            height: "100%",
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            color: "inherit",
                            textAlign: "inherit",
                            font: "inherit",
                            padding: "0 4px",
                            boxShadow: isActive
                              ? "inset 0 0 0 2px #339af0"
                              : "none",
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Box>

      {/* Resizer */}
      <Box
        onMouseDown={startResizing}
        style={{
          height: 6,
          cursor: "row-resize",
          backgroundColor: isResizing
            ? "var(--mantine-color-blue-6)"
            : "var(--mantine-color-default-border)",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <FontAwesomeIcon
          icon={faGripLines}
          style={{ width: 12, opacity: 0.5 }}
        />
      </Box>

      {/* Settings Panel */}
      <Box
        style={{ flex: 1, minHeight: 0 }}
        bg="var(--mantine-color-body)"
        p="md"
      >
        <Tabs defaultValue="options">
          <Tabs.List>
            <Tabs.Tab
              value="options"
              leftSection={<FontAwesomeIcon icon={faCog} size="xs" />}
            >
              Options
            </Tabs.Tab>
            <Tabs.Tab
              value="columns"
              leftSection={<FontAwesomeIcon icon={faGripVertical} size="xs" />}
            >
              Columns
            </Tabs.Tab>
            <Tabs.Tab
              value="preview"
              leftSection={<FontAwesomeIcon icon={faBorderAll} size="xs" />}
            >
              Preview
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="options" pt="xs">
            <Grid gutter="xs">
              <Grid.Col span={6}>
                <Stack gap="xs">
                  <Switch
                    label="Global Horizontal Lines"
                    checked={hlines}
                    onChange={(e) => setHlines(e.currentTarget.checked)}
                    size="xs"
                  />
                  <Switch
                    label="Global Vertical Lines"
                    checked={vlines}
                    onChange={(e) => setVlines(e.currentTarget.checked)}
                    size="xs"
                  />
                  <Switch
                    label="Long Table (longtblr)"
                    checked={longTable}
                    onChange={(e) => setLongTable(e.currentTarget.checked)}
                    size="xs"
                  />
                </Stack>
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Caption"
                  size="xs"
                  value={caption}
                  onChange={(e) => setCaption(e.currentTarget.value)}
                  mb={4}
                />
                <TextInput
                  label="Label"
                  size="xs"
                  value={label}
                  onChange={(e) => setLabel(e.currentTarget.value)}
                  mb={4}
                />
                <TextInput
                  label="Width"
                  size="xs"
                  placeholder="e.g. \linewidth"
                  value={width}
                  onChange={(e) => setWidth(e.currentTarget.value)}
                  mb={4}
                />
                <Select
                  label="Theme"
                  size="xs"
                  data={["", "booktabs", "conference", "scientific"]}
                  value={theme}
                  onChange={(v) => setTheme(v || "")}
                  clearable
                />
              </Grid.Col>
            </Grid>
          </Tabs.Panel>

          <Tabs.Panel value="columns" pt="xs">
            <Text size="xs" c="dimmed" mb="xs">
              Configure column types for {cols} columns.
            </Text>
            <ScrollArea h={120}>
              <Stack gap="xs">
                {colOptions.map((opt, idx) => (
                  <Group key={idx} gap="xs">
                    <Text size="xs" fw={700} w={30}>
                      Col {idx + 1}
                    </Text>
                    <Select
                      size="xs"
                      data={["l", "c", "r", "X", "Q"]}
                      value={opt.type}
                      onChange={(v) => {
                        const newOpts = [...colOptions];
                        newOpts[idx] = { ...newOpts[idx], type: v! };
                        setColOptions(newOpts);
                      }}
                      style={{ width: 70 }}
                    />
                    {(opt.type === "X" || opt.type === "Q") && (
                      <TextInput
                        size="xs"
                        placeholder="Width/Coeff"
                        value={opt.width || ""}
                        onChange={(e) => {
                          const newOpts = [...colOptions];
                          newOpts[idx] = {
                            ...newOpts[idx],
                            width: e.currentTarget.value,
                          };
                          setColOptions(newOpts);
                        }}
                        style={{ width: 80 }}
                      />
                    )}
                  </Group>
                ))}
              </Stack>
            </ScrollArea>
          </Tabs.Panel>

          <Tabs.Panel value="preview" pt="xs" h="100%">
            <Stack h="100%">
              <Code
                block
                style={{ flex: 1, whiteSpace: "pre-wrap", overflow: "auto" }}
              >
                {generateCode()}
              </Code>
              <Button
                onClick={() => onInsert(generateCode())}
                fullWidth
                size="xs"
              >
                Insert Code
              </Button>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Box>
    </Stack>
  );
};
