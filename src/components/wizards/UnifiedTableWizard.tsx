import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Button,
  TextInput,
  Switch,
  ActionIcon,
  Group,
  Stack,
  Text,
  ScrollArea,
  Divider,
  Box,
  Select,
  ColorPicker,
  Popover,
  SegmentedControl,
  Tabs,
  Code,
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

export interface UnifiedTableWizardProps {
  onInsert: (code: string) => void;
  initialMode?: "tabularray" | "standard" | "booktabs";
}

// --- Extended Cell Data (Superset) ---
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
  valign?: "h" | "m" | "f"; // Head, Middle, Foot (Tabularray specific mostly)
}

// --- Column Options ---
interface ColOption {
  type: string; // 'l', 'c', 'r', 'Q', 'X', 'p'
  width?: string; // For Q/X/p e.g. '2' or '1cm'
}

// --- Selection State ---
interface Selection {
  startR: number;
  startC: number;
  endR: number;
  endC: number;
}

export const UnifiedTableWizard: React.FC<UnifiedTableWizardProps> = ({
  onInsert,
  initialMode = "tabularray",
}) => {
  // --- Mode State ---
  const [mode, setMode] = useState<"tabularray" | "standard" | "booktabs">(
    initialMode
  );

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
  const [caption, setCaption] = useState("");
  const [label, setLabel] = useState("");

  // Tabularray Options
  const [theme] = useState("");
  const [hlines, setHlines] = useState<boolean>(true);
  const [vlines, setVlines] = useState<boolean>(true);
  const [longTable, setLongTable] = useState(false);

  // Standard/Booktabs Options
  const [centerTable, setCenterTable] = useState(true);

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

  const mergeCells = () => {
    const { minR, maxR, minC, maxC } = getSelectedRange();
    if (minR === maxR && minC === maxC) return; // Single cell

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
        newGrid[r][c].content = "";
      }
    }
    setGrid(newGrid);
  };

  const splitCells = () => {
    const { minR, maxR, minC, maxC } = getSelectedRange();
    const newGrid = [...grid];
    let changed = false;

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cell = newGrid[r][c];
        if (!cell.hidden && (cell.rowSpan > 1 || cell.colSpan > 1)) {
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
    if (mode === "standard") return; // Basic standard doesn't support color easily
    updateSelectedCells((c) => ({
      ...c,
      [activeColorMode === "bg" ? "bgColor" : "fgColor"]: activeColor,
    }));
  };

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

  const generateTabularrayCode = () => {
    const env = longTable ? "longtblr" : "tblr";
    let code = `\\begin{${env}}[\n`;
    if (caption) code += `  caption = {${caption}},\n`;
    if (label) code += `  label = {${label}},\n`;
    if (theme) code += `  theme = ${theme},\n`;
    if (vlines) code += `  vlines,\n`;
    if (hlines) code += `  hlines,\n`;

    const colSpecParts = colOptions.map((opt) => {
      let spec = opt.type;
      if (opt.width && (opt.type === "X" || opt.type === "Q")) {
        spec += `[${opt.width}]`;
      }
      return spec;
    });
    code += `  colspec = {${colSpecParts.join(" ")}},\n`;

    const cellSpecs: string[] = [];
    grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell.hidden) return;
        const props: string[] = [];
        if (cell.rowSpan > 1) props.push(`r=${cell.rowSpan}`);
        if (cell.colSpan > 1) props.push(`c=${cell.colSpan}`);
        if (cell.halign) props.push(`halign=${cell.halign}`);
        if (cell.valign) props.push(`valign=${cell.valign}`);
        if (cell.bgColor) props.push(`bg=${cell.bgColor}`);
        if (cell.fgColor) props.push(`fg=${cell.fgColor}`);
        if (cell.bold) props.push(`font=\\bfseries`);
        if (cell.italic) props.push(`font=\\itshape`);

        if (props.length > 0) {
          cellSpecs.push(`  cell{${r + 1}}{${c + 1}} = {${props.join(", ")}},`);
        }
      });
    });

    if (cellSpecs.length > 0) code += cellSpecs.join("\n") + "\n";
    code += `]{\n`;

    grid.forEach((row) => {
      const lineCells = row.map((cell) => (cell.hidden ? "" : cell.content));
      code += `  ${lineCells.join(" & ")} \\\\\n`;
    });
    code += `\\end{${env}}`;
    return code;
  };

  const generateStandardCode = (isBooktabs: boolean) => {
    let code = "";
    if (centerTable) code += "\\begin{center}\n";

    // Structure: \begin{tabular}{ccc}
    // For booktabs/standard, we don't have X/Q usually. Map them to 'c' or 'p'.
    // If 'X' is used, users usually need tabularx, but let's just fallback to 'c' or 'p' if width exists.
    const colSpec = colOptions
      .map((opt) => {
        let spec = opt.type;
        if (opt.type === "X" || opt.type === "Q") {
          spec = opt.width ? `p{${opt.width}}` : "c"; // Fallback
        }
        return spec;
      })
      .join(vlines && !isBooktabs ? "|" : "");

    code += `\\begin{tabular}{${vlines && !isBooktabs ? "|" : ""}${colSpec}${
      vlines && !isBooktabs ? "|" : ""
    }}\n`;

    if (isBooktabs) code += "\\toprule\n";
    else if (hlines) code += "\\hline\n";

    grid.forEach((row, r) => {
      const lineCells: string[] = [];
      row.forEach((cell) => {
        if (cell.hidden) return; // Skip hidden cells?
        // Standard LaTeX Multicolumn/Multirow
        let cellContent = cell.content;

        // Styling: Bold/Italic
        if (cell.bold) cellContent = `\\textbf{${cellContent}}`;
        if (cell.italic) cellContent = `\\textit{${cellContent}}`;

        // ColSpan -> \multicolumn
        if (cell.colSpan > 1) {
          let align: string = cell.halign || "c";
          if (vlines && !isBooktabs) align = `|${align}|`; // naive border handling
          cellContent = `\\multicolumn{${cell.colSpan}}{${align}}{${cellContent}}`;
        }

        // RowSpan -> \multirow (requires package)
        if (cell.rowSpan > 1) {
          cellContent = `\\multirow{${cell.rowSpan}}{*}{${cellContent}}`;
        }

        lineCells.push(cellContent);

        // If colSpan > 1, push empty cells for the skipped columns to maintain alignment?
        // No, \multicolumn replaces N cells.
        // But for our loop, we need to know we skipped them.
      });

      // WAIT. My grid traversal above is `row.forEach`.
      // If I use `cell.hidden` check, I only visit the visible ones.
      // But standard latex expects `&` for every column unless multicolumn is used.
      // E.g. 3 cols. Cell 1 spans 2. We need: `\multicolumn{2}{c}{...} & Cell 3 \\`
      // My loop visits Cell 1 (visible), Cell 2 (hidden), Cell 3 (visible).
      // So if I skip hidden, I get: `\multicolumn... & Cell 3`. Correct.
      // Logic holds.

      code += `  ${lineCells.join(" & ")} \\\\\n`;

      if (isBooktabs) {
        if (r === 0) code += "  \\midrule\n"; // Header rule
        else if (r === rows - 1) code += "  \\bottomrule\n";
        else if (hlines) code += "  \\midrule\n"; // Generic rule if requested
      } else {
        if (hlines) code += "  \\hline\n";
      }
    });

    code += "\\end{tabular}\n";
    if (caption) code += `\\captionof{table}{${caption}}\n`; // Simple caption assumption
    if (label) code += `\\label{${label}}\n`;
    if (centerTable) code += "\\end{center}";
    return code;
  };

  const generateCode = () => {
    if (mode === "tabularray") return generateTabularrayCode();
    if (mode === "booktabs") return generateStandardCode(true);
    return generateStandardCode(false);
  };

  // --- Resize Handler ---
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
  const activeGridCell = grid[activeCell.r][activeCell.c];

  return (
    <Stack
      gap={0}
      h="100%"
      ref={containerRef}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ overflow: "hidden" }}
    >
      {/* HEADER & TOOLBAR */}
      <Stack
        gap={0}
        bg="var(--mantine-color-default)"
        style={{
          borderBottom: "1px solid var(--mantine-color-default-border)",
        }}
      >
        {/* Mode & Global Actions */}
        <Group p="xs" justify="space-between">
          <Select
            data={[
              { label: "Tabularray (Modern)", value: "tabularray" },
              { label: "Standard LaTeX", value: "standard" },
              { label: "Booktabs (Professional)", value: "booktabs" },
            ]}
            value={mode}
            onChange={(v: any) => setMode(v)}
            allowDeselect={false}
            size="xs"
            w={200}
          />
          <Button size="xs" onClick={() => onInsert(generateCode())}>
            Insert
          </Button>
        </Group>

        <Divider />

        {/* Editing Toolbar */}
        <Group p="4" gap={4}>
          <Group gap={0}>
            <ActionIcon variant="subtle" size="sm" onClick={addRow}>
              <FontAwesomeIcon icon={faPlus} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              size="sm"
              color="red"
              onClick={deleteRow}
            >
              <FontAwesomeIcon icon={faTrash} />
            </ActionIcon>
          </Group>
          <Divider orientation="vertical" />
          <Group gap={0}>
            <ActionIcon variant="subtle" size="sm" onClick={addCol}>
              <FontAwesomeIcon icon={faPlus} transform={{ rotate: 90 }} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              size="sm"
              color="red"
              onClick={deleteCol}
            >
              <FontAwesomeIcon icon={faTrash} transform={{ rotate: 90 }} />
            </ActionIcon>
          </Group>
          <Divider orientation="vertical" />
          <ActionIcon variant="subtle" size="sm" onClick={mergeCells}>
            <FontAwesomeIcon icon={faCompressAlt} />
          </ActionIcon>
          <ActionIcon variant="subtle" size="sm" onClick={splitCells}>
            <FontAwesomeIcon icon={faExpandAlt} />
          </ActionIcon>
          <Divider orientation="vertical" />

          <ActionIcon
            variant={activeGridCell.bold ? "filled" : "subtle"}
            size="sm"
            onClick={() =>
              updateSelectedCells((c) => ({ ...c, bold: !c.bold }))
            }
          >
            <FontAwesomeIcon icon={faBold} />
          </ActionIcon>
          <ActionIcon
            variant={activeGridCell.italic ? "filled" : "subtle"}
            size="sm"
            onClick={() =>
              updateSelectedCells((c) => ({ ...c, italic: !c.italic }))
            }
          >
            <FontAwesomeIcon icon={faItalic} />
          </ActionIcon>

          <Divider orientation="vertical" />

          <ActionIcon
            variant={activeGridCell.halign === "l" ? "filled" : "subtle"}
            size="sm"
            onClick={() => updateSelectedCells((c) => ({ ...c, halign: "l" }))}
          >
            <FontAwesomeIcon icon={faAlignLeft} />
          </ActionIcon>
          <ActionIcon
            variant={activeGridCell.halign === "c" ? "filled" : "subtle"}
            size="sm"
            onClick={() => updateSelectedCells((c) => ({ ...c, halign: "c" }))}
          >
            <FontAwesomeIcon icon={faAlignCenter} />
          </ActionIcon>
          <ActionIcon
            variant={activeGridCell.halign === "r" ? "filled" : "subtle"}
            size="sm"
            onClick={() => updateSelectedCells((c) => ({ ...c, halign: "r" }))}
          >
            <FontAwesomeIcon icon={faAlignRight} />
          </ActionIcon>

          {/* Color - Only for Tabularray for now */}
          {mode === "tabularray" && (
            <>
              <Divider orientation="vertical" />
              <Popover position="bottom" withArrow shadow="md">
                <Popover.Target>
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    bg={activeColorMode === "bg" ? activeColor : undefined}
                    c={activeColorMode === "fg" ? activeColor : undefined}
                  >
                    <FontAwesomeIcon icon={faFillDrip} />
                  </ActionIcon>
                </Popover.Target>
                <Popover.Dropdown>
                  <Stack gap="xs">
                    <SegmentedControl
                      size="xs"
                      value={activeColorMode}
                      onChange={(v: any) => setActiveColorMode(v)}
                      data={[
                        { label: "BG", value: "bg" },
                        { label: "FG", value: "fg" },
                      ]}
                    />
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
            </>
          )}

          <Divider orientation="vertical" />
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
            <FontAwesomeIcon icon={faEraser} />
          </ActionIcon>
        </Group>
      </Stack>

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
              color: "var(--mantine-color-text)",
            }}
          >
            <tbody>
              {grid.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => {
                    if (cell.hidden) return null;
                    const isSelected =
                      r >= minR && r <= maxR && c >= minC && c <= maxC;
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
                            : (mode === "tabularray"
                                ? cell.bgColor
                                : undefined) || "transparent",
                          color:
                            (mode === "tabularray"
                              ? cell.fgColor
                              : undefined) || "inherit",
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
            <Stack gap="xs">
              <TextInput
                label="Caption"
                size="xs"
                value={caption}
                onChange={(e) => setCaption(e.currentTarget.value)}
              />
              <TextInput
                label="Label"
                size="xs"
                value={label}
                onChange={(e) => setLabel(e.currentTarget.value)}
              />

              <Divider label="Layout" labelPosition="center" />
              <Switch
                label="Center Table"
                checked={centerTable}
                onChange={(e) => setCenterTable(e.currentTarget.checked)}
                size="xs"
              />

              {mode === "tabularray" && (
                <>
                  <Divider label="Tabularray Options" labelPosition="center" />
                  <Switch
                    label="Global HLines"
                    checked={hlines}
                    onChange={(e) => setHlines(e.currentTarget.checked)}
                    size="xs"
                  />
                  <Switch
                    label="Global VLines"
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
                </>
              )}
              {mode === "standard" && (
                <>
                  <Divider label="Standard Options" labelPosition="center" />
                  <Switch
                    label="Bordered (VLines/HLines)"
                    checked={hlines}
                    onChange={(e) => {
                      setHlines(e.currentTarget.checked);
                      setVlines(e.currentTarget.checked);
                    }}
                    size="xs"
                  />
                </>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="columns" pt="xs">
            <ScrollArea h={200}>
              <Stack gap="xs">
                {colOptions.map((opt, i) => (
                  <Group key={i} grow>
                    <Text size="xs" w={20}>
                      Col {i + 1}
                    </Text>
                    <Select
                      size="xs"
                      data={[
                        "l",
                        "c",
                        "r",
                        ...(mode === "tabularray" ? ["X", "Q"] : ["p"]),
                      ]}
                      value={opt.type}
                      onChange={(v: any) => {
                        const newOpts = [...colOptions];
                        newOpts[i].type = v || "c";
                        setColOptions(newOpts);
                      }}
                    />
                    <TextInput
                      size="xs"
                      placeholder="Width (e.g. 2, 3cm)"
                      value={opt.width || ""}
                      onChange={(e) => {
                        const newOpts = [...colOptions];
                        newOpts[i].width = e.currentTarget.value;
                        setColOptions(newOpts);
                      }}
                      disabled={!["X", "Q", "p"].includes(opt.type)}
                    />
                  </Group>
                ))}
              </Stack>
            </ScrollArea>
          </Tabs.Panel>

          <Tabs.Panel value="preview" pt="xs">
            <Code block style={{ height: 200, overflow: "auto" }}>
              {generateCode()}
            </Code>
          </Tabs.Panel>
        </Tabs>
      </Box>
    </Stack>
  );
};
