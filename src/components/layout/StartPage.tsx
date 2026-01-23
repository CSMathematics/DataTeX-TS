import React from "react";
import { useTranslation } from "react-i18next";
import {
  Container,
  Text,
  SimpleGrid,
  Card,
  Group,
  ThemeIcon,
  UnstyledButton,
  Stack,
  Divider,
  ScrollArea,
  Box,
  Badge,
  useComputedColorScheme,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileCirclePlus,
  faWandMagicSparkles,
  faChevronRight,
  faClock,
  faExternalLinkAlt,
  faDatabase,
  faFileSignature,
  faBoxOpen,
  faFolderOpen,
} from "@fortawesome/free-solid-svg-icons";
import { templates } from "../../services/templateService";

interface StartPageProps {
  onCreateEmpty: () => void;
  onOpenWizard: () => void;
  onCreateFromTemplate: (code: string) => void;
  recentProjects?: string[];
  onOpenRecent?: (path: string) => void;
  onOpenDatabase: () => void;
  onOpenExamGenerator: () => void;
  onOpenPackageBrowser: () => void;
  onOpenTemplateModal: () => void;
  onOpenFile?: () => void;
}

export const StartPage: React.FC<StartPageProps> = ({
  onCreateEmpty,
  onOpenWizard,
  onCreateFromTemplate,
  recentProjects = [],
  onOpenRecent,
  onOpenDatabase,
  onOpenExamGenerator,
  onOpenPackageBrowser,
  onOpenTemplateModal,
  onOpenFile,
}) => {
  const { t } = useTranslation();
  const colorScheme = useComputedColorScheme("dark", {
    getInitialValueInEffect: true,
  });

  const ActionCard = ({ icon, color, title, description, onClick }: any) => (
    <UnstyledButton onClick={onClick} style={{ width: "100%" }}>
      <Card
        shadow="sm"
        padding="lg"
        radius="md"
        withBorder
        bg="var(--mantine-color-default)"
        style={{
          transition: "transform 0.2s, border-color 0.2s",
          height: "100%",
          ":hover": {
            transform: "translateY(-2px)",
            borderColor: "var(--mantine-color-blue-6)",
          },
        }}
      >
        <Group align="start" wrap="nowrap">
          <ThemeIcon size={40} radius="md" variant="light" color={color}>
            <FontAwesomeIcon icon={icon} style={{ width: 24, height: 24 }} />
          </ThemeIcon>
          <Stack gap={4} style={{ flex: 1 }}>
            <Text size="md" fw={700}>
              {title}
            </Text>
            <Text size="xs" c="dimmed">
              {description}
            </Text>
          </Stack>
        </Group>
      </Card>
    </UnstyledButton>
  );

  const QuickLink = ({ title, url }: { title: string; url: string }) => (
    <UnstyledButton
      onClick={() => window.open(url, "_blank")}
      style={{ width: "100%" }}
    >
      <Group
        justify="space-between"
        px="sm"
        py="xs"
        style={{
          borderRadius: 8,
          transition: "0.2s",
          ":hover": { backgroundColor: "var(--mantine-color-default-hover)" },
        }}
      >
        <Group gap="xs">
          <ThemeIcon variant="transparent" size="sm" color="gray">
            <FontAwesomeIcon
              icon={faExternalLinkAlt}
              style={{ width: 14, height: 14 }}
            />
          </ThemeIcon>
          <Text size="sm" c="gray.3">
            {title}
          </Text>
        </Group>
        <FontAwesomeIcon
          icon={faChevronRight}
          style={{
            width: 14,
            height: 14,
            color: "var(--mantine-color-dimmed)",
          }}
        />
      </Group>
    </UnstyledButton>
  );

  return (
    <ScrollArea h="100%" bg="var(--app-bg)">
      <Container size="xl" py={50}>
        <Stack gap={40}>
          {/* Hero Section */}
          <Box
            style={{
              //   background: 'linear-gradient(45deg, var(--mantine-color-blue-9), var(--mantine-color-dark-8))',
              padding: "40px",
              borderRadius: "16px",
              //   border: "1px solid var(--mantine-color-dark-6)",
            }}
          >
            <Group align="flex-start" justify="center">
              <Box>
                <Group justify="center">
                  <img
                    src="./DatatexLogo.svg"
                    alt="DataTex Logo"
                    style={{
                      width: "100%",
                      height: 200,
                      opacity: colorScheme === "dark" ? 0.4 : 0.8,
                      filter: colorScheme === "dark" ? "none" : "invert(1)",
                      transition: "filter 0.3s ease, opacity 0.3s ease",
                    }}
                  />
                  <UnstyledButton
                    onClick={() =>
                      window.open(
                        "https://www.latex-project.org/help/documentation/",
                        "_blank",
                      )
                    }
                  >
                    <Badge
                      variant="gradient"
                      gradient={{ from: "blue", to: "cyan" }}
                      size="lg"
                      style={{ cursor: "pointer" }}
                    >
                      Documentation
                    </Badge>
                  </UnstyledButton>
                  <UnstyledButton
                    onClick={() => window.open("https://github.com/", "_blank")}
                  >
                    <Badge
                      variant="outline"
                      color="gray"
                      size="lg"
                      style={{ cursor: "pointer" }}
                    >
                      GitHub
                    </Badge>
                  </UnstyledButton>
                </Group>
              </Box>
              {/* <FontAwesomeIcon icon={faWandMagicSparkles} style={{ width: 120, height: 120, opacity: 0.1, color: 'white' }} /> */}
            </Group>
          </Box>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="xl">
            {/* Main Actions - Takes up 2 columns on medium screens */}
            <Stack gap="lg" style={{ gridColumn: "span 2" }}>
              <Text
                fw={700}
                c="dimmed"
                size="sm"
                tt="uppercase"
                style={{ letterSpacing: 1 }}
              >
                {t("startPage.getStarted")}
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                <ActionCard
                  icon={faFileCirclePlus}
                  color="gray"
                  title={t("startPage.emptyFile")}
                  description={t("startPage.emptyFileDesc")}
                  onClick={onCreateEmpty}
                />
                <ActionCard
                  icon={faFolderOpen}
                  color="blue"
                  title={t("startPage.openExisting")}
                  description={t("startPage.openExistingDesc")}
                  onClick={onOpenFile}
                />
                <ActionCard
                  icon={faWandMagicSparkles}
                  color="violet"
                  title="Preamble Wizard"
                  description={t("startPage.preambleWizardDesc")}
                  onClick={onOpenWizard}
                />
              </SimpleGrid>

              <Text
                fw={700}
                c="dimmed"
                size="sm"
                tt="uppercase"
                mt="md"
                style={{ letterSpacing: 1 }}
              >
                {t("startPage.databaseTools")}
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                <ActionCard
                  icon={faFileSignature}
                  color="teal"
                  title={t("startPage.examGenerator")}
                  description={t("startPage.examGeneratorDesc")}
                  onClick={onOpenExamGenerator}
                />
                <ActionCard
                  icon={faDatabase}
                  color="cyan"
                  title={t("startPage.browseDatabase")}
                  description={t("startPage.browseDatabaseDesc")}
                  onClick={onOpenDatabase}
                />
                <ActionCard
                  icon={faBoxOpen}
                  color="indigo"
                  title={t("startPage.packageBrowser")}
                  description={t("startPage.packageBrowserDesc")}
                  onClick={onOpenPackageBrowser}
                />
              </SimpleGrid>

              <Divider
                label={t("startPage.recentProjects")}
                labelPosition="left"
                my="xs"
              />

              {recentProjects.length > 0 ? (
                <Card withBorder bg="var(--mantine-color-default)" p={0}>
                  <Stack gap={0}>
                    {recentProjects.map((path, idx) => (
                      <UnstyledButton
                        key={idx}
                        onClick={() => onOpenRecent && onOpenRecent(path)}
                        p="md"
                        style={{
                          borderBottom:
                            idx < recentProjects.length - 1
                              ? "1px solid var(--mantine-color-default-border)"
                              : "none",
                          transition: "background-color 0.2s",
                          ":hover": {
                            backgroundColor:
                              "var(--mantine-color-default-hover)",
                          },
                        }}
                      >
                        <Group>
                          <ThemeIcon color="yellow" variant="light" size="lg">
                            <FontAwesomeIcon
                              icon={faClock}
                              style={{ width: 18, height: 18 }}
                            />
                          </ThemeIcon>
                          <Box style={{ flex: 1, overflow: "hidden" }}>
                            <Text size="sm" fw={500} truncate>
                              {path.split(/[/\\]/).pop()}
                            </Text>
                            <Text size="xs" c="dimmed" truncate>
                              {path}
                            </Text>
                          </Box>
                          <FontAwesomeIcon
                            icon={faChevronRight}
                            style={{ width: 16, height: 16, color: "gray" }}
                          />
                        </Group>
                      </UnstyledButton>
                    ))}
                  </Stack>
                </Card>
              ) : (
                <Text c="dimmed" fs="italic" size="sm">
                  {t("startPage.noRecentProjects")}
                </Text>
              )}
            </Stack>

            {/* Sidebar Column - Quick Links & Templates */}
            <Stack gap="lg">
              <Text
                fw={700}
                c="dimmed"
                size="sm"
                tt="uppercase"
                style={{ letterSpacing: 1 }}
              >
                {t("startPage.quickResources")}
              </Text>
              <Card withBorder bg="var(--mantine-color-default)" padding="sm">
                <Stack gap={4}>
                  <QuickLink
                    title={t("startPage.latexCheatsheet")}
                    url="https://wch.github.io/latexsheet/latexsheet.pdf"
                  />
                  <QuickLink
                    title={t("startPage.ctanSearch")}
                    url="https://ctan.org/"
                  />
                  <QuickLink
                    title={t("startPage.detexify")}
                    url="https://detexify.kirelabs.org/classify.html"
                  />
                  <QuickLink
                    title={t("startPage.tikzExamples")}
                    url="https://texample.net/tikz/examples/"
                  />
                </Stack>
              </Card>

              <Text
                fw={700}
                c="dimmed"
                size="sm"
                tt="uppercase"
                mt="md"
                style={{ letterSpacing: 1 }}
              >
                {t("startPage.templates")}
              </Text>
              <Stack gap="xs">
                {templates.slice(0, 3).map((tmpl) => (
                  <UnstyledButton
                    key={tmpl.id}
                    onClick={() => onCreateFromTemplate(tmpl.content)}
                  >
                    <Card
                      withBorder
                      padding="xs"
                      bg="var(--mantine-color-default)"
                      style={{
                        transition: "0.2s",
                        ":hover": {
                          borderColor: "var(--mantine-color-blue-6)",
                        },
                      }}
                    >
                      <Group justify="space-between" mb={4}>
                        <Text fw={600} size="xs" c="gray.3">
                          {tmpl.name}
                        </Text>
                        <Badge size="xs" variant="outline">
                          {tmpl.id}
                        </Badge>
                      </Group>
                      <Text c="dimmed" size="xs" lineClamp={1}>
                        {tmpl.description}
                      </Text>
                    </Card>
                  </UnstyledButton>
                ))}
                <UnstyledButton
                  onClick={onOpenTemplateModal}
                  style={{ textAlign: "center" }}
                >
                  <Text size="xs" c="blue" td="underline">
                    {t("startPage.viewAllTemplates")}
                  </Text>
                </UnstyledButton>
              </Stack>
            </Stack>
          </SimpleGrid>
        </Stack>
      </Container>
    </ScrollArea>
  );
};
