import React, { useState } from "react";
import {
  Tabs,
  Stack,
  TextInput,
  Select,
  Switch,
  Button,
  Group,
  Text,
  NumberInput,
  Tooltip,
  Paper,
  Box,
  Divider,
  SegmentedControl,
  ActionIcon,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCube,
  faTable,
  faCode,
  faInfoCircle,
  faEye,
  faTag,
} from "@fortawesome/free-solid-svg-icons";

interface MathWizardProps {
  onInsert: (code: string) => void;
  defaultTab?: string;
}

// --- VISUALIZATION HELPERS ---

const MatrixAlignmentPreview = ({ align }: { align: string }) => {
  return (
    <Group
      justify="center"
      gap={4}
      p="xs"
      bg="var(--mantine-color-gray-1)"
      style={{ borderRadius: 4 }}
    >
      <Box
        w={40}
        h={30}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 2,
          border: "1px solid #ccc",
          padding: 2,
        }}
      >
        {[1, 2, 3].map((i) => (
          <Box
            key={i}
            w="60%"
            h={4}
            bg="var(--mantine-color-blue-5)"
            style={{
              justifySelf:
                align === "l" ? "start" : align === "r" ? "end" : "center",
            }}
          />
        ))}
      </Box>
      <Text size="xs" c="dimmed">
        {align === "l" ? "Left" : align === "r" ? "Right" : "Center"}
      </Text>
    </Group>
  );
};

const ArrowPreview = ({
  type,
  sup,
  sub,
}: {
  type: string;
  sup: string;
  sub: string;
}) => {
  const isLeft =
    type.toLowerCase().includes("left") || type.toLowerCase().includes("equal");
  const isRight =
    type.toLowerCase().includes("right") ||
    type.toLowerCase().includes("equal") ||
    type.includes("mapsto");

  return (
    <Stack
      align="center"
      gap={0}
      p="xs"
      bg="var(--mantine-color-gray-8)"
      style={{ border: "1px solid #eee", borderRadius: 4 }}
    >
      {sup && (
        <Text size="xs" c="blue">
          {sup}
        </Text>
      )}
      <Group gap={2}>
        {isLeft && (
          <Text size="md" fw={700}>
            ←
          </Text>
        )}
        <Box w={60} h={2} bg="black" />
        {isRight && (
          <Text size="md" fw={700}>
            →
          </Text>
        )}
      </Group>
      {sub && (
        <Text size="xs" c="red">
          {sub}
        </Text>
      )}
    </Stack>
  );
};

const BracketPreview = ({
  type,
  thickness,
  height,
}: {
  type: string;
  thickness: string;
  height: string;
}) => {
  const isUnder = type.includes("under");
  return (
    <Stack
      align="center"
      gap={4}
      p="xs"
      bg="var(--mantine-color-gray-8)"
      style={{ border: "1px solid #eee", borderRadius: 4 }}
    >
      {!isUnder && (
        <Box
          style={{
            position: "relative",
            width: 60,
            height: 10,
            borderTop: "2px solid black",
            borderLeft: "2px solid black",
            borderRight: "2px solid black",
          }}
        >
          {height && (
            <Text
              size="xs"
              style={{ position: "absolute", right: -25, top: -5 }}
              c="dimmed"
            >
              ↕ {height}
            </Text>
          )}
          {thickness && (
            <Text
              size="xs"
              style={{ position: "absolute", top: -15, left: 10 }}
              c="dimmed"
            >
              {thickness}
            </Text>
          )}
        </Box>
      )}
      <Text size="sm" fw={700} py={2}>
        Content
      </Text>
      {isUnder && (
        <Box
          style={{
            position: "relative",
            width: 60,
            height: 10,
            borderBottom: "2px solid black",
            borderLeft: "2px solid black",
            borderRight: "2px solid black",
          }}
        >
          {height && (
            <Text
              size="xs"
              style={{ position: "absolute", right: -25, bottom: -5 }}
              c="dimmed"
            >
              ↕ {height}
            </Text>
          )}
          {thickness && (
            <Text
              size="xs"
              style={{ position: "absolute", bottom: -15, left: 10 }}
              c="dimmed"
            >
              {thickness}
            </Text>
          )}
        </Box>
      )}
    </Stack>
  );
};

export const MathWizard: React.FC<MathWizardProps> = ({
  onInsert,
  defaultTab = "environments",
}) => {
  const [activeTab, setActiveTab] = useState<string | null>(defaultTab);

  // --- Environments State ---
  const [envType, setEnvType] = useState("align");
  const [envStarred, setEnvStarred] = useState(false);
  const [envLabel, setEnvLabel] = useState("");
  const [envContent] = useState("");

  // --- Matrices State ---
  const [matrixType, setMatrixType] = useState("pmatrix");
  const [matrixRows, setMatrixRows] = useState(2);
  const [matrixCols, setMatrixCols] = useState(2);
  const [matrixStarred, setMatrixStarred] = useState(false);
  const [matrixAlign, setMatrixAlign] = useState("c"); // l, c, r for starred
  const [matrixData, setMatrixData] = useState<string[][]>([
    ["", ""],
    ["", ""],
  ]);

  // --- Mathtools State ---
  const [toolCategory, setToolCategory] = useState("arrows"); // arrows, brackets, misc

  // Arrows
  const [arrowType, setArrowType] = useState("xrightarrow");
  const [arrowSup, setArrowSup] = useState("");
  const [arrowSub, setArrowSub] = useState("");

  // Brackets
  const [bracketType, setBracketType] = useState("underbracket");
  const [bracketThick, setBracketThick] = useState("");
  const [bracketHeight, setBracketHeight] = useState("");
  const [bracketContent, setBracketContent] = useState("");

  // Split Fractions
  const [splitFracType, setSplitFracType] = useState("splitfrac"); // splitfrac, splitdfrac
  const [splitFracTop, setSplitFracTop] = useState("");
  const [splitFracBottom, setSplitFracBottom] = useState("");

  // Misc
  const [prescriptSup, setPrescriptSup] = useState("");
  const [prescriptSub, setPrescriptSub] = useState("");
  const [prescriptArg, setPrescriptArg] = useState("");
  const [dlmCmd, setDlmCmd] = useState("");
  const [dlmLeft, setDlmLeft] = useState("");
  const [dlmRight, setDlmRight] = useState("");

  // --- Tags State (Chapter 4) ---
  const [tagAction, setTagAction] = useState("newtagform"); // newtagform, usetagform, refeq
  const [tagName, setTagName] = useState("");
  const [tagLeft, setTagLeft] = useState("(");
  const [tagRight, setTagRight] = useState(")");
  const [tagFormat, setTagFormat] = useState("");
  const [tagRefLabel, setTagRefLabel] = useState("");

  // --- GENERATORS ---

  const generateEnvironment = () => {
    // Mathtools cases enhancements
    let type = envType;
    let starred = envStarred;

    // dcases/rcases are starred if user checked starred
    if (["dcases", "rcases"].includes(type)) {
      // logic holds
    }

    const name = starred ? `${type}*` : type;
    let code = `\\begin{${name}}\n`;
    if (envLabel && !starred) {
      code += `  \\label{${envLabel}}\n`;
    }
    // Default content placeholder
    code += envContent ? `  ${envContent}\n` : "  x &= y \\\\\n";
    code += `\\end{${name}}`;
    return code;
  };

  const updateMatrixSize = (r: number, c: number) => {
    const newData = Array(r)
      .fill("")
      .map((_, ri) =>
        Array(c)
          .fill("")
          .map((_, ci) => (matrixData[ri] && matrixData[ri][ci]) || "")
      );
    setMatrixData(newData);
    setMatrixRows(r);
    setMatrixCols(c);
  };

  const generateMatrix = () => {
    let type = matrixType;
    let suffix = "";
    if (matrixStarred) {
      type += "*";
      suffix = `[${matrixAlign}]`;
    }
    let code = `\\begin{${type}}${suffix}\n`;
    matrixData.forEach((row, i) => {
      code += "  " + row.join(" & ");
      if (i < matrixData.length - 1) code += " \\\\";
      code += "\n";
    });
    code += `\\end{${type}}`;
    return code;
  };

  const generateArrow = () => {
    let opts = "";
    if (arrowSub) opts += `[${arrowSub}]`;
    if (arrowSup) opts += `{${arrowSup}}`;
    // xrightarrow[sub]{sup}.
    return `\\${arrowType}${opts}`;
  };

  const generateBracket = () => {
    let opts = "";
    if (bracketThick) opts += `[${bracketThick}]`;
    if (bracketHeight) opts += `[${bracketHeight}]`; // Height is 2nd optional arg
    // Note: if height is set but thick is empty, we need empty first bracket? \underbracket[][height]
    if (bracketHeight && !bracketThick) {
      // Usually default thickness is 1pt or similar
      opts = `[][${bracketHeight}]`;
    }

    return `\\${bracketType}${opts}{${bracketContent || "content"}}`;
  };

  const generateTag = () => {
    if (tagAction === "newtagform") {
      return `\\newtagform{${tagName}}{${tagLeft}}{${tagRight}}\n${
        tagFormat
          ? `\\renewtagform{${tagName}}[${tagFormat}]{${tagLeft}}{${tagRight}}`
          : ""
      }`;
      // Note: renewtagform is actually used to format, newtagform just defines delimiters.
      // Let's stick to standard newtagform. If format provided, standard latex doesn't integrate seamlessly in one cmd?
      // Mathtools: \newtagform{name}[inner_format]{left}{right} is NOT standard.
      // Syntax: \newtagform{name}{inner_left}{inner_right}.
      // To format: \usetagform{name}.
      // Wait, mathtools manual: \newtagform{name}[format]{left}{right}. Yes optional format exists.
      let out = `\\newtagform{${tagName}}`;
      if (tagFormat) out += `[${tagFormat}]`;
      out += `{${tagLeft}}{${tagRight}}`;
      return out;
    }
    if (tagAction === "usetagform") {
      return `\\usetagform{${tagName}}`;
    }
    if (tagAction === "refeq") {
      return `\\refeq{${tagRefLabel}}`;
    }
    if (tagAction === "noeqref") {
      return `\\noeqref{${tagRefLabel}}`;
    }
    return "";
  };

  const generateSplitFrac = () => {
    return `\\${splitFracType}{${splitFracTop}}{${splitFracBottom}}`;
  };

  return (
    <Stack h="100%" gap={0}>
      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        variant="outline"
        style={{ flex: 1, display: "flex", flexDirection: "column" }}
      >
        <Tabs.List>
          <Tabs.Tab
            value="environments"
            leftSection={<FontAwesomeIcon icon={faCube} />}
          >
            Environments
          </Tabs.Tab>
          <Tabs.Tab
            value="matrices"
            leftSection={<FontAwesomeIcon icon={faTable} />}
          >
            Matrices
          </Tabs.Tab>
          <Tabs.Tab
            value="mathtools"
            leftSection={<FontAwesomeIcon icon={faCode} />}
          >
            Tools
          </Tabs.Tab>
          <Tabs.Tab value="tags" leftSection={<FontAwesomeIcon icon={faTag} />}>
            Tags
          </Tabs.Tab>
        </Tabs.List>

        {/* --- ENVIRONMENTS TAB --- */}
        <Tabs.Panel value="environments" p="md">
          <Stack gap="md">
            <Select
              label="Environment"
              data={[
                {
                  group: "Standard",
                  items: [
                    { value: "equation", label: "Equation" },
                    { value: "align", label: "Align" },
                    { value: "gather", label: "Gather" },
                    { value: "gathered", label: "Gathered (Centered block)" },
                    { value: "lgathered", label: "Left Gathered (lgathered)" },
                    { value: "rgathered", label: "Right Gathered (rgathered)" },
                    { value: "multline", label: "Multline" },
                    { value: "flalign", label: "Flalign" },
                  ],
                },
                {
                  group: "Cases",
                  items: [
                    { value: "cases", label: "Cases (Standard)" },
                    { value: "dcases", label: "Display Cases (dcases)" },
                    { value: "rcases", label: "Right Cases (rcases)" },
                  ],
                },
              ]}
              value={envType}
              onChange={(v) => setEnvType(v || "align")}
            />

            <Group>
              <Switch
                label="Starred (*)"
                description="No numbering"
                checked={envStarred}
                onChange={(e) => setEnvStarred(e.currentTarget.checked)}
              />

              {[
                "dcases",
                "rcases",
                "gathered",
                "lgathered",
                "rgathered",
              ].includes(envType) && (
                <Tooltip
                  label={
                    ["gathered", "lgathered", "rgathered"].includes(envType)
                      ? "Used inside other envs to align multiple lines"
                      : "Starred variants allow text in the second column automatically"
                  }
                >
                  <FontAwesomeIcon icon={faInfoCircle} color="gray" />
                </Tooltip>
              )}
            </Group>

            <TextInput
              label="Label"
              placeholder="eq:my_equation"
              disabled={envStarred}
              value={envLabel}
              onChange={(e) => setEnvLabel(e.currentTarget.value)}
            />

            <Paper withBorder p="xs" bg="var(--mantine-color-gray-8)">
              <Text size="xs" fw={700} c="dimmed">
                CODE PREVIEW
              </Text>
              <Text ff="monospace" size="xs" style={{ whiteSpace: "pre-wrap" }}>
                {`\\begin{${
                  envStarred ? envType + "*" : envType
                }}\n  ...\n\\end{${envStarred ? envType + "*" : envType}}`}
              </Text>
            </Paper>

            <Button onClick={() => onInsert(generateEnvironment())}>
              Insert Environment
            </Button>
          </Stack>
        </Tabs.Panel>

        {/* --- MATRICES TAB --- */}
        <Tabs.Panel value="matrices" p="md">
          <Stack gap="md">
            <Group align="flex-end">
              <Select
                label="Type"
                data={[
                  { value: "pmatrix", label: "( ... ) pmatrix" },
                  { value: "bmatrix", label: "[ ... ] bmatrix" },
                  { value: "Bmatrix", label: "{ ... } Bmatrix" },
                  { value: "vmatrix", label: "| ... | vmatrix" },
                  { value: "Vmatrix", label: "|| ... || Vmatrix" },
                  { value: "matrix", label: "None matrix" },
                  { value: "smallmatrix", label: "smallmatrix" },
                ]}
                value={matrixType}
                onChange={(v) => setMatrixType(v || "pmatrix")}
                style={{ flex: 1 }}
              />
              <Switch
                label="Starred (*)"
                checked={matrixStarred}
                onChange={(e) => setMatrixStarred(e.currentTarget.checked)}
                mb={8}
              />
            </Group>

            {matrixStarred && (
              <Paper withBorder p="xs">
                <Text size="sm" mb={4}>
                  Column Alignment ({matrixType}*)
                </Text>
                <SegmentedControl
                  value={matrixAlign}
                  onChange={setMatrixAlign}
                  data={[
                    { label: "Left (l)", value: "l" },
                    { label: "Center (c)", value: "c" },
                    { label: "Right (r)", value: "r" },
                  ]}
                  fullWidth
                />
                <Box mt="xs">
                  <MatrixAlignmentPreview align={matrixAlign} />
                </Box>
              </Paper>
            )}

            <Group>
              <NumberInput
                label="Rows"
                value={matrixRows}
                onChange={(v) => updateMatrixSize(Number(v), matrixCols)}
                min={1}
                max={10}
              />
              <NumberInput
                label="Cols"
                value={matrixCols}
                onChange={(v) => updateMatrixSize(matrixRows, Number(v))}
                min={1}
                max={10}
              />
            </Group>

            <Text size="sm">Matrix Content</Text>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${matrixCols}, 1fr)`,
                gap: 4,
              }}
            >
              {matrixData.map((row, r) =>
                row.map((cell, c) => (
                  <TextInput
                    key={`${r}-${c}`}
                    size="xs"
                    value={cell}
                    onChange={(e) => {
                      const val = e.currentTarget.value;
                      const newData = [...matrixData];
                      newData[r][c] = val;
                      setMatrixData(newData);
                    }}
                  />
                ))
              )}
            </div>

            <Paper withBorder p="xs" bg="var(--mantine-color-gray-8)">
              <Text size="xs" fw={700} c="dimmed">
                CODE PREVIEW
              </Text>
              <Text ff="monospace" size="xs" style={{ whiteSpace: "pre-wrap" }}>
                {generateMatrix()}
              </Text>
            </Paper>

            <Button onClick={() => onInsert(generateMatrix())}>
              Insert Matrix
            </Button>
          </Stack>
        </Tabs.Panel>

        {/* --- MATHTOOLS TAB --- */}
        <Tabs.Panel value="mathtools" p="md">
          <Stack gap="md">
            <SegmentedControl
              value={toolCategory}
              onChange={setToolCategory}
              data={[
                { label: "Arrows", value: "arrows" },
                { label: "Brackets", value: "brackets" },
                { label: "Misc", value: "misc" },
              ]}
            />

            <Divider />

            {toolCategory === "arrows" && (
              <Stack>
                <Group justify="space-between">
                  <Select
                    label="Arrow Type"
                    data={[
                      { value: "xrightarrow", label: "\\xrightarrow" },
                      { value: "xleftarrow", label: "\\xleftarrow" },
                      { value: "xleftrightarrow", label: "\\xleftrightarrow" },
                      { value: "xRightarrow", label: "\\xRightarrow" },
                      { value: "xLeftarrow", label: "\\xLeftarrow" },
                      { value: "xLeftrightarrow", label: "\\xLeftrightarrow" },
                      { value: "xmapsto", label: "\\xmapsto" },
                      { value: "xhookleftarrow", label: "\\xhookleftarrow" },
                      { value: "xhookrightarrow", label: "\\xhookrightarrow" },
                    ]}
                    value={arrowType}
                    onChange={(v) => setArrowType(v || "xrightarrow")}
                    style={{ flex: 1 }}
                  />
                  <Tooltip label="Extensible arrow that adjusts length to content">
                    <ActionIcon variant="transparent" mt={24}>
                      <FontAwesomeIcon icon={faInfoCircle} />
                    </ActionIcon>
                  </Tooltip>
                </Group>

                <TextInput
                  label="Superscript (Over)"
                  placeholder="Top text"
                  value={arrowSup}
                  onChange={(e) => setArrowSup(e.currentTarget.value)}
                />
                <TextInput
                  label="Subscript (Under)"
                  placeholder="Bottom text"
                  value={arrowSub}
                  onChange={(e) => setArrowSub(e.currentTarget.value)}
                />

                <Paper withBorder p="xs" bg="var(--mantine-color-gray-8)">
                  <Group gap="xs" mb={4}>
                    <FontAwesomeIcon icon={faEye} />
                    <Text size="xs" fw={700}>
                      VISUAL PREVIEW
                    </Text>
                  </Group>
                  <ArrowPreview
                    type={arrowType}
                    sup={arrowSup}
                    sub={arrowSub}
                  />
                </Paper>

                <Button onClick={() => onInsert(generateArrow())}>
                  Insert Arrow
                </Button>
              </Stack>
            )}

            {toolCategory === "brackets" && (
              <Stack>
                <Select
                  label="Bracket Type"
                  data={[
                    {
                      value: "underbracket",
                      label: "\\underbracket (Square Bottom)",
                    },
                    {
                      value: "overbracket",
                      label: "\\overbracket (Square Top)",
                    },
                    {
                      value: "underbrace",
                      label: "\\underbrace (Curly Bottom)",
                    },
                    { value: "overbrace", label: "\\overbrace (Curly Top)" },
                  ]}
                  value={bracketType}
                  onChange={(v) => setBracketType(v || "underbracket")}
                />

                <TextInput
                  label="Content"
                  value={bracketContent}
                  onChange={(e) => setBracketContent(e.currentTarget.value)}
                  placeholder="Term to be bracketed"
                />

                <Group grow>
                  <TextInput
                    label="Thickness"
                    placeholder="e.g. 1pt"
                    value={bracketThick}
                    onChange={(e) => setBracketThick(e.currentTarget.value)}
                    rightSection={
                      <Tooltip label="Optional rule thickness">
                        <FontAwesomeIcon
                          icon={faInfoCircle}
                          size="xs"
                          color="gray"
                        />
                      </Tooltip>
                    }
                  />
                  <TextInput
                    label="Height"
                    placeholder="e.g. 5pt"
                    value={bracketHeight}
                    onChange={(e) => setBracketHeight(e.currentTarget.value)}
                    rightSection={
                      <Tooltip label="Optional bracket height">
                        <FontAwesomeIcon
                          icon={faInfoCircle}
                          size="xs"
                          color="gray"
                        />
                      </Tooltip>
                    }
                  />
                </Group>

                <Paper withBorder p="xs" bg="var(--mantine-color-gray-8)">
                  <Group gap="xs" mb={4}>
                    <FontAwesomeIcon icon={faEye} />
                    <Text size="xs" fw={700}>
                      SETTINGS VISUALIZATION
                    </Text>
                  </Group>
                  <BracketPreview
                    type={bracketType}
                    thickness={bracketThick}
                    height={bracketHeight}
                  />
                </Paper>

                <Button onClick={() => onInsert(generateBracket())}>
                  Insert Bracket
                </Button>
              </Stack>
            )}

            {toolCategory === "misc" && (
              <Stack>
                <Tabs defaultValue="prescript" variant="pills" color="gray">
                  <Tabs.List>
                    <Tabs.Tab value="prescript">Indices</Tabs.Tab>
                    <Tabs.Tab value="fractions">Fractions</Tabs.Tab>
                    <Tabs.Tab value="delimiter">Delimiters</Tabs.Tab>
                  </Tabs.List>

                  <Tabs.Panel value="prescript" pt="sm">
                    <Stack>
                      <Text size="sm" fw={700}>
                        Prescript (Left Indices)
                      </Text>
                      <TextInput
                        label="Superscript (Top Left)"
                        placeholder="e.g. 14"
                        value={prescriptSup}
                        onChange={(e) => setPrescriptSup(e.currentTarget.value)}
                      />
                      <TextInput
                        label="Subscript (Bottom Left)"
                        placeholder="e.g. 6"
                        value={prescriptSub}
                        onChange={(e) => setPrescriptSub(e.currentTarget.value)}
                      />
                      <TextInput
                        label="Argument"
                        placeholder="e.g. C"
                        value={prescriptArg}
                        onChange={(e) => setPrescriptArg(e.currentTarget.value)}
                      />
                      <Text size="xs" c="dimmed">
                        Result:{" "}
                        {`\\prescript{${prescriptSup}}{${prescriptSub}}{${prescriptArg}}`}
                      </Text>
                      <Button
                        onClick={() =>
                          onInsert(
                            `\\prescript{${prescriptSup}}{${prescriptSub}}{${prescriptArg}}`
                          )
                        }
                      >
                        Insert
                      </Button>
                    </Stack>
                  </Tabs.Panel>

                  <Tabs.Panel value="fractions" pt="sm">
                    <Stack>
                      <Group justify="space-between">
                        <Text size="sm" fw={700}>
                          Split Fractions
                        </Text>
                        <Tooltip label="For multiline fractions">
                          <FontAwesomeIcon icon={faInfoCircle} color="gray" />
                        </Tooltip>
                      </Group>
                      <Select
                        data={[
                          {
                            value: "splitfrac",
                            label: "splitfrac (Text style)",
                          },
                          {
                            value: "splitdfrac",
                            label: "splitdfrac (Display style)",
                          },
                        ]}
                        value={splitFracType}
                        onChange={(v) => setSplitFracType(v || "splitfrac")}
                      />
                      <TextInput
                        label="Top Part"
                        value={splitFracTop}
                        onChange={(e) => setSplitFracTop(e.currentTarget.value)}
                      />
                      <TextInput
                        label="Bottom Part"
                        value={splitFracBottom}
                        onChange={(e) =>
                          setSplitFracBottom(e.currentTarget.value)
                        }
                      />
                      <Paper withBorder p="xs" bg="var(--mantine-color-gray-8)">
                        <Text size="xs" fw={700} c="dimmed">
                          CODE PREVIEW
                        </Text>
                        <Text ff="monospace" size="xs">
                          {generateSplitFrac()}
                        </Text>
                      </Paper>
                      <Button onClick={() => onInsert(generateSplitFrac())}>
                        Insert Split Fraction
                      </Button>
                    </Stack>
                  </Tabs.Panel>

                  <Tabs.Panel value="delimiter" pt="sm">
                    <Stack>
                      <Text size="sm" fw={700}>
                        Paired Delimiter Declaration
                      </Text>
                      <TextInput
                        label="Command Name"
                        placeholder="norm"
                        leftSection="\"
                        value={dlmCmd}
                        onChange={(e) => setDlmCmd(e.currentTarget.value)}
                      />
                      <Group grow>
                        <TextInput
                          label="Left Delimiter"
                          placeholder="\\lVert"
                          value={dlmLeft}
                          onChange={(e) => setDlmLeft(e.currentTarget.value)}
                        />
                        <TextInput
                          label="Right Delimiter"
                          placeholder="\\rVert"
                          value={dlmRight}
                          onChange={(e) => setDlmRight(e.currentTarget.value)}
                        />
                      </Group>
                      <Button
                        onClick={() =>
                          onInsert(
                            `\\DeclarePairedDelimiter\\${dlmCmd}{${dlmLeft}}{${dlmRight}}`
                          )
                        }
                      >
                        Insert Declaration
                      </Button>
                    </Stack>
                  </Tabs.Panel>
                </Tabs>
              </Stack>
            )}
          </Stack>
        </Tabs.Panel>

        {/* --- TAGS TAB (Chapter 4) --- */}
        <Tabs.Panel value="tags" p="md">
          <Stack gap="md">
            <Select
              label="Action"
              data={[
                { value: "newtagform", label: "Define New Tag Form" },
                { value: "usetagform", label: "Use Tag Form" },
                { value: "refeq", label: "Reference Equation" },
                { value: "noeqref", label: "Suppress Equation Number" },
              ]}
              value={tagAction}
              onChange={(v) => setTagAction(v || "newtagform")}
            />

            {tagAction === "newtagform" && (
              <Stack>
                <TextInput
                  label="Name"
                  placeholder="e.g. bold_tags"
                  value={tagName}
                  onChange={(e) => setTagName(e.currentTarget.value)}
                  required
                />
                <Group grow>
                  <TextInput
                    label="Left Delimiter"
                    placeholder="("
                    value={tagLeft}
                    onChange={(e) => setTagLeft(e.currentTarget.value)}
                  />
                  <TextInput
                    label="Right Delimiter"
                    placeholder=")"
                    value={tagRight}
                    onChange={(e) => setTagRight(e.currentTarget.value)}
                  />
                </Group>
                <TextInput
                  label="Format Style (Optional)"
                  placeholder="e.g. \bfseries"
                  value={tagFormat}
                  onChange={(e) => setTagFormat(e.currentTarget.value)}
                  rightSection={
                    <Tooltip label="Commands to format the tag (e.g. bold, color)">
                      <FontAwesomeIcon icon={faInfoCircle} color="gray" />
                    </Tooltip>
                  }
                />
                <Text size="sm">
                  Creates a new tag style. Use{" "}
                  <code>\usetagform{`{tagName}`}</code> to activate it.
                </Text>
              </Stack>
            )}

            {tagAction === "usetagform" && (
              <TextInput
                label="Tag Form Name"
                placeholder="e.g. default, bold_tags"
                value={tagName}
                onChange={(e) => setTagName(e.currentTarget.value)}
              />
            )}

            {["refeq", "noeqref"].includes(tagAction) && (
              <TextInput
                label="Label"
                placeholder="eq:ref"
                value={tagRefLabel}
                onChange={(e) => setTagRefLabel(e.currentTarget.value)}
              />
            )}

            <Paper withBorder p="xs" bg="var(--mantine-color-gray-8)">
              <Text size="xs" fw={700} c="dimmed">
                CODE PREVIEW
              </Text>
              <Text ff="monospace" size="xs">
                {generateTag()}
              </Text>
            </Paper>

            <Button onClick={() => onInsert(generateTag())}>Insert Code</Button>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
};
