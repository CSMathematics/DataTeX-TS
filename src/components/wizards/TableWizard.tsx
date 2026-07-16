import React, { useState } from "react";
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
  NumberInput,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faAlignLeft,
  faAlignCenter,
  faAlignRight,
  faCheck,
  faCopy,
  faBold,
  faItalic,
  faFillDrip,
  faCompressAlt,
  faExpandAlt,
  faEraser,
  faCog,
  faPlus,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { useResizable } from "../../hooks/useResizable";
import { ResizerHandle } from "../ui/ResizerHandle";

// Using fontawesome for table icons as well, approximating with regular icons or stacking
// IconTableRow -> faPlus
// IconTableColumn -> faPlus
// IconRowRemove -> faTrash
// IconColumnRemove -> faTrash

interface TableWizardProps {
  onInsert: (code: string) => void;
}

// Data structure for a rich cell
interface CellData {
  id: string;
  content: string;
  rowSpan: number;
  colSpan: number;
  hidden: boolean;
  bold?: boolean;
  italic?: boolean;
  bgColor?: string;
  align?: "l" | "c" | "r";
}

interface Selection {
  startR: number;
  startC: number;
  endR: number;
  endC: number;
}

export const TableWizard: React.FC<TableWizardProps> = ({ onInsert }) => {
  // --- State ---
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(4);

  const [grid, setGrid] = useState<CellData[][]>(() => {
    const initialGrid: CellData[][] = [];
    for (let r = 0; r < 4; r++) {
      const row: CellData[] = [];
      for (let c = 0; c < 4; c++) {
        row.push({
          id: `${r}-${c}`,
          content: "",
          rowSpan: 1,
          colSpan: 1,
          hidden: false,
        });
      }
      initialGrid.push(row);
    }
    return initialGrid;
  });

  // Selection Logic
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

  // Resize Logic (percentage based, updated directly in one RAF per frame)
  const {
    size: splitRatio,
    startResizing,
    containerRef,
    targetRef,
  } = useResizable({
    direction: "vertical",
    initialSize: 55,
    minSize: 20,
    maxSize: 80,
    usePercentage: true,
  });

  // Options
  const [useBooktabs, setUseBooktabs] = useState(true);
  const [isCentered, setIsCentered] = useState(true);
  const [verticalLines, setVerticalLines] = useState(false);
  const [placement, setPlacement] = useState("h");
  const [caption, setCaption] = useState("");
  const [label, setLabel] = useState("");
  const [fontSize, setFontSize] = useState("normalsize");
  const [rowStretch, setRowStretch] = useState(1.2);

  // Toolbar State
  const [bgColor, setBgColor] = useState("#f0f0f0");

  // --- Grid Management ---
  const addRow = () => {
    const newGrid = [...grid];
    const newRow: CellData[] = [];
    for (let c = 0; c < cols; c++) {
      newRow.push({
        id: `${rows}-${c}`,
        content: "",
        rowSpan: 1,
        colSpan: 1,
        hidden: false,
      });
    }
    newGrid.push(newRow);
    setGrid(newGrid);
    setRows((r) => r + 1);
  };

  const addCol = () => {
    const newGrid = grid.map((row, r) => [
      ...row,
      {
        id: `${r}-${cols}`,
        content: "",
        rowSpan: 1,
        colSpan: 1,
        hidden: false,
      },
    ]);
    setGrid(newGrid);
    setCols((c) => c + 1);
  };

  // --- Delete Functions ---
  const deleteRow = () => {
    if (rows <= 1) return; // Don't delete the last row
    const r = activeCell.r;

    // Check if row has content
    const hasContent = grid[r].some((cell) => cell.content.trim() !== "");
    if (hasContent) {
      if (
        !confirm(
          "Η γραμμή περιέχει δεδομένα. Είστε σίγουροι ότι θέλετε να τη διαγράψετε;"
        )
      )
        return;
    }

    const newGrid = grid.filter((_, idx) => idx !== r);
    setGrid(newGrid);
    setRows((prev) => prev - 1);

    // Adjust active cell if needed
    if (activeCell.r >= newGrid.length) {
      setActiveCell((prev) => ({
        ...prev,
        r: Math.max(0, newGrid.length - 1),
      }));
    }
  };

  const deleteCol = () => {
    if (cols <= 1) return; // Don't delete the last column
    const c = activeCell.c;

    // Check if column has content
    const hasContent = grid.some((row) => row[c].content.trim() !== "");
    if (hasContent) {
      if (
        !confirm(
          "Η στήλη περιέχει δεδομένα. Είστε σίγουροι ότι θέλετε να τη διαγράψετε;"
        )
      )
        return;
    }

    const newGrid = grid.map((row) => row.filter((_, idx) => idx !== c));
    setGrid(newGrid);
    setCols((prev) => prev - 1);

    // Adjust active cell if needed
    if (activeCell.c >= newGrid[0].length) {
      setActiveCell((prev) => ({
        ...prev,
        c: Math.max(0, newGrid[0].length - 1),
      }));
    }
  };

  // --- Selection Handlers ---
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

  const handleMouseUp = () => {
    setIsSelecting(false);
  };

  const getSelectedRange = () => {
    const minR = Math.min(selection.startR, selection.endR);
    const maxR = Math.max(selection.startR, selection.endR);
    const minC = Math.min(selection.startC, selection.endC);
    const maxC = Math.max(selection.startC, selection.endC);
    return { minR, maxR, minC, maxC };
  };

  // --- Cell Operations ---
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

  const handleContentChange = (val: string) => {
    const newGrid = [...grid];
    if (!newGrid[activeCell.r][activeCell.c].hidden) {
      newGrid[activeCell.r][activeCell.c].content = val;
      setGrid(newGrid);
    }
  };

  const toggleBold = () =>
    updateSelectedCells((c) => ({ ...c, bold: !c.bold }));
  const toggleItalic = () =>
    updateSelectedCells((c) => ({ ...c, italic: !c.italic }));
  const setAlign = (align: "l" | "c" | "r") =>
    updateSelectedCells((c) => ({ ...c, align }));
  const applyBgColor = (color: string) =>
    updateSelectedCells((c) => ({ ...c, bgColor: color }));
  const clearFormat = () =>
    updateSelectedCells((c) => ({
      ...c,
      bold: false,
      italic: false,
      bgColor: undefined,
      align: undefined,
    }));

  const mergeCells = () => {
    const { minR, maxR, minC, maxC } = getSelectedRange();
    if (minR === maxR && minC === maxC) return;

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
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const cell = newGrid[r][c];
        if (cell.rowSpan > 1 || cell.colSpan > 1) {
          for (let i = 0; i < cell.rowSpan; i++) {
            for (let j = 0; j < cell.colSpan; j++) {
              newGrid[r + i][c + j].hidden = false;
              newGrid[r + i][c + j].rowSpan = 1;
              newGrid[r + i][c + j].colSpan = 1;
            }
          }
        }
      }
    }
    setGrid(newGrid);
  };

  // --- Code Generator ---
  const generateCode = () => {
    let code = "";
    const hasColors = grid.some((row) => row.some((c) => c.bgColor));
    const hasMultiRow = grid.some((row) => row.some((c) => c.rowSpan > 1));

    if (hasColors || hasMultiRow) {
      code += `% Requires: ${hasColors ? "\\usepackage[table]{xcolor} " : ""}${
        hasMultiRow ? "\\usepackage{multirow} " : ""
      }\n`;
    }

    code += `\\begin{table}[${placement}]\n`;
    if (isCentered) code += `  \\centering\n`;
    if (fontSize !== "normalsize") code += `  \\${fontSize}\n`;
    if (rowStretch !== 1)
      code += `  \\renewcommand{\\arraystretch}{${rowStretch}}\n`;

    if (caption) code += `  \\caption{${caption}}\n`;
    if (label) code += `  \\label{${label}}\n`;

    const colSpecChar = useBooktabs ? "c" : "|c";
    let colSpec = "";
    const vert = verticalLines ? "|" : "";

    for (let i = 0; i < cols; i++) {
      colSpec += (i === 0 ? vert : "") + colSpecChar + vert;
    }

    code += `  \\begin{tabular}{${colSpec.trim()}}\n`;
    if (useBooktabs) code += `    \\toprule\n`;
    else code += `    \\hline\n`;

    grid.forEach((row, rIdx) => {
      const rowCodeParts: string[] = [];

      row.forEach((cell, cIdx) => {
        if (cell.hidden) return;

        let cellContent = cell.content.trim();
        if (cell.bold) cellContent = `\\textbf{${cellContent}}`;
        if (cell.italic) cellContent = `\\textit{${cellContent}}`;

        if (cell.bgColor) {
          const hex = cell.bgColor.replace("#", "");
          cellContent = `\\cellcolor[HTML]{${hex}} ${cellContent}`;
        }

        if (cell.rowSpan > 1) {
          cellContent = `\\multirow{${cell.rowSpan}}{*}{${cellContent}}`;
        }

        if (cell.colSpan > 1) {
          const align = cell.align || "c";
          // const lBorder = (verticalLines && cIdx === 0) ? '|' : '';
          // const rBorder = verticalLines ? '|' : '';
          const effectiveL =
            (!useBooktabs && cIdx === 0) || (verticalLines && cIdx === 0)
              ? "|"
              : "";
          const effectiveR = !useBooktabs || verticalLines ? "|" : "";

          cellContent = `\\multicolumn{${cell.colSpan}}{${effectiveL}${align}${effectiveR}}{${cellContent}}`;
        } else if (cell.align && cell.align !== "c") {
          const effectiveL =
            (!useBooktabs && cIdx === 0) || (verticalLines && cIdx === 0)
              ? "|"
              : "";
          const effectiveR = !useBooktabs || verticalLines ? "|" : "";
          cellContent = `\\multicolumn{1}{${effectiveL}${cell.align}${effectiveR}}{${cellContent}}`;
        }

        rowCodeParts.push(cellContent);
      });

      code += `    ${rowCodeParts.join(" & ")} \\\\\n`;
      if (useBooktabs) {
        if (rIdx === 0) code += `    \\midrule\n`;
        else if (rIdx === rows - 1) code += `    \\bottomrule\n`;
        else if (!hasMultiRow) code += `    \\midrule\n`;
      } else {
        code += `    \\hline\n`;
      }
    });

    code += `  \\end{tabular}\n`;
    code += `\\end{table}`;
    return code;
  };

  // --- Render ---
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
      {/* TOOLBAR */}
      <Group
        p="xs"
        bg="var(--mantine-color-default)"
        style={{
          borderBottom: "1px solid var(--mantine-color-default-border)",
        }}
        gap={4}
      >
        {/* Row Operations */}
        <Group gap={0}>
          <Tooltip label="Add Row">
            <ActionIcon variant="subtle" size="sm" onClick={addRow}>
              <FontAwesomeIcon
                icon={faPlus}
                style={{ width: 14, height: 14 }}
              />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete Row">
            <ActionIcon
              variant="subtle"
              size="sm"
              color="red"
              onClick={deleteRow}
            >
              <FontAwesomeIcon
                icon={faTrash}
                style={{ width: 14, height: 14 }}
              />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Divider orientation="vertical" />

        {/* Column Operations */}
        <Group gap={0}>
          <Tooltip label="Add Column">
            <ActionIcon variant="subtle" size="sm" onClick={addCol}>
              <FontAwesomeIcon
                icon={faPlus}
                style={{ width: 14, height: 14 }}
                transform={{ rotate: 90 }}
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
                style={{ width: 14, height: 14 }}
                transform={{ rotate: 90 }}
              />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Divider orientation="vertical" />

        <Tooltip label="Merge Cells">
          <ActionIcon variant="subtle" size="sm" onClick={mergeCells}>
            <FontAwesomeIcon
              icon={faCompressAlt}
              style={{ width: 14, height: 14 }}
            />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Split Cells">
          <ActionIcon variant="subtle" size="sm" onClick={splitCells}>
            <FontAwesomeIcon
              icon={faExpandAlt}
              style={{ width: 14, height: 14 }}
            />
          </ActionIcon>
        </Tooltip>
        <Divider orientation="vertical" />

        <Tooltip label="Bold">
          <ActionIcon
            variant={
              grid[activeCell.r][activeCell.c].bold ? "filled" : "subtle"
            }
            size="sm"
            onClick={toggleBold}
          >
            <FontAwesomeIcon icon={faBold} style={{ width: 14, height: 14 }} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Italic">
          <ActionIcon
            variant={
              grid[activeCell.r][activeCell.c].italic ? "filled" : "subtle"
            }
            size="sm"
            onClick={toggleItalic}
          >
            <FontAwesomeIcon
              icon={faItalic}
              style={{ width: 14, height: 14 }}
            />
          </ActionIcon>
        </Tooltip>
        <Divider orientation="vertical" />

        <Tooltip label="Align Left">
          <ActionIcon
            variant={
              grid[activeCell.r][activeCell.c].align === "l"
                ? "filled"
                : "subtle"
            }
            size="sm"
            onClick={() => setAlign("l")}
          >
            <FontAwesomeIcon
              icon={faAlignLeft}
              style={{ width: 14, height: 14 }}
            />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Align Center">
          <ActionIcon
            variant={
              grid[activeCell.r][activeCell.c].align === "c" ||
              !grid[activeCell.r][activeCell.c].align
                ? "filled"
                : "subtle"
            }
            size="sm"
            onClick={() => setAlign("c")}
          >
            <FontAwesomeIcon
              icon={faAlignCenter}
              style={{ width: 14, height: 14 }}
            />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Align Right">
          <ActionIcon
            variant={
              grid[activeCell.r][activeCell.c].align === "r"
                ? "filled"
                : "subtle"
            }
            size="sm"
            onClick={() => setAlign("r")}
          >
            <FontAwesomeIcon
              icon={faAlignRight}
              style={{ width: 14, height: 14 }}
            />
          </ActionIcon>
        </Tooltip>
        <Divider orientation="vertical" />

        <Popover position="bottom" withArrow shadow="md">
          <Popover.Target>
            <ActionIcon variant="subtle" size="sm" bg={bgColor}>
              <FontAwesomeIcon
                icon={faFillDrip}
                style={{
                  width: 14,
                  height: 14,
                  color: bgColor === "#ffffff" ? "black" : "white",
                }}
              />
            </ActionIcon>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap="xs">
              <ColorPicker
                size="xs"
                value={bgColor}
                onChange={setBgColor}
                format="hex"
              />
              <Button size="xs" fullWidth onClick={() => applyBgColor(bgColor)}>
                Apply
              </Button>
            </Stack>
          </Popover.Dropdown>
        </Popover>
        <Tooltip label="Clear Styles">
          <ActionIcon variant="subtle" size="sm" onClick={clearFormat}>
            <FontAwesomeIcon
              icon={faEraser}
              style={{ width: 14, height: 14 }}
            />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* GRID EDITOR AREA (Top Section) */}
      <Box
        ref={targetRef}
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
                    const textAlignCSS =
                      cell.align === "l"
                        ? "left"
                        : cell.align === "r"
                        ? "right"
                        : "center";

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
                          backgroundColor: isSelected
                            ? "rgba(51, 154, 240, 0.2)"
                            : cell.bgColor || "transparent",
                          width: 80 * cell.colSpan,
                          height: 30 * cell.rowSpan,
                          textAlign: textAlignCSS,
                          fontWeight: cell.bold ? "bold" : "normal",
                          fontStyle: cell.italic ? "italic" : "normal",
                          cursor: "cell",
                          position: "relative",
                        }}
                      >
                        <input
                          value={cell.content}
                          onChange={(e) => handleContentChange(e.target.value)}
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
                          onFocus={() => {
                            setActiveCell({ r, c });
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

      {/* RESIZE HANDLE */}
      <ResizerHandle
        onPointerDown={startResizing}
        orientation="horizontal"
      />

      {/* OPTIONS & PREVIEW (Bottom Section - Takes remaining space) */}
      <Box
        style={{ flex: 1, minHeight: 0 }}
        bg="var(--mantine-color-body)"
        p="md"
      >
        <Grid h="100%" gutter="md">
          <Grid.Col
            span={5}
            style={{
              borderRight: "1px solid var(--mantine-color-default-border)",
              height: "100%",
              overflowY: "auto",
            }}
          >
            <Stack gap="xs">
              <Group gap="xs">
                <FontAwesomeIcon
                  icon={faCog}
                  style={{ width: 14, height: 14 }}
                />
                <Text size="xs" fw={700} c="dimmed">
                  OPTIONS
                </Text>
              </Group>

              <Group>
                <Switch
                  label="Booktabs"
                  checked={useBooktabs}
                  onChange={(e) => setUseBooktabs(e.currentTarget.checked)}
                  size="xs"
                />
                <Switch
                  label="Centered"
                  checked={isCentered}
                  onChange={(e) => setIsCentered(e.currentTarget.checked)}
                  size="xs"
                />
                <Switch
                  label="Vert. Lines"
                  checked={verticalLines}
                  onChange={(e) => setVerticalLines(e.currentTarget.checked)}
                  size="xs"
                />
              </Group>

              <Group grow>
                <Select
                  label="Font Size"
                  size="xs"
                  value={fontSize}
                  onChange={(v) => setFontSize(v || "normalsize")}
                  data={[
                    "tiny",
                    "scriptsize",
                    "footnotesize",
                    "small",
                    "normalsize",
                    "large",
                    "Large",
                  ]}
                />
                <Select
                  label="Placement"
                  size="xs"
                  value={placement}
                  onChange={(v) => setPlacement(v || "h")}
                  data={["h", "t", "b", "H"]}
                />
              </Group>

              <NumberInput
                label="Row Stretch"
                size="xs"
                value={rowStretch}
                onChange={(v) => setRowStretch(Number(v))}
                step={0.1}
                min={0.5}
                max={3}
                decimalScale={1}
              />

              <Divider my={4} />
              <Group grow>
                <TextInput
                  label="Caption"
                  value={caption}
                  onChange={(e) => setCaption(e.currentTarget.value)}
                  size="xs"
                />
                <TextInput
                  label="Label"
                  value={label}
                  onChange={(e) => setLabel(e.currentTarget.value)}
                  size="xs"
                />
              </Group>
            </Stack>
          </Grid.Col>

          <Grid.Col
            span={7}
            style={{ display: "flex", flexDirection: "column", height: "100%" }}
          >
            <Group justify="space-between" mb={4}>
              <Text size="xs" fw={700} c="dimmed">
                LATEX CODE
              </Text>
              <ActionIcon
                size="xs"
                variant="subtle"
                onClick={() => navigator.clipboard.writeText(generateCode())}
              >
                <FontAwesomeIcon
                  icon={faCopy}
                  style={{ width: 12, height: 12 }}
                />
              </ActionIcon>
            </Group>

            {/* Scrollable Code Area fills remaining vertical space */}
            <ScrollArea
              type="auto"
              offsetScrollbars
              style={{
                flex: 1,
                borderRadius: 4,
                border: "1px solid var(--mantine-color-default-border)",
              }}
              bg="var(--mantine-color-default-hover)"
            >
              <Code block style={{ fontSize: 12, background: "transparent" }}>
                {generateCode()}
              </Code>
            </ScrollArea>

            <Button
              mt="xs"
              fullWidth
              size="xs"
              leftSection={
                <FontAwesomeIcon
                  icon={faCheck}
                  style={{ width: 14, height: 14 }}
                />
              }
              onClick={() => onInsert(generateCode())}
            >
              Insert Code
            </Button>
          </Grid.Col>
        </Grid>
      </Box>
    </Stack>
  );
};
