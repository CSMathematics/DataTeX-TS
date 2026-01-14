import React, { useState } from "react";
import {
  Stack,
  TextInput,
  NumberInput,
  Select,
  Switch,
  Button,
  Group,
  Divider,
  Text,
  Paper,
  ActionIcon,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFolderOpen } from "@fortawesome/free-solid-svg-icons";

interface GraphicxWizardProps {
  onInsert: (code: string) => void;
}

export const GraphicxWizard: React.FC<GraphicxWizardProps> = ({ onInsert }) => {
  // --- State ---
  const [filePath, setFilePath] = useState("");

  // Size options
  const [width, setWidth] = useState("");
  const [widthUnit, setWidthUnit] = useState("\\textwidth"); // \textwidth, cm, mm, etc.
  const [height, setHeight] = useState("");
  const [heightUnit, setHeightUnit] = useState("cm");
  const [keepAspectRatio, setKeepAspectRatio] = useState(true);
  const [scale, setScale] = useState<number | "">("");
  const [angle, setAngle] = useState<number | "">("");

  // Figure environment options
  const [useFigure, setUseFigure] = useState(false);
  const [caption, setCaption] = useState("");
  const [label, setLabel] = useState("");
  const [placement, setPlacement] = useState("ht"); // h, t, b, p
  const [center, setCenter] = useState(true);

  // --- Handlers ---
  const handleBrowse = async () => {
    try {
      // @ts-ignore
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Images",
            extensions: ["png", "jpg", "jpeg", "pdf", "eps"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        setFilePath(selected.replace(/\\/g, "/"));
      }
    } catch (e) {
      console.error("Failed to open dialog:", e);
    }
  };

  const generateCode = () => {
    // Build options string: [width=..., angle=...]
    const options: string[] = [];

    if (width) {
      // Check if unit is a command like \textwidth
      const val = widthUnit.startsWith("\\")
        ? `${width}${widthUnit}`
        : `${width}${widthUnit}`;
      options.push(`width=${val}`);
    }

    if (height) {
      const val = heightUnit.startsWith("\\")
        ? `${height}${heightUnit}`
        : `${height}${heightUnit}`;
      options.push(`height=${val}`);
    }

    if (keepAspectRatio && (width || height)) {
      options.push("keepaspectratio");
    }

    if (scale) {
      options.push(`scale=${scale}`);
    }

    if (angle) {
      options.push(`angle=${angle}`);
    }

    const optionsStr = options.length > 0 ? `[${options.join(", ")}]` : "";
    // Clean path: if spaces, wrap in quotes (though graphicx prefers grffile or no spaces usually)
    // Actually modern graphicx handles spaces via "filename".
    let path = filePath || "imagefile";
    // naive check for spaces
    if (path.includes(" ")) {
      path = `"${path}"`;
    }

    const includeGraphicsCmd = `\\includegraphics${optionsStr}{${path}}`;

    if (!useFigure) {
      // Just the command
      return includeGraphicsCmd;
    }

    // Wrap in figure
    let code = `\\begin{figure}[${placement}]\n`;
    if (center) code += `  \\centering\n`;
    code += `  ${includeGraphicsCmd}\n`;
    if (caption) code += `  \\caption{${caption}}\n`;
    if (label) code += `  \\label{${label}}\n`;
    code += `\\end{figure}`;

    return code;
  };

  return (
    <Stack gap="md" p="md" style={{ overflowY: "auto", height: "100%" }}>
      <Paper p="sm" withBorder bg="var(--mantine-color-body)">
        <Text size="sm" fw={700} mb="xs">
          Image Source
        </Text>
        <Group align="flex-end">
          <TextInput
            label="File Path"
            placeholder="path/to/image.png"
            value={filePath}
            onChange={(e) => setFilePath(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <ActionIcon size="lg" variant="default" onClick={handleBrowse} mb={1}>
            <FontAwesomeIcon icon={faFolderOpen} />
          </ActionIcon>
        </Group>
      </Paper>

      <Paper p="sm" withBorder bg="var(--mantine-color-body)">
        <Text size="sm" fw={700} mb="xs">
          Dimensions & Transform
        </Text>
        <Stack gap="xs">
          <Group grow>
            <TextInput
              label="Width"
              placeholder="e.g. 0.8"
              value={width}
              onChange={(e) => setWidth(e.currentTarget.value)}
              rightSectionWidth={80}
              rightSection={
                <Select
                  data={["\\textwidth", "\\linewidth", "cm", "mm", "in", "pt"]}
                  value={widthUnit}
                  onChange={(v) => setWidthUnit(v || "")}
                  variant="unstyled"
                  size="xs"
                  styles={{ input: { textAlign: "right", paddingRight: 4 } }}
                />
              }
            />
            <TextInput
              label="Height"
              placeholder="e.g. 5"
              value={height}
              onChange={(e) => setHeight(e.currentTarget.value)}
              rightSectionWidth={50}
              rightSection={
                <Select
                  data={["cm", "mm", "in", "pt", "\\textheight"]}
                  value={heightUnit}
                  onChange={(v) => setHeightUnit(v || "")}
                  variant="unstyled"
                  size="xs"
                  styles={{ input: { textAlign: "right", paddingRight: 4 } }}
                />
              }
            />
          </Group>

          <Group justify="space-between">
            <Switch
              label="Keep Aspect Ratio"
              checked={keepAspectRatio}
              onChange={(e) => setKeepAspectRatio(e.currentTarget.checked)}
              size="xs"
            />
          </Group>

          <Divider my="xs" label="OR" labelPosition="center" />

          <NumberInput
            label="Scale Factor"
            placeholder="1.0"
            value={scale}
            onChange={(v) => setScale(v === "" ? "" : Number(v))}
            min={0}
            step={0.1}
          />

          <Divider my="xs" />

          <NumberInput
            label="Rotation Angle (degrees)"
            placeholder="e.g. 90"
            value={angle}
            onChange={(v) => setAngle(v === "" ? "" : Number(v))}
          />
        </Stack>
      </Paper>

      <Paper p="sm" withBorder bg="var(--mantine-color-body)">
        <Group justify="space-between" mb="xs">
          <Text size="sm" fw={700}>
            Figure Environment
          </Text>
          <Switch
            checked={useFigure}
            onChange={(e) => setUseFigure(e.currentTarget.checked)}
          />
        </Group>

        {useFigure && (
          <Stack gap="xs">
            <Switch
              label="Centering"
              checked={center}
              onChange={(e) => setCenter(e.currentTarget.checked)}
            />
            <TextInput
              label="Caption"
              placeholder="Figure caption..."
              value={caption}
              onChange={(e) => setCaption(e.currentTarget.value)}
            />
            <TextInput
              label="Label"
              placeholder="fig:my_image"
              value={label}
              onChange={(e) => setLabel(e.currentTarget.value)}
            />
            <Select
              label="Placement"
              data={[
                { value: "h", label: "Here (h)" },
                { value: "t", label: "Top (t)" },
                { value: "b", label: "Bottom (b)" },
                { value: "p", label: "Page (p)" },
                { value: "ht", label: "Here/Top (ht)" },
                { value: "!ht", label: "Force Here/Top (!ht)" },
              ]}
              value={placement}
              onChange={(v) => setPlacement(v || "ht")}
            />
          </Stack>
        )}
      </Paper>

      <Button fullWidth onClick={() => onInsert(generateCode())}>
        Insert Code
      </Button>
    </Stack>
  );
};
