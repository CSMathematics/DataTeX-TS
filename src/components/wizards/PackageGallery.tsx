import React, { useState, useEffect, useMemo } from "react";
import {
  Text,
  Group,
  Button,
  TextInput,
  ScrollArea,
  Stack,
  ThemeIcon,
  Box,
  Code,
  ActionIcon,
  Tooltip,
  Select,
  Switch,
  Textarea,
  SegmentedControl,
  Checkbox,
  Badge,
  Divider,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLayerGroup,
  faBoxOpen,
  faCheck,
  faCopy,
  faInfoCircle,
  faSquareRootAlt,
  faFileCode,
  faCog,
  faPalette,
  faDatabase,
  faSearch,
} from "@fortawesome/free-solid-svg-icons";
import { ViewType } from "../layout/Sidebar";

// IMPORT SHARED DATA
import {
  LANGUAGES_DB,
  MINTED_STYLES,
  CustomColorDef,
  CustomListDef,
} from "./preamble/LanguageDb";
import { PACKAGES_DB, LatexPackage } from "./preamble/packages";
import { getAllPackages, ListPackage } from "../../services/packageService";

import { TikzPgfPlotsWizard } from "./TikzPgfPlotsWizard";
import { TableWizard } from "./TableWizard";
import { PstricksWizard } from "./PstricksWizard";
import { ColorsTab } from "./preamble/tabs/ColorsTab";
import { ListsTab } from "./preamble/tabs/ListsTab";
import { SiunitxWizard } from "./SiunitxWizard";

interface PackageGalleryProps {
  selectedPkgId: string;
  onInsert: (code: string) => void;
  onClose: () => void;
  onOpenWizard: (view: ViewType) => void;
  onOpenPackageBrowser?: () => void;
}

// --- Sub-Configurators ---

// 1. AMSMATH Configurator
const AmsMathConfig = ({ onChange }: { onChange: (code: string) => void }) => {
  const [type, setType] = useState("equation");
  const [content, setContent] = useState("E = mc^2");
  const [label, setLabel] = useState("");

  useEffect(() => {
    let code = "";
    const env = type === "inline" ? "" : type;
    if (type === "inline") {
      code = `$ ${content} $`;
    } else {
      code = `\\begin{${env}}\n`;
      if (label) code += `  \\label{eq:${label}}\n`;
      code += `  ${content}\n`;
      code += `\\end{${env}}`;
    }
    onChange(code);
  }, [type, content, label]);

  return (
    <Stack>
      <SegmentedControl
        value={type}
        onChange={setType}
        data={[
          { label: "Equation", value: "equation" },
          { label: "Align", value: "align" },
          { label: "Inline ($)", value: "inline" },
        ]}
      />
      <TextInput
        label="Math Content"
        value={content}
        onChange={(e) => setContent(e.currentTarget.value)}
        style={{ fontFamily: "monospace" }}
      />
      {type !== "inline" && (
        <TextInput
          label="Label"
          placeholder="e.g. energy"
          value={label}
          onChange={(e) => setLabel(e.currentTarget.value)}
        />
      )}
      <Group>
        <Button
          variant="default"
          size="xs"
          onClick={() => setContent((prev) => prev + " \\sum_{i=0}^{n} ")}
        >
          Sum
        </Button>
        <Button
          variant="default"
          size="xs"
          onClick={() => setContent((prev) => prev + " \\int_{a}^{b} ")}
        >
          Int
        </Button>
        <Button
          variant="default"
          size="xs"
          onClick={() => setContent((prev) => prev + " \\frac{a}{b} ")}
        >
          Frac
        </Button>
      </Group>
    </Stack>
  );
};

// 2. UNIFIED CODE WIZARD
const CodeWizard = ({
  engine,
  onChange,
}: {
  engine: "listings" | "minted";
  onChange: (code: string) => void;
}) => {
  const [lang, setLang] = useState("python");
  const [caption, setCaption] = useState("");
  const [label, setLabel] = useState("");
  const [codeContent, setCodeContent] = useState('print("Hello World")');
  const [showNumbers, setShowNumbers] = useState(true);
  const [frame, setFrame] = useState(true);
  const [breakLines, setBreakLines] = useState(false);
  const [mintedStyle, setMintedStyle] = useState("friendly");

  const availableLangs = useMemo(() => {
    if (engine === "listings")
      return LANGUAGES_DB.filter((l) => l.listings !== null).map((l) => ({
        value: l.value,
        label: l.label,
      }));
    return LANGUAGES_DB.map((l) => ({ value: l.value, label: l.label }));
  }, [engine]);

  useEffect(() => {
    const langObj = LANGUAGES_DB.find((l) => l.value === lang);
    const langIdentifier =
      engine === "listings"
        ? langObj?.listings || "Python"
        : langObj?.minted || "python";

    let code = "";
    if (engine === "listings") {
      code = `\\begin{lstlisting}[language=${langIdentifier}`;
      if (caption) code += `, caption={${caption}}`;
      if (label) code += `, label={lst:${label}}`;
      if (showNumbers) code += `, numbers=left`;
      if (frame) code += `, frame=single`;
      if (breakLines) code += `, breaklines=true`;
      code += `]\n${codeContent}\n\\end{lstlisting}`;
    } else {
      if (mintedStyle && mintedStyle !== "default")
        code += `\\usemintedstyle{${mintedStyle}}\n`;
      code += `\\begin{minted}`;
      const opts = [];
      if (showNumbers) opts.push("linenos");
      if (frame) opts.push("frame=lines");
      if (breakLines) opts.push("breaklines");
      if (opts.length > 0) code += `[${opts.join(", ")}]`;
      code += `{${langIdentifier}}\n${codeContent}\n\\end{minted}`;
      if (caption || label) {
        let wrap = `\\begin{listing}[H]\n`;
        if (caption) wrap += `  \\caption{${caption}}\n`;
        if (label) wrap += `  \\label{lst:${label}}\n`;
        wrap += code + `\n\\end{listing}`;
        code = wrap;
      }
    }
    onChange(code);
  }, [
    engine,
    lang,
    caption,
    label,
    codeContent,
    showNumbers,
    frame,
    breakLines,
    mintedStyle,
  ]);

  return (
    <Stack>
      <Select
        label="Language"
        value={lang}
        onChange={(v) => setLang(v || "python")}
        data={availableLangs}
        searchable
      />
      {engine === "minted" && (
        <Select
          label="Theme"
          value={mintedStyle}
          onChange={(v) => setMintedStyle(v || "friendly")}
          data={MINTED_STYLES}
          searchable
        />
      )}
      <Group grow>
        <TextInput
          label="Caption"
          value={caption}
          onChange={(e) => setCaption(e.currentTarget.value)}
        />
        <TextInput
          label="Label"
          placeholder="mycode"
          value={label}
          onChange={(e) => setLabel(e.currentTarget.value)}
        />
      </Group>
      <Group>
        <Switch
          label="Line Numbers"
          checked={showNumbers}
          onChange={(e) => setShowNumbers(e.currentTarget.checked)}
        />
        <Switch
          label="Frame"
          checked={frame}
          onChange={(e) => setFrame(e.currentTarget.checked)}
        />
        <Switch
          label="Break Lines"
          checked={breakLines}
          onChange={(e) => setBreakLines(e.currentTarget.checked)}
        />
      </Group>
      <Textarea
        label="Source Code"
        value={codeContent}
        onChange={(e) => setCodeContent(e.currentTarget.value)}
        minRows={6}
        styles={{ input: { fontFamily: "monospace", fontSize: 12 } }}
      />
    </Stack>
  );
};

// 4. GRAPHICX Configurator
const GraphicxConfig = ({ onChange }: { onChange: (code: string) => void }) => {
  useEffect(
    () =>
      onChange(
        `\\begin{figure}[h]\n  \\centering\n  \\includegraphics[width=0.8\\textwidth]{image.png}\n  \\caption{Caption}\n  \\label{fig:my_label}\n\\end{figure}`,
      ),
    [],
  );
  return (
    <Text c="dimmed" size="sm" fs="italic">
      Graphic settings UI will appear here (Width, Rotate, File Picker)...
    </Text>
  );
};

// --- MAIN COMPONENT ---

export const PackageGallery: React.FC<PackageGalleryProps> = ({
  selectedPkgId,
  onInsert,
  onOpenWizard,
  onOpenPackageBrowser,
}) => {
  const [generatedCode, setGeneratedCode] = useState("");

  // --- PACKAGE DATABASE STATE ---
  const [showPackageDB, setShowPackageDB] = useState(false);
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(
    new Set(),
  );
  const [pkgSearch, setPkgSearch] = useState("");
  const [dbPackages, setDbPackages] = useState<ListPackage[]>([]);

  // Fetch packages when database view is shown and search changes
  useEffect(() => {
    if (showPackageDB) {
      const timeout = setTimeout(() => {
        getAllPackages(pkgSearch, undefined, 100).then((res) =>
          setDbPackages(res.packages),
        );
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [showPackageDB, pkgSearch]);

  const [colorConfig, setColorConfig] = useState<{
    pkgXcolor: boolean;
    xcolorOptions: string[];
  }>({ pkgXcolor: true, xcolorOptions: ["table", "dvipsnames"] });
  const [galleryColors, setGalleryColors] = useState<CustomColorDef[]>([]);

  // 2. Enumitem State
  const [listConfig, setListConfig] = useState({
    pkgEnumitem: true,
    enumitemInline: false,
    enumitemSep: "default",
    enumitemItemize: "default",
    enumitemEnumerate: "default",
  });
  const [galleryLists, setGalleryLists] = useState<CustomListDef[]>([]);

  // --- EFFECT: UPDATE GENERATED CODE ---
  useEffect(() => {
    // A. XCOLOR GENERATION
    if (selectedPkgId === "xcolor") {
      let code = "";
      if (colorConfig.pkgXcolor) {
        const opts =
          colorConfig.xcolorOptions && colorConfig.xcolorOptions.length > 0
            ? `[${colorConfig.xcolorOptions.join(",")}]`
            : "";
        code += `\\usepackage${opts}{xcolor}\n\n`;
      }
      if (galleryColors.length > 0) {
        code += `% --- Custom Colors ---\n`;
        galleryColors.forEach((c) => {
          if (c.model === "named (mix)")
            code += `\\colorlet{${c.name}}{${c.value}}\n`;
          else code += `\\definecolor{${c.name}}{${c.model}}{${c.value}}\n`;
        });
      }
      setGeneratedCode(code);
    }
    // B. ENUMITEM GENERATION
    else if (selectedPkgId === "enumitem") {
      let code = "";
      if (listConfig.pkgEnumitem) {
        code += `\\usepackage${
          listConfig.enumitemInline ? "[inline]" : ""
        }{enumitem}\n\n`;

        // Global Settings
        if (listConfig.enumitemSep === "nosep") code += `\\setlist{nosep}\n`;
        else if (listConfig.enumitemSep === "half")
          code += `\\setlist{itemsep=0.5em}\n`;

        if (
          listConfig.enumitemItemize &&
          listConfig.enumitemItemize !== "default"
        ) {
          code += `\\setlist[itemize]{${listConfig.enumitemItemize}}\n`;
        }
        if (
          listConfig.enumitemEnumerate &&
          listConfig.enumitemEnumerate !== "default"
        ) {
          code += `\\setlist[enumerate]{${listConfig.enumitemEnumerate}}\n`;
        }
      }
      // Custom Lists
      if (galleryLists.length > 0) {
        code += `\n% --- Custom Lists ---\n`;
        galleryLists.forEach((l) => {
          code += `\\newlist{${l.name}}{${l.baseType}}{3}\n`;
          if (l.options) code += `\\setlist[${l.name}]{${l.options}}\n`;
        });
      }
      setGeneratedCode(code);
    }
  }, [selectedPkgId, colorConfig, galleryColors, listConfig, galleryLists]);

  const activePackage = PACKAGES_DB.find((p) => p.id === selectedPkgId);

  const handleConfigure = (pkg: LatexPackage) => {
    if (pkg.hasWizard) {
      if (pkg.id === "geometry") {
        onOpenWizard("wizard-preamble");
      } else if (pkg.id === "fancyhdr") {
        onOpenWizard("wizard-fancyhdr");
      } else if (pkg.id === "tabularray") {
        onOpenWizard("wizard-tabularray");
      } else if (
        ![
          "tikz",
          "pgfplots",
          "booktabs",
          "multirow",
          "xcolor",
          "enumitem",
        ].includes(pkg.id)
      ) {
        alert(`Opening specialized wizard for ${pkg.name}...`);
      }
    }
  };

  // Immediately open wizard for fancyhdr instead of showing inline config
  useEffect(() => {
    if (selectedPkgId === "fancyhdr") {
      handleConfigure({
        id: "fancyhdr",
        name: "Fancyhdr",
        category: "layout",
        description: "",
        hasWizard: true,
      });
    }
  }, [selectedPkgId]);

  const isEmbeddedWizard = [
    "tikz",
    "pgfplots",
    "booktabs",
    "multirow",
    "xcolor",
    "enumitem",
    "pstricks",
    "siunitx",
  ].includes(selectedPkgId);

  return (
    // MAIN LAYOUT
    <Box
      h="100%"
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--app-panel-bg)",
        overflow: "hidden",
      }}
    >
      <Box
        p="md"
        style={{
          borderBottom: "1px solid var(--mantine-color-default-border)",
          flexShrink: 0,
        }}
      >
        <Group justify="space-between">
          <Group>
            <ThemeIcon size="lg" variant="light" color="blue">
              {activePackage?.category === "math" ? (
                <FontAwesomeIcon icon={faSquareRootAlt} />
              ) : activePackage?.category === "code" ? (
                <FontAwesomeIcon icon={faFileCode} />
              ) : activePackage?.category === "colors" ? (
                <FontAwesomeIcon icon={faPalette} />
              ) : activePackage?.category === "layout" ? (
                <FontAwesomeIcon icon={faLayerGroup} />
              ) : (
                <FontAwesomeIcon icon={faBoxOpen} />
              )}
            </ThemeIcon>
            <Stack gap={0}>
              <Text fw={700} size="lg">
                {activePackage?.name}
              </Text>
              <Text size="xs" c="dimmed">
                Configure options for {activePackage?.name}
              </Text>
            </Stack>
          </Group>
          <Group>
            {activePackage?.hasWizard && !isEmbeddedWizard && (
              <Button
                variant="light"
                color="teal"
                size="xs"
                leftSection={
                  <FontAwesomeIcon
                    icon={faCog}
                    style={{ width: 14, height: 14 }}
                  />
                }
                onClick={() => activePackage && handleConfigure(activePackage)}
              >
                Open Full Wizard
              </Button>
            )}
            <Tooltip label="Package Info">
              <ActionIcon variant="subtle" color="gray">
                <FontAwesomeIcon
                  icon={faInfoCircle}
                  style={{ width: 18, height: 18 }}
                />
              </ActionIcon>
            </Tooltip>
            {onOpenPackageBrowser && (
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                onClick={onOpenPackageBrowser}
              >
                Browse All Packages
              </Button>
            )}
            <Button
              variant={showPackageDB ? "filled" : "light"}
              color="teal"
              size="xs"
              leftSection={
                <FontAwesomeIcon
                  icon={faDatabase}
                  style={{ width: 12, height: 12 }}
                />
              }
              onClick={() => setShowPackageDB(!showPackageDB)}
            >
              {showPackageDB ? "Hide" : "Add Packages"}
            </Button>
          </Group>
        </Group>
      </Box>

      {/* PACKAGE DATABASE VIEW */}
      {showPackageDB ? (
        <Box
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Box
            p="xs"
            style={{
              borderBottom: "1px solid var(--mantine-color-default-border)",
            }}
          >
            <Group justify="space-between">
              <TextInput
                placeholder="Search packages..."
                leftSection={
                  <FontAwesomeIcon
                    icon={faSearch}
                    style={{ width: 12, height: 12 }}
                  />
                }
                size="xs"
                value={pkgSearch}
                onChange={(e) => setPkgSearch(e.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <Badge color="teal" variant="light">
                {selectedPackages.size} selected
              </Badge>
            </Group>
          </Box>
          <ScrollArea style={{ flex: 1 }}>
            <Stack gap={0} p="xs">
              {dbPackages.map((pkg) => (
                <Group
                  key={pkg.id}
                  p="xs"
                  style={{
                    borderBottom:
                      "1px solid var(--mantine-color-default-border)",
                    cursor: "pointer",
                    backgroundColor: selectedPackages.has(pkg.id)
                      ? "var(--mantine-color-teal-9)"
                      : undefined,
                  }}
                  onClick={() => {
                    const newSet = new Set(selectedPackages);
                    if (newSet.has(pkg.id)) {
                      newSet.delete(pkg.id);
                    } else {
                      newSet.add(pkg.id);
                    }
                    setSelectedPackages(newSet);
                  }}
                >
                  <Checkbox
                    checked={selectedPackages.has(pkg.id)}
                    onChange={() => {}}
                    size="xs"
                  />
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={500} truncate>
                      {pkg.name}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {pkg.caption}
                    </Text>
                  </Box>
                </Group>
              ))}
            </Stack>
          </ScrollArea>
          <Divider />
          <Box p="xs">
            <Button
              fullWidth
              color="teal"
              disabled={selectedPackages.size === 0}
              leftSection={
                <FontAwesomeIcon
                  icon={faCheck}
                  style={{ width: 14, height: 14 }}
                />
              }
              onClick={() => {
                const code = Array.from(selectedPackages)
                  .map((id) => `\\usepackage{${id}}`)
                  .join("\n");
                onInsert(code + "\n");
                setSelectedPackages(new Set());
                setShowPackageDB(false);
              }}
            >
              Insert {selectedPackages.size} Package
              {selectedPackages.size !== 1 ? "s" : ""}
            </Button>
          </Box>
        </Box>
      ) : isEmbeddedWizard ? (
        <Box style={{ flex: 1, overflow: "hidden" }}>
          {(selectedPkgId === "tikz" || selectedPkgId === "pgfplots") && (
            <TikzPgfPlotsWizard onInsert={onInsert} />
          )}
          {(selectedPkgId === "booktabs" || selectedPkgId === "multirow") && (
            <TableWizard onInsert={onInsert} />
          )}
          {selectedPkgId === "pstricks" && (
            <PstricksWizard onInsert={onInsert} onChange={setGeneratedCode} />
          )}
          {selectedPkgId === "xcolor" && (
            <Box p="md" h="100%">
              <ColorsTab
                config={colorConfig as any}
                customColors={galleryColors}
                onChange={(key, val) =>
                  setColorConfig((prev) => ({ ...prev, [key]: val }))
                }
                onAddColor={(name, model, value, previewHex) => {
                  const newCol = {
                    id: Date.now(),
                    name,
                    model,
                    value,
                    previewHex,
                  };
                  setGalleryColors((prev) => [...prev, newCol]);
                }}
                onRemoveColor={(id) =>
                  setGalleryColors((prev) => prev.filter((c) => c.id !== id))
                }
                onInsert={onInsert}
              />
            </Box>
          )}
          {selectedPkgId === "enumitem" && (
            <Box p="md" h="100%">
              <ScrollArea h="100%" type="auto" offsetScrollbars>
                <ListsTab
                  config={listConfig as any}
                  customLists={galleryLists}
                  onChange={(key, val) =>
                    setListConfig((prev) => ({ ...prev, [key]: val }))
                  }
                  onAddList={(name, type, options) => {
                    // "options" argument here receives the options string constructed in ListsTab
                    const newList: CustomListDef = {
                      id: Date.now(),
                      name,
                      baseType: type,
                      options: options, // Stores full options string
                    };
                    setGalleryLists((prev) => [...prev, newList]);
                  }}
                  onRemoveList={(id) =>
                    setGalleryLists((prev) => prev.filter((l) => l.id !== id))
                  }
                />
              </ScrollArea>
            </Box>
          )}
          {selectedPkgId === "siunitx" && <SiunitxWizard onInsert={onInsert} />}
        </Box>
      ) : (
        <ScrollArea
          style={{ flex: 1, minHeight: 0 }}
          p="md"
          type="auto"
          offsetScrollbars
        >
          {selectedPkgId === "amsmath" && (
            <AmsMathConfig onChange={setGeneratedCode} />
          )}
          {(selectedPkgId === "listings" || selectedPkgId === "minted") && (
            <CodeWizard
              engine={selectedPkgId as "listings" | "minted"}
              onChange={setGeneratedCode}
            />
          )}
          {selectedPkgId === "graphicx" && (
            <GraphicxConfig onChange={setGeneratedCode} />
          )}
          {selectedPkgId === "tabularx" && (
            <Text c="dimmed">Tabularx settings would appear here.</Text>
          )}
          {activePackage?.hasWizard &&
            !["amsmath", "listings", "minted", "graphicx"].includes(
              selectedPkgId,
            ) && (
              <Stack align="center" mt="xl">
                <Text>This package has a dedicated Full Wizard.</Text>
                <Button
                  onClick={() =>
                    activePackage && handleConfigure(activePackage)
                  }
                >
                  Launch Wizard
                </Button>
              </Stack>
            )}
        </ScrollArea>
      )}

      {!isEmbeddedWizard ||
      ["xcolor", "enumitem", "pstricks"].includes(selectedPkgId) ? (
        <Stack
          gap={0}
          p="md"
          style={{
            backgroundColor: "var(--app-header-bg)",
            borderTop: "1px solid var(--mantine-color-default-border)",
            flexShrink: 0,
          }}
        >
          <Group justify="space-between" mb="xs">
            <Text size="xs" fw={700} c="dimmed">
              GENERATED CODE
            </Text>
            <Group gap="xs">
              {activePackage?.command &&
                !["xcolor", "enumitem", "pstricks"].includes(selectedPkgId) && (
                  <Button
                    variant="default"
                    size="compact-xs"
                    onClick={() => onInsert(activePackage.command! + "\n")}
                  >
                    Add \usepackage
                  </Button>
                )}
              <ActionIcon
                size="xs"
                variant="subtle"
                onClick={() => navigator.clipboard.writeText(generatedCode)}
              >
                <FontAwesomeIcon
                  icon={faCopy}
                  style={{ width: 12, height: 12 }}
                />
              </ActionIcon>
            </Group>
          </Group>
          <ScrollArea
            h={80}
            mb="md"
            type="auto"
            style={{
              border: "1px solid var(--mantine-color-default-border)",
              borderRadius: 4,
              backgroundColor: "var(--mantine-color-default)",
            }}
          >
            <Code block style={{ background: "transparent", fontSize: 11 }}>
              {generatedCode}
            </Code>
          </ScrollArea>
          <Button
            fullWidth
            leftSection={
              <FontAwesomeIcon
                icon={faCheck}
                style={{ width: 16, height: 16 }}
              />
            }
            onClick={() => onInsert(generatedCode)}
          >
            Insert into Document
          </Button>
        </Stack>
      ) : null}
    </Box>
  );
};
