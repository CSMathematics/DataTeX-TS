import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  ActionIcon,
  Badge,
  Box,
  Button,
  ColorInput,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconAdjustmentsHorizontal,
  IconAlertTriangle,
  IconCode,
  IconPalette,
  IconRestore,
  IconSearch,
  IconSparkles,
} from "@tabler/icons-react";
import {
  getLatexThemeBackground,
  getResolvedLatexSyntaxColor,
  getResolvedLatexSyntaxFontStyles,
  isLatexEditorThemeId,
  LATEX_EDITOR_THEME_IDS,
  LATEX_SYNTAX_FONT_STYLES,
  LATEX_SYNTAX_COLOR_GROUPS,
  LATEX_SYNTAX_COLOR_SLOTS,
  normalizeLatexSyntaxColor,
} from "../../themes/latex-theme-customization";
import type {
  LatexEditorThemeId,
  LatexSyntaxFontStyle,
  LatexSyntaxColorSlotId,
  LatexSyntaxResolvedFontStyleState,
  LatexSyntaxSlotOverrides,
  LatexSyntaxHighlightingSettings,
} from "../../themes/latex-theme-customization";
import classes from "./SyntaxHighlightingSettings.module.css";

interface SyntaxHighlightingSettingsProps {
  settings: LatexSyntaxHighlightingSettings;
  activeEditorTheme: string;
  onSetLatexSyntaxColor: (
    themeId: LatexEditorThemeId,
    slotId: LatexSyntaxColorSlotId,
    color: string,
  ) => void;
  onResetLatexSyntaxColor: (
    themeId: LatexEditorThemeId,
    slotId: LatexSyntaxColorSlotId,
  ) => void;
  onSetLatexSyntaxFontStyle: (
    themeId: LatexEditorThemeId,
    slotId: LatexSyntaxColorSlotId,
    fontStyle: LatexSyntaxFontStyle,
    enabled: boolean,
  ) => void;
  onResetLatexSyntaxFontStyles: (
    themeId: LatexEditorThemeId,
    slotId: LatexSyntaxColorSlotId,
  ) => void;
  onResetLatexSyntaxColorGroup: (
    themeId: LatexEditorThemeId,
    slotIds: readonly LatexSyntaxColorSlotId[],
  ) => void;
  onResetLatexSyntaxTheme: (themeId: LatexEditorThemeId) => void;
  onResetAllLatexSyntaxColors: () => void;
}

const FONT_STYLE_GLYPHS: Record<LatexSyntaxFontStyle, string> = {
  bold: "B",
  italic: "I",
  underline: "U",
  strikethrough: "S",
};

interface SyntaxColorInputProps {
  slotId: LatexSyntaxColorSlotId;
  label: string;
  value: string;
  swatches: string[];
  onDraftChange: (slotId: LatexSyntaxColorSlotId, value: string) => void;
  onCommit: (
    slotId: LatexSyntaxColorSlotId,
    value: string,
    source: "change-end" | "blur",
  ) => void;
}

const SyntaxColorInput = React.memo<SyntaxColorInputProps>(
  ({ slotId, label, value, swatches, onDraftChange, onCommit }) => (
    <ColorInput
      className={classes.colorInput}
      aria-label={`${label}: ${value}`}
      value={value}
      format="hex"
      size="xs"
      swatches={swatches}
      swatchesPerRow={7}
      popoverProps={{
        withinPortal: true,
        position: "bottom-end",
      }}
      onChange={(nextValue) => onDraftChange(slotId, nextValue)}
      onChangeEnd={(nextValue) =>
        onCommit(slotId, nextValue, "change-end")
      }
      onBlur={(event) =>
        onCommit(slotId, event.currentTarget.value, "blur")
      }
    />
  ),
);

SyntaxColorInput.displayName = "SyntaxColorInput";

const THEME_LABELS: Record<LatexEditorThemeId, string> = {
  "data-tex-dark": "DataTeX Dark",
  "data-tex-light": "DataTeX Light",
  "data-tex-hc": "High Contrast",
  "data-tex-monokai": "Monokai Vivid",
  "data-tex-nord": "Nordic Cool",
};

const EMPTY_LATEX_SYNTAX_OVERRIDES = Object.freeze(
  {},
) as LatexSyntaxSlotOverrides;

type PreviewToken = readonly [LatexSyntaxColorSlotId, string];

const DOCUMENT_PREVIEW: readonly (readonly PreviewToken[])[] = [
  [
    ["controlCommand", "\\documentclass"],
    ["optionBracket", "["],
    ["optionNumber", "11pt"],
    ["optionBracket", "]"],
    ["curlyBrace", "{"],
    ["documentClass", "article"],
    ["curlyBrace", "}"],
  ],
  [
    ["controlCommand", "\\usepackage"],
    ["curlyBrace", "{"],
    ["packageName", "amsmath"],
    ["comma", ","],
    ["packageName", "tikz"],
    ["curlyBrace", "}"],
  ],
  [
    ["controlCommand", "\\begin"],
    ["curlyBrace", "{"],
    ["environmentDocument", "document"],
    ["curlyBrace", "}"],
  ],
  [
    ["sectionCommand", "\\section"],
    ["curlyBrace", "{"],
    ["sectionTitle", "Elegant mathematics"],
    ["curlyBrace", "}"],
  ],
];

const MATH_PREVIEW: readonly (readonly PreviewToken[])[] = [
  [
    ["controlCommand", "\\begin"],
    ["curlyBrace", "{"],
    ["environmentMath", "align*"],
    ["curlyBrace", "}"],
  ],
  [
    ["plainText", "  "],
    ["mathVariable", "f"],
    ["mathParenthesis", "("],
    ["mathVariable", "x"],
    ["mathParenthesis", ")"],
    ["mathAlignment", " &"],
    ["mathRelationSymbol", "="],
    ["plainText", " "],
    ["mathLargeOperator", "\\sum"],
    ["mathSubscript", "_"],
    ["mathCurlyBrace", "{"],
    ["mathVariable", "n"],
    ["mathRelationSymbol", "="],
    ["mathNumber", "1"],
    ["mathCurlyBrace", "}"],
    ["mathSubscript", "^"],
    ["mathCurlyBrace", "{"],
    ["mathSymbol", "\\infty"],
    ["mathCurlyBrace", "}"],
    ["plainText", " "],
    ["mathGreek", "\\alpha"],
    ["mathSubscript", "_"],
    ["mathVariable", "n"],
    ["plainText", " "],
    ["mathVariable", "x"],
    ["mathSubscript", "^"],
    ["mathVariable", "n"],
    ["plainText", " "],
    ["mathArithmetic", "+"],
    ["plainText", " "],
    ["mathNumber", "42"],
    ["mathPunctuation", ","],
    ["plainText", " "],
    ["mathEscape", "\\\\"],
  ],
  [
    ["plainText", "  "],
    ["mathAccent", "\\vec"],
    ["mathCurlyBrace", "{"],
    ["mathVariable", "v"],
    ["mathCurlyBrace", "}"],
    ["mathAlignment", " &"],
    ["mathRelationCommand", "\\leq"],
    ["plainText", " "],
    ["mathFunction", "\\frac"],
    ["mathCurlyBrace", "{"],
    ["mathVariable", "a"],
    ["mathArithmetic", "+"],
    ["mathVariable", "b"],
    ["mathCurlyBrace", "}"],
    ["mathCurlyBrace", "{"],
    ["mathVariable", "c"],
    ["mathCurlyBrace", "}"],
    ["plainText", " "],
    ["mathArrow", "\\longrightarrow"],
    ["plainText", " "],
    ["mathFont", "\\mathbb"],
    ["mathCurlyBrace", "{"],
    ["mathVariable", "R"],
    ["mathCurlyBrace", "}"],
  ],
  [
    ["controlCommand", "\\end"],
    ["curlyBrace", "{"],
    ["environmentMath", "align*"],
    ["curlyBrace", "}"],
  ],
];

const OPTIONS_PREVIEW: readonly (readonly PreviewToken[])[] = [
  [
    ["controlCommand", "\\begin"],
    ["curlyBrace", "{"],
    ["environmentDrawing", "tikzpicture"],
    ["curlyBrace", "}"],
    ["optionBracket", "["],
    ["optionName", "line width"],
    ["optionAssignment", "="],
    ["optionNumber", "0.7pt"],
    ["comma", ", "],
    ["optionName", "color"],
    ["optionAssignment", "="],
    ["optionValue", "cyan"],
    ["optionBracket", "]"],
  ],
  [
    ["formattingCommand", "\\textbf"],
    ["curlyBrace", "{"],
    ["formattedText", "Readable source"],
    ["curlyBrace", "}"],
    ["plainText", "  "],
    ["referenceCommand", "\\label"],
    ["curlyBrace", "{"],
    ["referenceKey", "fig:preview"],
    ["curlyBrace", "}"],
  ],
  [["comment", "% Semantic colors stay fast and focused"]],
];

const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();

function removeDrafts(
  previous: Record<string, string>,
  predicate: (key: string) => boolean,
) {
  const next = { ...previous };
  for (const key of Object.keys(next)) {
    if (predicate(key)) delete next[key];
  }
  return next;
}

function relativeLuminance(color: string): number | undefined {
  const normalized = normalizeLatexSyntaxColor(color);
  if (!normalized) return undefined;

  const channels = [1, 3, 5].map((index) => {
    const value = Number.parseInt(normalized.slice(index, index + 2), 16) / 255;
    return value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  if (foregroundLuminance === undefined || backgroundLuminance === undefined) {
    return undefined;
  }
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export const SyntaxHighlightingSettings: React.FC<
  SyntaxHighlightingSettingsProps
> = ({
  settings,
  activeEditorTheme,
  onSetLatexSyntaxColor,
  onResetLatexSyntaxColor,
  onSetLatexSyntaxFontStyle,
  onResetLatexSyntaxFontStyles,
  onResetLatexSyntaxColorGroup,
  onResetLatexSyntaxTheme,
  onResetAllLatexSyntaxColors,
}) => {
  const { t, i18n } = useTranslation();
  const isGreek = (i18n.resolvedLanguage ?? i18n.language).startsWith("el");
  const [selectedTheme, setSelectedTheme] = useState<LatexEditorThemeId>(() =>
    isLatexEditorThemeId(activeEditorTheme)
      ? activeEditorTheme
      : LATEX_EDITOR_THEME_IDS[0],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [customizedOnly, setCustomizedOnly] = useState(false);
  const [lowContrastOnly, setLowContrastOnly] = useState(false);
  const [advancedFormatting, setAdvancedFormatting] = useState(true);
  const [draftColors, setDraftColors] = useState<Record<string, string>>({});
  const [openedGroups, setOpenedGroups] = useState<string[]>([
    "appearance",
    "commands",
    "environments",
  ]);
  const [pendingReset, setPendingReset] = useState<"theme" | "all" | null>(
    null,
  );
  const pendingColorCommits = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const pendingDraftColors = useRef<Record<string, string>>({});
  const draftFrame = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (draftFrame.current !== null) {
        cancelAnimationFrame(draftFrame.current);
      }
      for (const timer of pendingColorCommits.current.values()) {
        clearTimeout(timer);
      }
      pendingColorCommits.current.clear();
    },
    [],
  );

  useEffect(() => {
    if (isLatexEditorThemeId(activeEditorTheme)) {
      setSelectedTheme(activeEditorTheme);
    }
  }, [activeEditorTheme]);

  const themeOverrides: LatexSyntaxSlotOverrides =
    settings.themes[selectedTheme] ?? EMPTY_LATEX_SYNTAX_OVERRIDES;
  const draftKey = useCallback(
    (slotId: LatexSyntaxColorSlotId) => `${selectedTheme}:${slotId}`,
    [selectedTheme],
  );
  const isCustomized = (slotId: LatexSyntaxColorSlotId) =>
    themeOverrides[slotId] !== undefined;
  const isColorCustomized = (slotId: LatexSyntaxColorSlotId) =>
    themeOverrides[slotId]?.foreground !== undefined;
  const resolvedColors = useMemo(
    () =>
      Object.fromEntries(
        LATEX_SYNTAX_COLOR_SLOTS.map(({ id }) => [
          id,
          getResolvedLatexSyntaxColor(selectedTheme, id, themeOverrides),
        ]),
      ) as Record<LatexSyntaxColorSlotId, string>,
    [selectedTheme, themeOverrides],
  );
  const resolvedTypography = useMemo(
    () =>
      Object.fromEntries(
        LATEX_SYNTAX_COLOR_SLOTS.map(({ id }) => [
          id,
          getResolvedLatexSyntaxFontStyles(
            selectedTheme,
            id,
            themeOverrides,
          ),
        ]),
      ) as Record<
        LatexSyntaxColorSlotId,
        LatexSyntaxResolvedFontStyleState
      >,
    [selectedTheme, themeOverrides],
  );
  const resolvedColor = (slotId: LatexSyntaxColorSlotId) =>
    resolvedColors[slotId];
  const displayedColor = (slotId: LatexSyntaxColorSlotId) =>
    normalizeLatexSyntaxColor(draftColors[draftKey(slotId)]) ??
    resolvedColor(slotId);
  const resolvedFontStyles = (slotId: LatexSyntaxColorSlotId) =>
    resolvedTypography[slotId];

  const backgroundColor =
    normalizeLatexSyntaxColor(draftColors[draftKey("editorBackground")]) ??
    getLatexThemeBackground(selectedTheme, themeOverrides);
  const plainTextColor = displayedColor("plainText");

  const customizedCount = LATEX_SYNTAX_COLOR_SLOTS.filter(({ id }) =>
    isCustomized(id),
  ).length;
  const totalCustomizedCount = LATEX_EDITOR_THEME_IDS.reduce(
    (total, themeId) =>
      total +
      LATEX_SYNTAX_COLOR_SLOTS.filter(
        ({ id }) => settings.themes[themeId]?.[id] !== undefined,
      ).length,
    0,
  );

  const swatches = useMemo(
    () =>
      Array.from(new Set(Object.values(resolvedColors))).slice(0, 14),
    [resolvedColors],
  );

  const visibleGroups = useMemo(() => {
    const query = normalizeSearch(searchQuery);
    return LATEX_SYNTAX_COLOR_GROUPS.map((group) => {
      const groupLabel = isGreek ? group.labelEl : group.label;
      const groupDescription = isGreek
        ? group.descriptionEl
        : group.description;
      const groupMatches =
        query.length > 0 &&
        normalizeSearch(`${groupLabel} ${groupDescription}`).includes(query);
      const slots = LATEX_SYNTAX_COLOR_SLOTS.filter((slot) => {
        if (slot.groupId !== group.id) return false;
        if (customizedOnly && themeOverrides[slot.id] === undefined) return false;
        if (lowContrastOnly) {
          if (slot.id === "editorBackground") return false;
          const ratio = contrastRatio(
            resolvedColors[slot.id],
            resolvedColors.editorBackground,
          );
          if (ratio === undefined || ratio >= 4.5) return false;
        }
        if (!query || groupMatches) return true;
        const label = isGreek ? slot.labelEl : slot.label;
        const description = isGreek ? slot.descriptionEl : slot.description;
        return normalizeSearch(
          `${label} ${description} ${slot.sample} ${slot.id}`,
        ).includes(query);
      });
      return { group, slots };
    }).filter(({ slots }) => slots.length > 0);
  }, [
    customizedOnly,
    isGreek,
    lowContrastOnly,
    resolvedColors,
    searchQuery,
    themeOverrides,
  ]);

  const visibleColorCount = visibleGroups.reduce(
    (total, { slots }) => total + slots.length,
    0,
  );

  useEffect(() => {
    if (searchQuery.trim() || customizedOnly || lowContrastOnly) {
      setOpenedGroups(visibleGroups.map(({ group }) => group.id));
    }
  }, [customizedOnly, lowContrastOnly, searchQuery, visibleGroups]);

  const cancelPendingColor = useCallback((key: string) => {
    const timer = pendingColorCommits.current.get(key);
    if (timer !== undefined) {
      clearTimeout(timer);
      pendingColorCommits.current.delete(key);
    }
    delete pendingDraftColors.current[key];
  }, []);

  const cancelPendingColors = useCallback(
    (predicate: (key: string) => boolean) => {
      const keys = new Set([
        ...pendingColorCommits.current.keys(),
        ...Object.keys(pendingDraftColors.current),
      ]);
      for (const key of keys) {
        if (predicate(key)) cancelPendingColor(key);
      }
      if (
        draftFrame.current !== null &&
        Object.keys(pendingDraftColors.current).length === 0
      ) {
        cancelAnimationFrame(draftFrame.current);
        draftFrame.current = null;
      }
    },
    [cancelPendingColor],
  );

  const handleColorDraftChange = useCallback(
    (slotId: LatexSyntaxColorSlotId, color: string) => {
      const key = draftKey(slotId);
      cancelPendingColor(key);
      pendingDraftColors.current[key] = color;

      if (draftFrame.current === null) {
        draftFrame.current = requestAnimationFrame(() => {
          const updates = pendingDraftColors.current;
          pendingDraftColors.current = {};
          draftFrame.current = null;
          setDraftColors((current) => ({ ...current, ...updates }));
        });
      }
    },
    [cancelPendingColor, draftKey],
  );

  const handleColorChangeEnd = useCallback(
    (
      slotId: LatexSyntaxColorSlotId,
      color: string,
      source: "change-end" | "blur",
    ) => {
      const normalized = normalizeLatexSyntaxColor(color);
      if (!normalized) return;

      const key = draftKey(slotId);
      const previousTimer = pendingColorCommits.current.get(key);
      if (previousTimer !== undefined) clearTimeout(previousTimer);

      // Mantine treats three-digit hex as valid while the user may still be
      // typing a six-digit value. Commit short hex only on blur so `#123`
      // cannot replace the controlled input before digit four is entered.
      const isShortHex = /^#?[0-9a-f]{3}$/i.test(color.trim());
      if (isShortHex && source !== "blur") return;
      const timer = setTimeout(
        () => {
          pendingColorCommits.current.delete(key);
          delete pendingDraftColors.current[key];
          setDraftColors((current) => ({
            ...current,
            [key]: normalized,
          }));

          const themeDefault = getResolvedLatexSyntaxColor(
            selectedTheme,
            slotId,
          );
          if (normalized === themeDefault) {
            onResetLatexSyntaxColor(selectedTheme, slotId);
          } else {
            onSetLatexSyntaxColor(selectedTheme, slotId, normalized);
          }
        },
        80,
      );
      pendingColorCommits.current.set(key, timer);
    },
    [
      draftKey,
      onResetLatexSyntaxColor,
      onSetLatexSyntaxColor,
      selectedTheme,
    ],
  );

  const handleResetColor = (slotId: LatexSyntaxColorSlotId) => {
    const key = draftKey(slotId);
    cancelPendingColor(key);
    setDraftColors((current) => removeDrafts(current, (item) => item === key));
    onResetLatexSyntaxColor(selectedTheme, slotId);
  };

  const handleToggleFontStyle = (
    slotId: LatexSyntaxColorSlotId,
    fontStyle: LatexSyntaxFontStyle,
  ) => {
    const current = resolvedFontStyles(slotId)[fontStyle];
    onSetLatexSyntaxFontStyle(
      selectedTheme,
      slotId,
      fontStyle,
      current !== true,
    );
  };

  const handleResetFontStyles = (slotId: LatexSyntaxColorSlotId) => {
    onResetLatexSyntaxFontStyles(selectedTheme, slotId);
  };

  const getPreviewTypography = (
    slotId: LatexSyntaxColorSlotId,
  ): React.CSSProperties => {
    const fontStyles = resolvedFontStyles(slotId);
    const underline = fontStyles.underline !== false;
    const strikethrough = fontStyles.strikethrough !== false;
    const textDecorations = [
      underline ? "underline" : "",
      strikethrough ? "line-through" : "",
    ].filter(Boolean);

    return {
      fontStyle: fontStyles.italic !== false ? "italic" : "normal",
      fontWeight: fontStyles.bold !== false ? 700 : 400,
      textDecoration:
        textDecorations.length > 0 ? textDecorations.join(" ") : "none",
      textUnderlinePosition: underline ? "under" : undefined,
    };
  };

  const handleResetGroup = (slotIds: readonly LatexSyntaxColorSlotId[]) => {
    const keys = new Set(slotIds.map((slotId) => draftKey(slotId)));
    cancelPendingColors((item) => keys.has(item));
    setDraftColors((current) =>
      removeDrafts(current, (item) => keys.has(item)),
    );
    onResetLatexSyntaxColorGroup(selectedTheme, slotIds);
  };

  const confirmReset = () => {
    if (pendingReset === "theme") {
      const prefix = `${selectedTheme}:`;
      cancelPendingColors((item) => item.startsWith(prefix));
      setDraftColors((current) =>
        removeDrafts(current, (item) => item.startsWith(prefix)),
      );
      onResetLatexSyntaxTheme(selectedTheme);
    } else if (pendingReset === "all") {
      cancelPendingColors(() => true);
      setDraftColors({});
      onResetAllLatexSyntaxColors();
    }
    setPendingReset(null);
  };

  const renderPreviewLines = (
    title: string,
    lines: readonly (readonly PreviewToken[])[],
    startLine: number,
  ) => (
    <React.Fragment key={title}>
      <Box className={classes.previewLine}>
        <span className={classes.lineNumber}>{startLine}</span>
        <span className={classes.codeText}>
          <span
            style={{
              color: displayedColor("comment"),
              ...getPreviewTypography("comment"),
            }}
          >
            {`% ${title}`}
          </span>
        </span>
      </Box>
      {lines.map((line, lineIndex) => (
        <Box className={classes.previewLine} key={`${title}-${lineIndex}`}>
          <span className={classes.lineNumber}>{startLine + lineIndex + 1}</span>
          <span className={classes.codeText}>
            {line.map(([slotId, content], tokenIndex) => (
              <span
                key={`${slotId}-${tokenIndex}`}
                style={{
                  color: displayedColor(slotId),
                  ...getPreviewTypography(slotId),
                }}
              >
                {content}
              </span>
            ))}
          </span>
        </Box>
      ))}
    </React.Fragment>
  );

  return (
    <Stack gap="lg" className={classes.root}>
      <Paper withBorder radius="lg" p="lg" className={classes.hero}>
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="lg">
          <Group align="flex-start" wrap="nowrap" maw={720}>
            <ThemeIcon size={42} radius="md" variant="light">
              <IconPalette size={23} stroke={1.7} />
            </ThemeIcon>
            <Box>
              <Group gap="xs" align="center">
                <Title order={3}>{t("settings.syntaxColors.title")}</Title>
                <Badge size="xs" variant="light" leftSection={<IconSparkles size={11} />}>
                  {t("settings.syntaxColors.professionalPalette")}
                </Badge>
              </Group>
              <Text size="sm" c="dimmed" mt={4} maw={680}>
                {t("settings.syntaxColors.description")}
              </Text>
            </Box>
          </Group>
          <Group gap="xs">
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              leftSection={<IconRestore size={15} />}
              disabled={customizedCount === 0}
              onClick={() => setPendingReset("theme")}
            >
              {t("settings.syntaxColors.resetTheme")}
            </Button>
            <Button
              variant="light"
              color="red"
              size="xs"
              leftSection={<IconRestore size={15} />}
              disabled={totalCustomizedCount === 0}
              onClick={() => setPendingReset("all")}
            >
              {t("settings.syntaxColors.resetAll")}
            </Button>
          </Group>
        </Group>
      </Paper>

      <Paper withBorder radius="md" p="md">
        <Box className={classes.toolbar}>
          <Select
            label={t("settings.syntaxColors.themeLabel")}
            description={t("settings.syntaxColors.themeDescription")}
            data={LATEX_EDITOR_THEME_IDS.map((themeId) => ({
              value: themeId,
              label: THEME_LABELS[themeId],
            }))}
            value={selectedTheme}
            allowDeselect={false}
            leftSection={<IconAdjustmentsHorizontal size={16} />}
            onChange={(value) => {
              if (isLatexEditorThemeId(value)) setSelectedTheme(value);
            }}
            renderOption={({ option }) => (
              <Group justify="space-between" flex={1} wrap="nowrap">
                <Text size="sm">{option.label}</Text>
                {option.value === activeEditorTheme && (
                  <Badge size="xs" variant="light">
                    {t("settings.syntaxColors.activeTheme")}
                  </Badge>
                )}
              </Group>
            )}
          />
          <TextInput
            label={t("common.search")}
            placeholder={t("settings.syntaxColors.searchPlaceholder")}
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
          />
          <Stack gap={7} className={classes.filterControls}>
            <Switch
              size="sm"
              label={t("settings.syntaxColors.customizedOnly")}
              checked={customizedOnly}
              onChange={(event) =>
                setCustomizedOnly(event.currentTarget.checked)
              }
            />
            <Switch
              size="sm"
              label={t("settings.syntaxColors.lowContrastOnly")}
              checked={lowContrastOnly}
              onChange={(event) =>
                setLowContrastOnly(event.currentTarget.checked)
              }
            />
            <Tooltip
              label={t(
                "settings.syntaxColors.advancedFormattingDescription",
              )}
              multiline
              maw={320}
            >
              <Switch
                size="sm"
                label={t("settings.syntaxColors.advancedFormatting")}
                checked={advancedFormatting}
                onChange={(event) =>
                  setAdvancedFormatting(event.currentTarget.checked)
                }
              />
            </Tooltip>
          </Stack>
        </Box>
        <Text size="xs" fw={650} c="dimmed" mt="md" mb={7}>
          {t("settings.syntaxColors.themePalettes")}
        </Text>
        <Box className={classes.themeRail}>
          {LATEX_EDITOR_THEME_IDS.map((themeId) => {
            const overrides = settings.themes[themeId] ?? {};
            const count = LATEX_SYNTAX_COLOR_SLOTS.filter(
              ({ id }) => overrides[id] !== undefined,
            ).length;
            const palette = [
              "controlCommand",
              "environmentMath",
              "mathVariable",
              "mathNumber",
            ] as const;
            return (
              <UnstyledButton
                key={themeId}
                className={classes.themeCard}
                data-selected={themeId === selectedTheme || undefined}
                data-active-theme={themeId === activeEditorTheme || undefined}
                aria-pressed={themeId === selectedTheme}
                onClick={() => setSelectedTheme(themeId)}
              >
                <Group justify="space-between" gap="xs" wrap="nowrap">
                  <Text size="xs" fw={650} truncate>
                    {THEME_LABELS[themeId]}
                  </Text>
                  {count > 0 && (
                    <Badge size="xs" variant="light" circle>
                      {count}
                    </Badge>
                  )}
                </Group>
                <Group gap={4} mt={7} wrap="nowrap">
                  {palette.map((slotId) => (
                    <Box
                      key={slotId}
                      className={classes.themeSwatch}
                      bg={getResolvedLatexSyntaxColor(
                        themeId,
                        slotId,
                        overrides,
                      )}
                    />
                  ))}
                  {themeId === activeEditorTheme && (
                    <Box className={classes.activeThemeDot} ml="auto" />
                  )}
                </Group>
              </UnstyledButton>
            );
          })}
        </Box>
        <Group justify="space-between" mt="sm" gap="xs">
          <Text size="xs" c="dimmed">
            {t("settings.syntaxColors.showingCount", {
              visible: visibleColorCount,
              total: LATEX_SYNTAX_COLOR_SLOTS.length,
            })}
          </Text>
          {selectedTheme === activeEditorTheme && (
            <Badge size="xs" variant="dot" color="green">
              {t("settings.syntaxColors.activeTheme")}
            </Badge>
          )}
        </Group>
      </Paper>

      <Box className={classes.workspace}>
        <Box className={classes.paletteColumn}>
          {visibleGroups.length === 0 ? (
            <Paper p="xl" radius="md" className={classes.emptyState}>
              <Stack align="center" gap={5}>
                <IconSearch size={24} stroke={1.5} />
                <Text fw={600}>{t("settings.syntaxColors.noResultsTitle")}</Text>
                <Text size="sm" c="dimmed" ta="center">
                  {t("settings.syntaxColors.noResultsDescription")}
                </Text>
              </Stack>
            </Paper>
          ) : (
            <Accordion
              multiple
              value={openedGroups}
              onChange={setOpenedGroups}
              chevronPosition="right"
            >
              {visibleGroups.map(({ group, slots }) => {
                const allGroupSlotIds = LATEX_SYNTAX_COLOR_SLOTS.filter(
                  ({ groupId }) => groupId === group.id,
                ).map(({ id }) => id);
                const groupCustomizedCount = allGroupSlotIds.filter((id) =>
                  isCustomized(id),
                ).length;
                return (
                  <Accordion.Item
                    value={group.id}
                    key={group.id}
                    className={classes.accordionItem}
                  >
                    <Accordion.Control py="sm">
                      <Group justify="space-between" wrap="nowrap" pr="xs">
                        <Box>
                          <Text size="sm" fw={650}>
                            {isGreek ? group.labelEl : group.label}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {isGreek
                              ? group.descriptionEl
                              : group.description}
                          </Text>
                        </Box>
                        {groupCustomizedCount > 0 && (
                          <Badge size="xs" variant="light">
                            {groupCustomizedCount}
                          </Badge>
                        )}
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel p={0}>
                      <Group
                        justify="space-between"
                        px="md"
                        py={7}
                        className={classes.groupActions}
                      >
                        <Text size="xs" c="dimmed">
                          {slots.length} / {allGroupSlotIds.length}
                        </Text>
                        <Button
                          variant="subtle"
                          color="gray"
                          size="compact-xs"
                          leftSection={<IconRestore size={13} />}
                          disabled={groupCustomizedCount === 0}
                          onClick={() => handleResetGroup(allGroupSlotIds)}
                        >
                          {t("settings.syntaxColors.resetGroup")}
                        </Button>
                      </Group>
                      <Box
                        className={`${classes.propertyHeader} ${
                          advancedFormatting
                            ? classes.propertyHeaderAdvanced
                            : ""
                        }`}
                      >
                        <Text size="xs" fw={650} c="dimmed">
                          {t("settings.syntaxColors.property")}
                        </Text>
                        <Text size="xs" fw={650} c="dimmed">
                          {t("settings.syntaxColors.sample")}
                        </Text>
                        <Text size="xs" fw={650} c="dimmed">
                          {t("settings.syntaxColors.foreground")}
                        </Text>
                        {advancedFormatting && (
                          <Text size="xs" fw={650} c="dimmed" ta="center">
                            {t("settings.syntaxColors.format")}
                          </Text>
                        )}
                        <Text size="xs" fw={650} c="dimmed" ta="center">
                          {t("settings.syntaxColors.actions")}
                        </Text>
                      </Box>
                      <Box className={classes.colorRows}>
                        {slots.map((slot) => {
                          const color = displayedColor(slot.id);
                          const contrast = contrastRatio(color, backgroundColor);
                          const hasLowContrast =
                            slot.id !== "editorBackground" &&
                            contrast !== undefined &&
                            contrast < 4.5;
                          const label = isGreek ? slot.labelEl : slot.label;
                          const description = isGreek
                            ? slot.descriptionEl
                            : slot.description;
                          const customized = isCustomized(slot.id);
                          const colorCustomized = isColorCustomized(slot.id);
                          const typographySupported =
                            (slot.tokenScopes?.length ?? 0) > 0;
                          const fontStyleOverrides =
                            themeOverrides[slot.id]?.fontStyles;
                          const fontStyles = resolvedFontStyles(slot.id);
                          const typographyCustomized =
                            fontStyleOverrides !== undefined;
                          return (
                            <Box
                              className={`${classes.colorRow} ${
                                advancedFormatting
                                  ? classes.colorRowAdvanced
                                  : ""
                              }`}
                              key={slot.id}
                            >
                              <Box className={classes.rowInfo}>
                                <Group gap={6} wrap="nowrap">
                                  <Text size="sm" fw={600} truncate>
                                    {label}
                                  </Text>
                                  {customized && (
                                    <Badge size="xs" variant="light">
                                      {t("settings.syntaxColors.modified")}
                                    </Badge>
                                  )}
                                  {hasLowContrast && (
                                    <Tooltip
                                      multiline
                                      maw={300}
                                      label={t(
                                        "settings.syntaxColors.contrastWarning",
                                        { ratio: contrast.toFixed(2) },
                                      )}
                                    >
                                      <ThemeIcon
                                        component="span"
                                        role="img"
                                        size={20}
                                        radius="xl"
                                        variant="light"
                                        color="orange"
                                        aria-label={t(
                                          "settings.syntaxColors.contrastWarning",
                                          { ratio: contrast.toFixed(2) },
                                        )}
                                      >
                                        <IconAlertTriangle size={12} />
                                      </ThemeIcon>
                                    </Tooltip>
                                  )}
                                </Group>
                                <Text size="xs" c="dimmed" lineClamp={2}>
                                  {description}
                                </Text>
                              </Box>
                              <Box
                                className={classes.sample}
                                title={slot.sample}
                                style={
                                  {
                                    "--sample-color": color,
                                    "--sample-background": backgroundColor,
                                    ...getPreviewTypography(slot.id),
                                  } as React.CSSProperties
                                }
                              >
                                {slot.sample}
                              </Box>
                              <SyntaxColorInput
                                slotId={slot.id}
                                label={label}
                                value={
                                  draftColors[draftKey(slot.id)] ??
                                  resolvedColor(slot.id)
                                }
                                swatches={swatches}
                                onDraftChange={handleColorDraftChange}
                                onCommit={handleColorChangeEnd}
                              />
                              {advancedFormatting && (
                                typographySupported ? (
                                  <Group
                                    gap={3}
                                    wrap="nowrap"
                                    justify="center"
                                    className={classes.formatControls}
                                  >
                                    {LATEX_SYNTAX_FONT_STYLES.map(
                                      (fontStyle) => {
                                        const explicit =
                                          fontStyleOverrides?.[fontStyle];
                                        const effective =
                                          fontStyles[fontStyle];
                                        const state =
                                          effective === "mixed"
                                            ? t(
                                                "settings.syntaxColors.styleMixed",
                                              )
                                            : effective
                                              ? t(
                                                  "settings.syntaxColors.styleOn",
                                                )
                                              : t(
                                                  "settings.syntaxColors.styleOff",
                                                );
                                        const tooltip = t(
                                          explicit === undefined
                                            ? "settings.syntaxColors.styleStateDefault"
                                            : "settings.syntaxColors.styleStateCustom",
                                          { state },
                                        );
                                        return (
                                          <Tooltip
                                            key={fontStyle}
                                            label={`${t(
                                              `settings.syntaxColors.${fontStyle}`,
                                            )} · ${tooltip}`}
                                          >
                                            <ActionIcon
                                              size="sm"
                                              variant={
                                                explicit === true
                                                  ? "filled"
                                                  : explicit === false
                                                    ? "outline"
                                                    : effective === true ||
                                                        effective === "mixed"
                                                      ? "light"
                                                      : "subtle"
                                              }
                                              color={
                                                explicit === false
                                                  ? "gray"
                                                  : undefined
                                              }
                                              data-explicit={
                                                explicit !== undefined ||
                                                undefined
                                              }
                                              data-mixed={
                                                effective === "mixed" ||
                                                undefined
                                              }
                                              aria-label={`${t(
                                                `settings.syntaxColors.${fontStyle}`,
                                              )}: ${tooltip}`}
                                              aria-pressed={
                                                effective === "mixed"
                                                  ? "mixed"
                                                  : effective
                                              }
                                              onClick={() =>
                                                handleToggleFontStyle(
                                                  slot.id,
                                                  fontStyle,
                                                )
                                              }
                                            >
                                              <span
                                                className={classes.styleGlyph}
                                                data-font-style={fontStyle}
                                              >
                                                {FONT_STYLE_GLYPHS[fontStyle]}
                                              </span>
                                            </ActionIcon>
                                          </Tooltip>
                                        );
                                      },
                                    )}
                                    <Tooltip
                                      label={t(
                                        "settings.syntaxColors.resetFormatting",
                                      )}
                                    >
                                      <ActionIcon
                                        size="sm"
                                        variant="subtle"
                                        color="gray"
                                        disabled={!typographyCustomized}
                                        aria-label={t(
                                          "settings.syntaxColors.resetFormatting",
                                        )}
                                        onClick={() =>
                                          handleResetFontStyles(slot.id)
                                        }
                                      >
                                        <IconRestore size={14} />
                                      </ActionIcon>
                                    </Tooltip>
                                  </Group>
                                ) : (
                                  <Text
                                    size="xs"
                                    c="dimmed"
                                    ta="center"
                                    className={classes.colorOnly}
                                  >
                                    {t("settings.syntaxColors.colorOnly")}
                                  </Text>
                                )
                              )}
                              <Tooltip label={t("settings.syntaxColors.resetColor")}>
                                <ActionIcon
                                  variant="subtle"
                                  color="gray"
                                  size="sm"
                                  aria-label={t("settings.syntaxColors.resetColor")}
                                  disabled={!colorCustomized}
                                  onClick={() => handleResetColor(slot.id)}
                                >
                                  <IconRestore size={15} />
                                </ActionIcon>
                              </Tooltip>
                            </Box>
                          );
                        })}
                      </Box>
                    </Accordion.Panel>
                  </Accordion.Item>
                );
              })}
            </Accordion>
          )}
        </Box>

        <Box className={classes.previewColumn}>
          <Paper withBorder radius="md" className={classes.previewCard}>
            <Group
              justify="space-between"
              align="flex-start"
              p="md"
              wrap="nowrap"
              className={classes.previewHeader}
            >
              <Box>
                <Group gap={6}>
                  <IconCode size={17} />
                  <Text size="sm" fw={650}>
                    {t("settings.syntaxColors.preview.title")}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" mt={3}>
                  {t("settings.syntaxColors.preview.description")}
                </Text>
              </Box>
              <Badge size="xs" variant="outline">
                {THEME_LABELS[selectedTheme]}
              </Badge>
            </Group>
            <Box
              className={classes.previewCode}
              style={
                {
                  "--preview-background": backgroundColor,
                  "--preview-foreground": plainTextColor,
                } as React.CSSProperties
              }
            >
              {renderPreviewLines(
                t("settings.syntaxColors.preview.document"),
                DOCUMENT_PREVIEW,
                1,
              )}
              {renderPreviewLines(
                t("settings.syntaxColors.preview.mathematics"),
                MATH_PREVIEW,
                6,
              )}
              {renderPreviewLines(
                t("settings.syntaxColors.preview.options"),
                OPTIONS_PREVIEW,
                11,
              )}
            </Box>
            <Group
              justify="space-between"
              p="sm"
              className={classes.previewLegend}
            >
              <Group gap={6}>
                <Box w={9} h={9} bg={backgroundColor} bdrs="xl" />
                <Text size="xs" c="dimmed">
                  {backgroundColor}
                </Text>
              </Group>
              <Text size="xs" c="dimmed">
                {t("settings.syntaxColors.customizedCount", {
                  count: customizedCount,
                })}
              </Text>
            </Group>
          </Paper>
        </Box>
      </Box>

      <Modal
        opened={pendingReset !== null}
        onClose={() => setPendingReset(null)}
        title={
          pendingReset === "all"
            ? t("settings.syntaxColors.confirm.titleAll")
            : t("settings.syntaxColors.confirm.titleTheme")
        }
        centered
        size="sm"
      >
        <Stack gap="lg">
          <Group align="flex-start" wrap="nowrap">
            <ThemeIcon variant="light" color="red" size="lg" radius="xl">
              <IconAlertTriangle size={20} />
            </ThemeIcon>
            <Text size="sm">
              {pendingReset === "all"
                ? t("settings.syntaxColors.confirm.bodyAll")
                : t("settings.syntaxColors.confirm.bodyTheme", {
                    theme: THEME_LABELS[selectedTheme],
                  })}
            </Text>
          </Group>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPendingReset(null)}>
              {t("settings.syntaxColors.confirm.cancel")}
            </Button>
            <Button color="red" onClick={confirmReset}>
              {pendingReset === "all"
                ? t("settings.syntaxColors.confirm.confirmAll")
                : t("settings.syntaxColors.confirm.confirmTheme")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};
