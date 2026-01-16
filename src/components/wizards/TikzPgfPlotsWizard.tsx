import { useState, useEffect, useRef } from "react";
import {
  Stack,
  Text,
  Group,
  Tabs,
  TextInput,
  NumberInput,
  ColorInput,
  Slider,
  Button,
  ScrollArea,
  Select,
  Box,
  Divider,
  ActionIcon,
  Badge,
  Paper,
  Switch,
  SegmentedControl,
  Textarea,
} from "@mantine/core";
import Editor from "@monaco-editor/react";
import * as math from "mathjs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSquare,
  faChartLine,
  faPlus,
  faTrash,
  faColumns,
  faPencilAlt,
  faArrowRight,
  faGripLines,
  faCompress,
} from "@fortawesome/free-solid-svg-icons";
import { TIKZ_TEMPLATES } from "./tikzTemplates";

// --- Types ---
export type WizardMode = "shapes" | "plots" | "text" | "templates";

// Base types for shapes
export type ShapeType =
  | "circle"
  | "rectangle"
  | "line"
  | "grid"
  | "ellipse"
  | "arc";
export type LineStyle = "solid" | "dashed" | "dotted";
export type ArrowType = "none" | "->" | "<-" | "<->";

export interface ElementStyle {
  color: string;
  fill: string;
  lineWidth: number;
  opacity: number;
  lineStyle: LineStyle;
  arrowHead: ArrowType;
}

export interface ShapeParams {
  type: ShapeType;
  x: number;
  y: number;
  radius: number;
  width: number;
  height: number;
  // New fields
  radiusX?: number;
  radiusY?: number;
  angleStart?: number;
  angleEnd?: number;
}

export interface SceneElement {
  id: string;
  type: "shape" | "text" | "axis" | "plot";
  parentId?: string;
  name: string;
  params: any; // We could be stricter here: ShapeParams | AxisParams | PlotParams
  style: ElementStyle;
  _expanded?: boolean;
}

// Axis specific params
export interface AxisParams {
  xlabel: string;
  ylabel: string;
  title: string;
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
  grid: "none" | "major" | "minor" | "both";
  axisLines: "box" | "left" | "middle" | "center";
  // New Ticks & Legend
  xtick?: string;
  ytick?: string;
  showLegend?: boolean;
  legendPos?:
    | "north east"
    | "north west"
    | "south east"
    | "south west"
    | "outer north east";
}

// Plot specific params
export interface PlotParams {
  expression: string; // sin(x)
  sourceType: "expression" | "data";
  dataPoints: string; // raw text input
  color: string;
  mark: "none" | "*" | "x" | "+" | "o";
  plotType: "sharp" | "smooth" | "const plot" | "ybar" | "only marks";
  samples: number;
  domainStart: number;
  domainEnd: number;
  rangeStart?: number; // y min
  rangeEnd?: number; // y max
  legendEntry?: string; // New Legend Entry
}

interface TikzPgfPlotsWizardProps {
  onInsert: (code: string) => void;
}

const DEFAULT_STYLE: ElementStyle = {
  color: "#000000",
  fill: "",
  lineWidth: 0.8,
  opacity: 100,
  lineStyle: "solid",
  arrowHead: "none",
};

export function TikzPgfPlotsWizard({ onInsert }: TikzPgfPlotsWizardProps) {
  // --- Layout State ---
  const [activeTab, setActiveTab] = useState<string>("shapes");
  const [leftColWidth, setLeftColWidth] = useState(30);
  const [topSectionHeight, setTopSectionHeight] = useState(300);
  const [isResizingHoriz, setIsResizingHoriz] = useState(false);
  const [isResizingVert, setIsResizingVert] = useState(false);

  // --- Data State ---
  const [elements, setElements] = useState<SceneElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [codeValue, setCodeValue] = useState("");

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);
  const shouldSkipUpdate = useRef(false);

  // --- Default States for New Objects ---
  // Shapes
  const [shapeType, setShapeType] = useState<ShapeType>("circle");
  const [shapeX, setShapeX] = useState(0);
  const [shapeY, setShapeY] = useState(0);
  const [shapeR, setShapeR] = useState(1);
  const [shapeW, setShapeW] = useState(2);
  const [shapeH, setShapeH] = useState(1);

  // Plots
  const [plotExpr, setPlotExpr] = useState("sin(x)");
  const [plotSource, setPlotSource] = useState<"expression" | "data">(
    "expression"
  );
  const [plotData, setPlotData] = useState("-2 4\n-1 1\n0 0\n1 1\n2 4");

  const [plotType, setPlotType] = useState<PlotParams["plotType"]>("smooth");
  const [axisParams, setAxisParams] = useState<AxisParams>({
    xlabel: "$x$",
    ylabel: "$y$",
    title: "My Plot",
    xmin: -5,
    xmax: 5,
    ymin: -5,
    ymax: 5,
    grid: "major",
    axisLines: "middle",
  });

  // --- Persistence ---
  useEffect(() => {
    // Load state
    const savedEl = localStorage.getItem("datatex_wizard_elements");
    const savedAxis = localStorage.getItem("datatex_wizard_axisParams");
    const savedShape = localStorage.getItem("datatex_wizard_shapeType");

    if (savedEl) {
      try {
        setElements(JSON.parse(savedEl));
      } catch (e) {
        console.error("Failed to load elements", e);
      }
    }
    if (savedAxis) {
      try {
        setAxisParams(JSON.parse(savedAxis));
      } catch (e) {
        console.error("Failed to load axis params", e);
      }
    }
    if (savedShape) {
      setShapeType(savedShape as any);
    }
  }, []);

  useEffect(() => {
    // Save state
    localStorage.setItem("datatex_wizard_elements", JSON.stringify(elements));
    localStorage.setItem(
      "datatex_wizard_axisParams",
      JSON.stringify(axisParams)
    );
    localStorage.setItem("datatex_wizard_shapeType", shapeType);
  }, [elements, axisParams, shapeType]);

  // Preview settings
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);

  // Pan & Zoom State
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Styles (Not used directly in UI yet, but prepared)
  const [curStyle] = useState<ElementStyle>(DEFAULT_STYLE);

  // --- Helper: Add Element ---
  const handleAddElement = (type: SceneElement["type"]) => {
    let newEl: SceneElement | null = null;
    const id = Date.now().toString();

    if (type === "shape") {
      newEl = {
        id,
        type: "shape",
        name: `${shapeType} ${
          elements.filter((e) => e.type === "shape").length + 1
        }`,
        params: {
          type: shapeType,
          x: shapeX,
          y: shapeY,
          radius: shapeR,
          width: shapeW,
          height: shapeH,
          // Initialize for Ellipse / Arc
          radiusX: 2,
          radiusY: 1,
          angleStart: 0,
          angleEnd: 90,
        } as ShapeParams,
        style: { ...curStyle },
      };
    } else if (type === "axis") {
      newEl = {
        id,
        type: "axis",
        name: "Axis Environment",
        params: {
          ...axisParams,
          // Init Ticks & Legend defaults
          showLegend: false,
          legendPos: "north east",
          xtick: "",
          ytick: "",
        } as AxisParams,
        style: { ...DEFAULT_STYLE, color: "#000000" },
      };
    } else if (type === "plot") {
      const axes = elements.filter((e) => e.type === "axis");
      let parentId = axes.length > 0 ? axes[axes.length - 1].id : undefined;

      if (!parentId) {
        const axisEl = {
          id: (Date.now() - 1).toString(),
          type: "axis" as const,
          name: "Axis Environment",
          params: { ...axisParams },
          style: { ...DEFAULT_STYLE },
        };
        setElements((prev) => [...prev, axisEl]);
        parentId = axisEl.id;
      }

      newEl = {
        id,
        type: "plot",
        parentId,
        name: `Plot ${elements.filter((e) => e.type === "plot").length + 1}`,
        params: {
          expression: plotExpr,
          sourceType: plotSource,
          dataPoints: plotData,
          plotType,
          samples: 100,
          domainStart: -10,
          domainEnd: 10,
          rangeStart: undefined,
          rangeEnd: undefined,
        },
        style: { ...curStyle },
      };
    }

    if (newEl) {
      setElements((prev) => [...prev, newEl!]);
      setSelectedId(id);
      shouldSkipUpdate.current = false;
    }
  };

  const handleUpdateElement = (
    id: string,
    updates: Partial<SceneElement> | { params: any } | { style: any }
  ) => {
    setElements((prev) =>
      prev.map((el) => {
        if (el.id !== id) return el;
        if ("params" in updates && updates.params) {
          return { ...el, params: { ...el.params, ...updates.params } };
        }
        if ("style" in updates && updates.style) {
          return { ...el, style: { ...el.style, ...updates.style } };
        }
        // @ts-ignore
        return { ...el, ...updates };
      })
    );
    shouldSkipUpdate.current = false;
  };

  const handleDelete = (id: string) => {
    setElements((prev) => prev.filter((e) => e.id !== id && e.parentId !== id));
    if (selectedId === id) setSelectedId(null);
    shouldSkipUpdate.current = false;
  };

  // --- Code Generation ---
  useEffect(() => {
    if (shouldSkipUpdate.current) {
      shouldSkipUpdate.current = false;
      return;
    }
    // Generate LaTeX
    let code = "\\begin{tikzpicture}\n";

    // 1. Render Axis and their children (Plots)
    const axes = elements.filter((e) => e.type === "axis");
    // const loosePlots = elements.filter(e => e.type === "plot" && !e.parentId); // Unused currently
    const shapes = elements.filter(
      (e) => e.type === "shape" || e.type === "text"
    );

    const getStyleStr = (s: ElementStyle, type: string) => {
      const opts = [];
      if (s.color && s.color !== "#000000") opts.push(`draw=${s.color}`);
      if (s.fill) opts.push(`fill=${s.fill}`);
      if (s.lineWidth !== 0.8) opts.push(`line width=${s.lineWidth}mm`);
      if (s.lineStyle !== "solid") opts.push(s.lineStyle);
      if (s.arrowHead !== "none") opts.unshift(s.arrowHead);
      if (s.opacity !== 100) opts.push(`opacity=${s.opacity / 100}`);

      if (type === "plot") {
        return opts.length ? `[${opts.join(",")}]` : "";
      }
      return opts.length ? `[${opts.join(",")}]` : "";
    };

    axes.forEach((axis) => {
      const p = axis.params as AxisParams;
      const axisOpts = [
        `axis lines=${p.axisLines}`,
        `xlabel={${p.xlabel}}`,
        `ylabel={${p.ylabel}}`,
        `grid=${p.grid}`,
        `xmin=${p.xmin}, xmax=${p.xmax}`,
        `ymin=${p.ymin}, ymax=${p.ymax}`,
      ];
      if (p.title) axisOpts.push(`title={${p.title}}`);
      if (p.xtick) axisOpts.push(`xtick={${p.xtick}}`);
      if (p.ytick) axisOpts.push(`ytick={${p.ytick}}`);
      if (p.showLegend && p.legendPos)
        axisOpts.push(`legend pos=${p.legendPos.replace(/ /g, " ")}`); // ensure correct formatting if needed

      code += `  \\begin{axis}[\n    ${axisOpts.join(",\n    ")}\n  ]\n`;

      const children = elements.filter((c) => c.parentId === axis.id);

      // ... (yRestriction logic - omitting changes here if not needed) ...

      children.forEach((plot) => {
        const pp = plot.params as PlotParams;
        // Build style string manually or enhance getStyleStr
        let plotOpts = [];
        if (plot.style.color) plotOpts.push(plot.style.color);
        if (plot.style.lineWidth && plot.style.lineWidth !== 0.4)
          plotOpts.push(`line width=${plot.style.lineWidth}mm`);
        if (plot.style.lineStyle && plot.style.lineStyle !== "solid")
          plotOpts.push(plot.style.lineStyle);
        if (plot.style.fill) plotOpts.push(`fill=${plot.style.fill}`);
        if (plot.style.opacity < 100)
          plotOpts.push(`opacity=${plot.style.opacity / 100}`);

        // New options
        if (pp.plotType !== "sharp") plotOpts.push(pp.plotType);
        if (pp.samples !== 100) plotOpts.push(`samples=${pp.samples}`);
        if (pp.domainStart !== -10 || pp.domainEnd !== 10)
          plotOpts.push(`domain=${pp.domainStart}:${pp.domainEnd}`);
        if (pp.rangeStart !== undefined || pp.rangeEnd !== undefined) {
          const min = pp.rangeStart ?? -1000;
          const max = pp.rangeEnd ?? 1000;
          plotOpts.push(`restrict y to domain=${min}:${max}`);
        }

        const styleContent =
          plotOpts.length > 0 ? `[${plotOpts.join(", ")}]` : "";

        if (pp.sourceType === "data") {
          const coords = (pp.dataPoints || "")
            .trim()
            .split(/\n/)
            .map((line) => {
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 2) return `(${parts[0]},${parts[1]})`;
              return "";
            })
            .filter(Boolean)
            .join(" ");

          code += `    \\addplot${styleContent} coordinates { ${coords} };\n`;
        } else {
          code += `    \\addplot${styleContent} {${pp.expression}};\n`;
        }

        if (pp.legendEntry) {
          code += `    \\addlegendentry{${pp.legendEntry}}\n`;
        }
      });

      code += `  \\end{axis}\n`;
    });

    // 2. Render Shapes (Global overlay)
    shapes.forEach((shape) => {
      const p = shape.params;
      const s = getStyleStr(shape.style, "shape");
      if (p.type === "circle") {
        code += `  \\draw${s} (${p.x},${p.y}) circle (${p.radius});\n`;
      } else if (p.type === "rectangle") {
        code += `  \\draw${s} (${p.x},${p.y}) rectangle ++(${p.width},${p.height});\n`;
      } else if (p.type === "ellipse") {
        code += `  \\draw${s} (${p.x},${p.y}) ellipse (${p.radiusX} and ${p.radiusY});\n`;
      } else if (p.type === "arc") {
        code += `  \\draw${s} (${p.x},${p.y}) arc (${p.angleStart}:${p.angleEnd}:${p.radius});\n`;
      } else if (p.type === "line") {
        // Line rendering (placeholder for now)
        code += `  \\draw${s} (${p.x},${p.y}) -- ++(${p.width},${p.height});\n`;
      }
    });

    code += "\\end{tikzpicture}";
    setCodeValue(code);
  }, [elements]);

  // --- Resize Logic ---
  const startResizingHoriz = () => setIsResizingHoriz(true);
  const startResizingVert = () => setIsResizingVert(true);

  // --- Pan & Zoom Logic ---
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleBy = 1.1;
    const oldScale = viewTransform.scale;
    const newScale = e.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

    // Clamp scale
    if (newScale < 0.1 || newScale > 10) return;

    // Calculate mouse position relative to SVG
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Adjust position to zoom towards mouse
    const newX = x - (x - viewTransform.x) * (newScale / oldScale);
    const newY = y - (y - viewTransform.y) * (newScale / oldScale);

    setViewTransform({ x: newX, y: newY, scale: newScale });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;

    setViewTransform((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleResetView = () => {
    setViewTransform({ x: 0, y: 0, scale: 1 });
  };

  useEffect(() => {
    const handleUp = () => {
      setIsResizingHoriz(false);
      setIsResizingVert(false);
      setIsPanning(false);
    };
    const handleMove = (e: MouseEvent) => {
      if (isResizingHoriz && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newW = ((e.clientX - rect.left) / rect.width) * 100;
        setLeftColWidth(Math.max(20, Math.min(newW, 80)));
      }
      if (isResizingVert && rightColRef.current) {
        const rect = rightColRef.current.getBoundingClientRect();
        const newH = e.clientY - rect.top;
        setTopSectionHeight(Math.max(100, Math.min(newH, rect.height - 100)));
      }
    };
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("mousemove", handleMove);
    return () => {
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("mousemove", handleMove);
    };
  }, [isResizingHoriz, isResizingVert]);

  // --- Render ---
  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        overflow: "hidden",
      }}
    >
      {/* LEFT SIDEBAR */}
      <Box
        style={{
          width: `${leftColWidth}%`,
          borderRight: "1px solid var(--mantine-color-default-border)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(v) => setActiveTab(v!)}
          variant="pills"
          p="xs"
        >
          <Tabs.List grow>
            <Tabs.Tab
              value="shapes"
              leftSection={<FontAwesomeIcon icon={faSquare} />}
            >
              Shapes
            </Tabs.Tab>
            <Tabs.Tab
              value="plots"
              leftSection={<FontAwesomeIcon icon={faChartLine} />}
            >
              Plots
            </Tabs.Tab>
            <Tabs.Tab
              value="templates"
              leftSection={<FontAwesomeIcon icon={faColumns} />}
            >
              Tmpl
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>

        <ScrollArea style={{ flex: 1 }} p="xs">
          {activeTab === "shapes" && (
            <Stack>
              <Text fw={700} size="sm">
                New Shape
              </Text>
              <Select
                label="Type"
                data={["circle", "rectangle", "line", "ellipse", "arc"]}
                value={shapeType}
                onChange={(v: any) => setShapeType(v)}
              />
              <Group grow>
                <NumberInput
                  label="X"
                  value={shapeX}
                  onChange={(v) => setShapeX(Number(v))}
                />
                <NumberInput
                  label="Y"
                  value={shapeY}
                  onChange={(v) => setShapeY(Number(v))}
                />
              </Group>
              {shapeType === "circle" && (
                <NumberInput
                  label="Radius"
                  value={shapeR}
                  onChange={(v) => setShapeR(Number(v))}
                />
              )}
              {shapeType === "ellipse" && (
                <Group grow>
                  <NumberInput
                    label="Radius X"
                    value={shapeW}
                    onChange={(v) => setShapeW(Number(v))}
                  />
                  <NumberInput
                    label="Radius Y"
                    value={shapeH}
                    onChange={(v) => setShapeH(Number(v))}
                  />
                </Group>
              )}
              {shapeType === "arc" && (
                <>
                  <NumberInput
                    label="Radius"
                    value={shapeR}
                    onChange={(v) => setShapeR(Number(v))}
                  />
                  <Group grow>
                    <NumberInput label="Start Angle" value={0} />
                    <NumberInput label="End Angle" value={90} />
                  </Group>
                </>
              )}
              {shapeType === "rectangle" && (
                <Group grow>
                  <NumberInput
                    label="Width"
                    value={shapeW}
                    onChange={(v) => setShapeW(Number(v))}
                  />
                  <NumberInput
                    label="Height"
                    value={shapeH}
                    onChange={(v) => setShapeH(Number(v))}
                  />
                </Group>
              )}
              <Button
                leftSection={<FontAwesomeIcon icon={faPlus} />}
                onClick={() => handleAddElement("shape")}
              >
                Add Shape
              </Button>
            </Stack>
          )}

          {activeTab === "plots" && (
            <Stack>
              <Text fw={700} size="sm">
                New Plot
              </Text>
              <SegmentedControl
                fullWidth
                size="xs"
                value={plotSource}
                onChange={(v) => setPlotSource(v as any)}
                data={[
                  { label: "Function", value: "expression" },
                  { label: "Data", value: "data" },
                ]}
                mb="xs"
              />

              {plotSource === "expression" ? (
                <TextInput
                  label="Function y="
                  value={plotExpr}
                  onChange={(e) => setPlotExpr(e.currentTarget.value)}
                  description="e.g. sin(x), x^2"
                />
              ) : (
                <Textarea
                  label="Data Points"
                  placeholder="x y"
                  description="Enter coordinates (x y) per line"
                  minRows={4}
                  value={plotData}
                  onChange={(e) => setPlotData(e.currentTarget.value)}
                />
              )}
              <Select
                label="Plot Type"
                value={plotType}
                onChange={(v: any) => setPlotType(v)}
                data={["sharp", "smooth", "ybar", "only marks"]}
              />

              <Text fw={700} size="sm" mt="sm">
                Axis Settings (New)
              </Text>
              <Group grow>
                <TextInput
                  label="X Label"
                  value={axisParams.xlabel}
                  onChange={(e) =>
                    setAxisParams({
                      ...axisParams,
                      xlabel: e.currentTarget.value,
                    })
                  }
                />
                <TextInput
                  label="Y Label"
                  value={axisParams.ylabel}
                  onChange={(e) =>
                    setAxisParams({
                      ...axisParams,
                      ylabel: e.currentTarget.value,
                    })
                  }
                />
              </Group>
              <Select
                label="Grid"
                data={["none", "major", "minor", "both"]}
                value={axisParams.grid}
                onChange={(v: any) => setAxisParams({ ...axisParams, grid: v })}
              />
              <Select
                label="Axis Lines"
                data={["box", "left", "middle", "center"]}
                value={axisParams.axisLines}
                onChange={(v: any) =>
                  setAxisParams({ ...axisParams, axisLines: v })
                }
              />

              <Button
                leftSection={<FontAwesomeIcon icon={faPlus} />}
                onClick={() => handleAddElement("plot")}
              >
                Add Plot (to Axis)
              </Button>
            </Stack>
          )}

          {activeTab === "templates" && (
            <Stack>
              {TIKZ_TEMPLATES.map((tmpl, idx) => (
                <Paper
                  key={idx}
                  withBorder
                  p="xs"
                  style={{ cursor: "pointer", transition: "0.2s" }}
                  onClick={() => {
                    shouldSkipUpdate.current = true;
                    setCodeValue(tmpl.code);
                  }}
                >
                  <Group justify="space-between">
                    <Text size="sm" fw={700}>
                      {tmpl.label}
                    </Text>
                    <FontAwesomeIcon
                      icon={faArrowRight}
                      size="xs"
                      color="gray"
                    />
                  </Group>
                  <Text size="xs" c="dimmed">
                    {tmpl.description}
                  </Text>
                </Paper>
              ))}
              <Text size="xs" c="dimmed" mt="md">
                * Templates replace the entire code editor content
              </Text>
            </Stack>
          )}

          <Divider my="sm" label="Layers / Elements" labelPosition="center" />
          <Stack gap="xs">
            {elements.map((el) => (
              <Paper
                key={el.id}
                withBorder
                p="xs"
                bg={
                  selectedId === el.id
                    ? "var(--mantine-color-blue-light)"
                    : undefined
                }
                onClick={() => setSelectedId(el.id)}
                style={{
                  cursor: "pointer",
                  borderColor:
                    selectedId === el.id
                      ? "var(--mantine-color-blue-6)"
                      : undefined,
                }}
              >
                <Stack gap={4}>
                  <Group justify="space-between">
                    <Group gap="xs">
                      {el.type === "axis" && (
                        <FontAwesomeIcon icon={faGripLines} />
                      )}
                      {el.type === "plot" && (
                        <FontAwesomeIcon
                          icon={faChartLine}
                          style={{ marginLeft: 10 }}
                        />
                      )}
                      {el.type === "shape" && (
                        <FontAwesomeIcon icon={faSquare} />
                      )}
                      <Text size="sm">{el.name}</Text>
                    </Group>
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(el.id);
                      }}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </ActionIcon>
                  </Group>

                  {selectedId === el.id && (
                    <Box pt="xs" onClick={(e) => e.stopPropagation()}>
                      <Divider
                        mb="xs"
                        label="Properties"
                        labelPosition="center"
                      />
                      {el.type === "shape" && (
                        <>
                          <Group grow mb="xs">
                            <NumberInput
                              size="xs"
                              label="X"
                              value={el.params.x}
                              onChange={(v) =>
                                handleUpdateElement(el.id, {
                                  params: { x: Number(v) },
                                })
                              }
                            />
                            <NumberInput
                              size="xs"
                              label="Y"
                              value={el.params.y}
                              onChange={(v) =>
                                handleUpdateElement(el.id, {
                                  params: { y: Number(v) },
                                })
                              }
                            />
                          </Group>
                          {(el.params.type === "circle" ||
                            el.params.type === "arc") && (
                            <NumberInput
                              size="xs"
                              label="Radius"
                              value={el.params.radius}
                              onChange={(v) =>
                                handleUpdateElement(el.id, {
                                  params: { radius: Number(v) },
                                })
                              }
                              mb="xs"
                            />
                          )}
                          {el.params.type === "ellipse" && (
                            <Group grow mb="xs">
                              <NumberInput
                                size="xs"
                                label="Radius X"
                                value={el.params.radiusX}
                                onChange={(v) =>
                                  handleUpdateElement(el.id, {
                                    params: { radiusX: Number(v) },
                                  })
                                }
                              />
                              <NumberInput
                                size="xs"
                                label="Radius Y"
                                value={el.params.radiusY}
                                onChange={(v) =>
                                  handleUpdateElement(el.id, {
                                    params: { radiusY: Number(v) },
                                  })
                                }
                              />
                            </Group>
                          )}
                          {el.params.type === "arc" && (
                            <Group grow mb="xs">
                              <NumberInput
                                size="xs"
                                label="Start Angle"
                                value={el.params.angleStart}
                                onChange={(v) =>
                                  handleUpdateElement(el.id, {
                                    params: { angleStart: Number(v) },
                                  })
                                }
                              />
                              <NumberInput
                                size="xs"
                                label="End Angle"
                                value={el.params.angleEnd}
                                onChange={(v) =>
                                  handleUpdateElement(el.id, {
                                    params: { angleEnd: Number(v) },
                                  })
                                }
                              />
                            </Group>
                          )}
                          <ColorInput
                            size="xs"
                            label="Color"
                            value={el.style.color}
                            onChange={(v) =>
                              handleUpdateElement(el.id, {
                                style: { color: v },
                              })
                            }
                            mb="xs"
                          />
                          <Group grow mb="xs">
                            <Select
                              size="xs"
                              label="Line Style"
                              data={["solid", "dashed", "dotted"]}
                              value={el.style.lineStyle}
                              onChange={(v: any) =>
                                handleUpdateElement(el.id, {
                                  style: { lineStyle: v },
                                })
                              }
                            />
                            <NumberInput
                              size="xs"
                              label="Width (mm)"
                              value={el.style.lineWidth}
                              step={0.1}
                              min={0.1}
                              onChange={(v) =>
                                handleUpdateElement(el.id, {
                                  style: { lineWidth: Number(v) },
                                })
                              }
                            />
                          </Group>
                        </>
                      )}
                      {el.type === "plot" && (
                        <>
                          <SegmentedControl
                            fullWidth
                            size="xs"
                            value={el.params.sourceType || "expression"}
                            onChange={(v) =>
                              handleUpdateElement(el.id, {
                                params: { sourceType: v },
                              })
                            }
                            data={[
                              { label: "Function", value: "expression" },
                              { label: "Data", value: "data" },
                            ]}
                            mb="xs"
                          />

                          {el.params.sourceType === "data" ? (
                            <Textarea
                              size="xs"
                              label="Data Points"
                              minRows={3}
                              value={el.params.dataPoints}
                              onChange={(e) =>
                                handleUpdateElement(el.id, {
                                  params: { dataPoints: e.currentTarget.value },
                                })
                              }
                              mb="xs"
                            />
                          ) : (
                            <TextInput
                              size="xs"
                              label="Expression"
                              value={el.params.expression}
                              onChange={(e) =>
                                handleUpdateElement(el.id, {
                                  params: { expression: e.currentTarget.value },
                                })
                              }
                              mb="xs"
                            />
                          )}
                          <ColorInput
                            size="xs"
                            label="Color"
                            value={el.style.color}
                            onChange={(v) =>
                              handleUpdateElement(el.id, {
                                style: { color: v },
                              })
                            }
                            mb="xs"
                          />
                          <TextInput
                            size="xs"
                            label="Legend Entry"
                            placeholder="Data Series 1"
                            value={el.params.legendEntry || ""}
                            onChange={(e) =>
                              handleUpdateElement(el.id, {
                                params: { legendEntry: e.currentTarget.value },
                              })
                            }
                            mb="xs"
                          />
                          <Select
                            size="xs"
                            label="Plot Smoothness"
                            data={[
                              { value: "sharp", label: "Sharp" },
                              { value: "smooth", label: "Smooth" },
                              { value: "const plot", label: "Steps" },
                              { value: "ybar", label: "Bars (ybar)" },
                              { value: "only marks", label: "Scatter" },
                            ]}
                            value={el.params.plotType}
                            onChange={(v: any) =>
                              handleUpdateElement(el.id, {
                                params: { plotType: v },
                              })
                            }
                            mb="xs"
                          />
                          <Group grow mb="xs">
                            <NumberInput
                              size="xs"
                              label="Domain X Min"
                              value={el.params.domainStart}
                              onChange={(v) =>
                                handleUpdateElement(el.id, {
                                  params: { domainStart: Number(v) },
                                })
                              }
                            />
                            <NumberInput
                              size="xs"
                              label="X Max"
                              value={el.params.domainEnd}
                              onChange={(v) =>
                                handleUpdateElement(el.id, {
                                  params: { domainEnd: Number(v) },
                                })
                              }
                            />
                          </Group>
                          <Group grow mb="xs">
                            <NumberInput
                              size="xs"
                              label="Range Y Min"
                              placeholder="Auto"
                              value={el.params.rangeStart}
                              onChange={(v) =>
                                handleUpdateElement(el.id, {
                                  params: {
                                    rangeStart:
                                      v === "" ? undefined : Number(v),
                                  },
                                })
                              }
                            />
                            <NumberInput
                              size="xs"
                              label="Y Max"
                              placeholder="Auto"
                              value={el.params.rangeEnd}
                              onChange={(v) =>
                                handleUpdateElement(el.id, {
                                  params: {
                                    rangeEnd: v === "" ? undefined : Number(v),
                                  },
                                })
                              }
                            />
                          </Group>
                          <NumberInput
                            size="xs"
                            label="Samples"
                            value={el.params.samples}
                            min={2}
                            max={500}
                            step={10}
                            onChange={(v) =>
                              handleUpdateElement(el.id, {
                                params: { samples: Number(v) },
                              })
                            }
                            mb="xs"
                          />
                          <Group grow mb="xs">
                            <Select
                              size="xs"
                              label="Line Style"
                              data={["solid", "dashed", "dotted"]}
                              value={el.style.lineStyle}
                              onChange={(v: any) =>
                                handleUpdateElement(el.id, {
                                  style: { lineStyle: v },
                                })
                              }
                            />
                            <NumberInput
                              size="xs"
                              label="Width (mm)"
                              value={el.style.lineWidth}
                              step={0.1}
                              min={0.1}
                              onChange={(v) =>
                                handleUpdateElement(el.id, {
                                  style: { lineWidth: Number(v) },
                                })
                              }
                            />
                          </Group>
                        </>
                      )}
                      {el.type === "axis" && (
                        <>
                          <TextInput
                            size="xs"
                            label="Title"
                            value={el.params.title}
                            onChange={(e) =>
                              handleUpdateElement(el.id, {
                                params: { title: e.currentTarget.value },
                              })
                            }
                            mb="xs"
                          />
                          <Group grow mb="xs">
                            <TextInput
                              size="xs"
                              label="X Label"
                              value={el.params.xlabel}
                              onChange={(e) =>
                                handleUpdateElement(el.id, {
                                  params: { xlabel: e.currentTarget.value },
                                })
                              }
                            />
                            <TextInput
                              size="xs"
                              label="Y Label"
                              value={el.params.ylabel}
                              onChange={(e) =>
                                handleUpdateElement(el.id, {
                                  params: { ylabel: e.currentTarget.value },
                                })
                              }
                            />
                          </Group>
                          <Group grow mb="xs">
                            <TextInput
                              size="xs"
                              label="X Ticks"
                              placeholder="0,1,2"
                              value={el.params.xtick || ""}
                              onChange={(e) =>
                                handleUpdateElement(el.id, {
                                  params: { xtick: e.currentTarget.value },
                                })
                              }
                            />
                            <TextInput
                              size="xs"
                              label="Y Ticks"
                              placeholder="0,2,4"
                              value={el.params.ytick || ""}
                              onChange={(e) =>
                                handleUpdateElement(el.id, {
                                  params: { ytick: e.currentTarget.value },
                                })
                              }
                            />
                          </Group>
                          <Switch
                            size="xs"
                            label="Show Legend"
                            checked={el.params.showLegend}
                            onChange={(e) =>
                              handleUpdateElement(el.id, {
                                params: { showLegend: e.currentTarget.checked },
                              })
                            }
                            mb="xs"
                          />
                          {el.params.showLegend && (
                            <Select
                              size="xs"
                              label="Legend Position"
                              data={[
                                "north east",
                                "north west",
                                "south east",
                                "south west",
                                "outer north east",
                              ]}
                              value={el.params.legendPos}
                              onChange={(v: any) =>
                                handleUpdateElement(el.id, {
                                  params: { legendPos: v },
                                })
                              }
                              mb="xs"
                            />
                          )}
                        </>
                      )}
                      <Stack gap={0}>
                        <Text size="xs">Opacity</Text>
                        <Slider
                          size="xs"
                          value={el.style.opacity}
                          onChange={(v) =>
                            handleUpdateElement(el.id, {
                              style: { opacity: v },
                            })
                          }
                        />
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </Paper>
            ))}
          </Stack>
        </ScrollArea>
      </Box>

      {/* RESIZER */}
      <Box
        onMouseDown={startResizingHoriz}
        style={{
          width: 2,
          cursor: "col-resize",
          background: "var(--mantine-color-default-border)",
        }}
      />

      {/* RIGHT PREVIEW & CODE */}
      <Box
        ref={rightColRef}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        {/* PREVIEW */}
        <Box
          style={{
            height: topSectionHeight,
            borderBottom: "1px solid gray",
            padding: 10,
            overflow: "auto",
            position: "relative",
          }}
        >
          <Box pos="absolute" top={5} right={5}>
            <Badge size="xs" variant="outline" color="gray">
              Preview
            </Badge>
          </Box>
          <Group pos="absolute" top={5} left={10} gap="xs">
            <Switch
              size="xs"
              label="Grid"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.currentTarget.checked)}
            />
            <Switch
              size="xs"
              label="Axes"
              checked={showAxes}
              onChange={(e) => setShowAxes(e.currentTarget.checked)}
            />
            <ActionIcon
              size="xs"
              variant="default"
              onClick={handleResetView}
              title="Reset View"
            >
              <FontAwesomeIcon icon={faCompress} />
            </ActionIcon>
          </Group>
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 400 300"
            style={{
              overflow: "hidden",
              cursor: isPanning ? "grabbing" : "grab",
            }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <g
              transform={`translate(${viewTransform.x} ${viewTransform.y}) scale(${viewTransform.scale})`}
            >
              <defs>
                <pattern
                  id="smallGrid"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 20 0 L 0 0 0 20"
                    fill="none"
                    stroke="#f0f0f0"
                    strokeWidth="1"
                  />
                </pattern>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#ccc" />
                </marker>
              </defs>

              {/* Grid */}
              {showGrid && (
                <rect width="100%" height="100%" fill="url(#smallGrid)" />
              )}

              {/* Axes with Arrows */}
              {showAxes && (
                <>
                  <line
                    x1="0"
                    y1="160"
                    x2="395"
                    y2="160"
                    stroke="#ccc"
                    strokeWidth="2"
                    markerEnd="url(#arrowhead)"
                  />
                  <line
                    x1="200"
                    y1="300"
                    x2="200"
                    y2="5"
                    stroke="#ccc"
                    strokeWidth="2"
                    markerEnd="url(#arrowhead)"
                  />

                  {/* Axis Labels */}
                  <text
                    x="390"
                    y="180"
                    fill="#999"
                    fontSize="12"
                    fontStyle="italic"
                  >
                    x
                  </text>
                  <text
                    x="210"
                    y="15"
                    fill="#999"
                    fontSize="12"
                    fontStyle="italic"
                  >
                    y
                  </text>
                </>
              )}

              {elements.map((el) => {
                // Helper for Stroke Dash array
                const getStrokeDash = (style: string) => {
                  if (style === "dashed") return "5,5";
                  if (style === "dotted") return "2,2";
                  return "none";
                };

                // Render Shapes
                if (el.type === "shape") {
                  const p = el.params;
                  const cx = 200 + p.x * 20;
                  const cy = 160 - p.y * 20;
                  if (el.params.type === "circle") {
                    return (
                      <circle
                        key={el.id}
                        cx={cx}
                        cy={cy}
                        r={p.radius * 20}
                        stroke={el.style.color}
                        fill={el.style.fill || "none"}
                        strokeWidth={el.style.lineWidth}
                        strokeDasharray={getStrokeDash(el.style.lineStyle)}
                        opacity={el.style.opacity / 100}
                      />
                    );
                  }
                  if (el.params.type === "rectangle") {
                    return (
                      <rect
                        key={el.id}
                        x={cx}
                        y={cy - p.height * 20}
                        width={p.width * 20}
                        height={p.height * 20}
                        stroke={el.style.color}
                        fill={el.style.fill || "none"}
                        strokeWidth={el.style.lineWidth}
                        strokeDasharray={getStrokeDash(el.style.lineStyle)}
                        opacity={el.style.opacity / 100}
                      />
                    );
                  }
                  if (el.params.type === "ellipse") {
                    return (
                      <ellipse
                        key={el.id}
                        cx={cx}
                        cy={cy}
                        rx={(el.params.radiusX || 1) * 20}
                        ry={(el.params.radiusY || 1) * 20}
                        stroke={el.style.color}
                        fill={el.style.fill || "none"}
                        strokeWidth={el.style.lineWidth}
                        strokeDasharray={getStrokeDash(el.style.lineStyle)}
                        opacity={el.style.opacity / 100}
                      />
                    );
                  }
                  if (el.params.type === "arc") {
                    const r = (el.params.radius || 1) * 20;
                    const startRad =
                      ((el.params.angleStart || 0) * Math.PI) / 180;
                    const endRad = ((el.params.angleEnd || 90) * Math.PI) / 180;
                    // SVG Y is down
                    const x1 = cx + r * Math.cos(startRad);
                    const y1 = cy - r * Math.sin(startRad);
                    const x2 = cx + r * Math.cos(endRad);
                    const y2 = cy - r * Math.sin(endRad);

                    const largeArc =
                      Math.abs(
                        (el.params.angleEnd || 90) - (el.params.angleStart || 0)
                      ) > 180
                        ? 1
                        : 0;
                    // SVG A command: rx ry x-axis-rotation large-arc-flag sweep-flag x y
                    // Sweep=0 for CCW in typical coordinate system where Y is down?
                    // 0 -> start, 90 -> end.
                    // Code gen uses angleStart:angleEnd.
                    // Let's assume sweep 0.
                    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2}`;

                    return (
                      <path
                        key={el.id}
                        d={d}
                        stroke={el.style.color}
                        fill="none"
                        strokeWidth={el.style.lineWidth}
                        strokeDasharray={getStrokeDash(el.style.lineStyle)}
                        opacity={el.style.opacity / 100}
                      />
                    );
                  }
                }
                // Render Plots
                if (el.type === "plot") {
                  const p = el.params as PlotParams;
                  let points: string[] = [];

                  if (p.sourceType === "data") {
                    // Parse Data
                    const lines = (p.dataPoints || "").split("\n");
                    lines.forEach((line) => {
                      const parts = line.trim().split(/\s+/);
                      if (parts.length >= 2) {
                        const x = parseFloat(parts[0]);
                        const y = parseFloat(parts[1]);
                        if (!isNaN(x) && !isNaN(y)) {
                          const sx = 200 + x * 20;
                          const sy = 160 - y * 20;
                          points.push(`${sx},${sy}`);
                        }
                      }
                    });
                  } else {
                    // Function
                    const dStart = p.domainStart ?? -10;
                    const dEnd = p.domainEnd ?? 10;
                    const samples = p.samples ?? 50;
                    const step = (dEnd - dStart) / Math.max(samples, 2);

                    for (let x = dStart; x <= dEnd; x += step) {
                      try {
                        let expr = p.expression
                          .replace(/\\sin/g, "sin")
                          .replace(/\\cos/g, "cos")
                          .replace(/\\tan/g, "tan")
                          .replace(/\\exp/g, "exp")
                          .replace(/\\ln/g, "log")
                          .replace(/\\sqrt/g, "sqrt")
                          .replace(/\\pi/g, "pi")
                          .replace(/e\^/g, "exp"); // basic cleanup for LaTeX envs

                        // Use mathjs to evaluate
                        // It handles ^ for power, sin/cos etc.
                        const y = math.evaluate(expr, { x });

                        if (!isNaN(y) && isFinite(y)) {
                          if (Math.abs(y) < 20) {
                            const sx = 200 + x * 20;
                            const sy = 160 - y * 20;
                            points.push(`${sx},${sy}`);
                          }
                        }
                      } catch (e) {}
                    }
                  }

                  return (
                    <polyline
                      key={el.id}
                      points={points.join(" ")}
                      fill="none"
                      stroke={el.style.color}
                      strokeWidth={el.style.lineWidth}
                      strokeDasharray={getStrokeDash(el.style.lineStyle)}
                      opacity={el.style.opacity / 100}
                    />
                  );
                }
                return null;
              })}
            </g>
          </svg>
        </Box>

        {/* VERTICAL RESIZER */}
        <Box
          onMouseDown={startResizingVert}
          style={{
            height: 2,
            cursor: "row-resize",
            background: "var(--mantine-color-default-border)",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <FontAwesomeIcon icon={faGripLines} style={{ opacity: 0.3 }} />
        </Box>

        {/* CODE EDITOR */}
        <Box
          style={{
            flex: 1,
            // background: "#1e1e1e", // Monaco handles its own background
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Editor
            height="100%"
            defaultLanguage="latex"
            value={codeValue}
            theme="vs-dark"
            options={{
              minimap: { enabled: true },
              lineNumbers: "on",
              scrollBeyondLastLine: false,
              contextmenu: false,
              readOnly: true,
              wordWrap: "on",
              fontFamily: "monospace",
              fontSize: 12,
            }}
          />
          <Button
            pos="absolute"
            bottom={20}
            right={20}
            onClick={() => onInsert(codeValue)}
            leftSection={<FontAwesomeIcon icon={faPencilAlt} />}
            style={{ zIndex: 10 }}
          >
            Insert Code
          </Button>
        </Box>
      </Box>
    </div>
  );
}
