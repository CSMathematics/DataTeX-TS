import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faBookOpen,
  faBoxOpen,
  faCode,
  faDatabase,
  faFileLines,
  faImage,
  faLayerGroup,
  faMagnifyingGlass,
  faSquareRootAlt,
  faTable,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { useTranslation } from "react-i18next";
import {
  listPackageBuilders,
  type BuilderCategory,
  type BuilderDescriptor,
} from "../../services/packageStudioService";

interface PackageStudioSidebarPanelProps {
  activeBuilderId?: string | null;
  onOpenWorkspace: (builderId?: string) => void;
  onOpenLegacyBrowser: () => void;
}

type CategoryMeta = {
  label: string;
  color: string;
  icon: IconDefinition;
};

const CATEGORY_META: Record<BuilderCategory, CategoryMeta> = {
  layout: { label: "Layout", color: "indigo", icon: faLayerGroup },
  code: { label: "Code", color: "violet", icon: faCode },
  tables: { label: "Tables", color: "cyan", icon: faTable },
  math: { label: "Math", color: "teal", icon: faSquareRootAlt },
  graphics: { label: "Graphics", color: "orange", icon: faImage },
  bibliography: { label: "Bibliography", color: "blue", icon: faBookOpen },
  document: { label: "Document", color: "gray", icon: faFileLines },
};

export const PackageStudioSidebarPanel: React.FC<
  PackageStudioSidebarPanelProps
> = ({ activeBuilderId, onOpenWorkspace, onOpenLegacyBrowser }) => {
  const { t } = useTranslation();
  const [builders, setBuilders] = useState<BuilderDescriptor[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadBuilders = async () => {
      setLoading(true);
      setError(null);
      try {
        const loaded = await listPackageBuilders();
        if (mounted) setBuilders(loaded);
      } catch (caught) {
        if (!mounted) return;
        console.error("Failed to load package builders:", caught);
        setError(String(caught));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadBuilders();

    return () => {
      mounted = false;
    };
  }, []);

  const filteredBuilders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return builders;

    return builders.filter((builder) =>
      [
        builder.displayName,
        builder.id,
        builder.category,
        builder.description,
        builder.packageIds.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [builders, query]);

  const nativeCount = builders.filter(
    (builder) => builder.supportLevel === "nativeEditable",
  ).length;

  return (
    <Stack h="100%" gap="sm" p="xs" style={{ overflow: "hidden" }}>
      <Card withBorder p="sm" radius="md">
        <Stack gap="xs">
          <Group justify="space-between" gap="xs" wrap="nowrap">
            <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
              <ThemeIcon size="sm" radius="sm" variant="light" color="blue">
                <FontAwesomeIcon icon={faWandMagicSparkles} />
              </ThemeIcon>
              <Box style={{ minWidth: 0 }}>
                <Text size="sm" fw={700} truncate>
                  {t("packageStudio.sidebar.title", {
                    defaultValue: "Package Studio",
                  })}
                </Text>
                <Text size="xs" c="dimmed" truncate>
                  {t("packageStudio.sidebar.subtitle", {
                    defaultValue: "Native package builders",
                  })}
                </Text>
              </Box>
            </Group>
            <Badge size="xs" variant="light" color="blue">
              {builders.length}
            </Badge>
          </Group>

          <Group gap={6}>
            <Badge size="xs" variant="light" color="teal">
              {nativeCount} native
            </Badge>
            <Badge size="xs" variant="outline" color="gray">
              Rust registry
            </Badge>
          </Group>

          <Button
            size="xs"
            variant="light"
            fullWidth
            leftSection={<FontAwesomeIcon icon={faBoxOpen} />}
            onClick={() => onOpenWorkspace()}
          >
            {t("packageStudio.sidebar.openStudio", {
              defaultValue: "Open Studio",
            })}
          </Button>
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            fullWidth
            leftSection={<FontAwesomeIcon icon={faDatabase} />}
            onClick={onOpenLegacyBrowser}
          >
            {t("packageStudio.sidebar.openCtan", {
              defaultValue: "CTAN browser",
            })}
          </Button>
        </Stack>
      </Card>

      <TextInput
        size="xs"
        leftSection={<FontAwesomeIcon icon={faMagnifyingGlass} />}
        placeholder={t("packageStudio.searchBuilders", {
          defaultValue: "Search builders...",
        })}
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
      />

      <Divider />

      {loading ? (
        <Group justify="center" py="lg">
          <Loader size="sm" />
        </Group>
      ) : error ? (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      ) : (
        <ScrollArea type="auto" style={{ flex: 1, minHeight: 0 }}>
          <Stack gap={6}>
            {filteredBuilders.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" py="md">
                {t("packageStudio.noBuilders", {
                  defaultValue: "No builders match the current search.",
                })}
              </Text>
            ) : (
              filteredBuilders.map((builder) => {
                const meta = CATEGORY_META[builder.category];
                return (
                  <Card
                    key={builder.id}
                    withBorder
                    p="xs"
                    radius="md"
                    component="button"
                    type="button"
                    aria-current={builder.id === activeBuilderId ? "page" : undefined}
                    style={{
                      cursor: "pointer",
                      width: "100%",
                      textAlign: "left",
                      background:
                        builder.id === activeBuilderId
                          ? "var(--mantine-color-blue-light)"
                          : undefined,
                    }}
                    onClick={() => onOpenWorkspace(builder.id)}
                  >
                    <Group gap="xs" wrap="nowrap" align="flex-start">
                      <ThemeIcon
                        size="sm"
                        radius="sm"
                        variant="light"
                        color={meta.color}
                        style={{ flexShrink: 0 }}
                      >
                        <FontAwesomeIcon icon={meta.icon} />
                      </ThemeIcon>
                      <Box style={{ minWidth: 0, flex: 1 }}>
                        <Text size="sm" fw={700} truncate>
                          {builder.displayName}
                        </Text>
                        <Text size="xs" c="dimmed" truncate>
                          {builder.packageIds.join(", ")}
                        </Text>
                      </Box>
                    </Group>
                  </Card>
                );
              })
            )}
          </Stack>
        </ScrollArea>
      )}
    </Stack>
  );
};
