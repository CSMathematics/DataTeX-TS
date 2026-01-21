import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Stack,
  ActionIcon,
  Title,
  Select,
  PasswordInput,
  TextInput,
  Button,
  Group,
  Text,
  Autocomplete,
  Box,
  Divider,
} from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { currentProvider } from "../../services/aiService";
import { ChatPanel } from "./ChatPanel";
import { AgentEditor } from "./AgentEditor";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCog, faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { useAIStore, AIProviderId } from "../../stores/aiStore";
import { Agent } from "../../services/agentService";

interface AISidebarProps {
  onInsertCode: (code: string) => void;
  onClose: () => void;
}

export const AISidebar: React.FC<AISidebarProps> = ({
  onInsertCode,
  // onClose,
}) => {
  const { t } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  // Store hooks
  const {
    provider,
    setProvider,
    openaiKey,
    setOpenAIKey,
    openaiModel,
    setOpenAIModel,
    geminiKey,
    setGeminiKey,
    geminiModel,
    setGeminiModel,
    ollamaUrl,
    setOllamaUrl,
    ollamaModel,
    setOllamaModel,
    agents,
    builtInAgents,
    deleteAgent,
    activeAgentId,
    setActiveAgent,
  } = useAIStore();

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const handleFetchModels = async () => {
    setLoadingModels(true);
    setAvailableModels([]);
    try {
      if (currentProvider.getModels) {
        const models = await currentProvider.getModels();
        if (models && models.length > 0) {
          setAvailableModels(models);
        } else {
          console.warn("No models found");
        }
      }
    } catch (e) {
      console.error("Failed to fetch models", e);
    } finally {
      setLoadingModels(false);
    }
  };

  const renderModelSelection = (
    currentModel: string,
    setModel: (val: string) => void,
    placeholder: string,
  ) => (
    <Group align="flex-end" gap="xs">
      <Autocomplete
        style={{ flex: 1 }}
        label={t("ai.model")}
        placeholder={placeholder}
        data={availableModels.length > 0 ? availableModels : [currentModel]}
        value={currentModel}
        onChange={(val) => setModel(val || "")}
        maxDropdownHeight={300}
      />
      <Button
        variant="light"
        onClick={handleFetchModels}
        loading={loadingModels}
        title={t("ai.fetchModelsTooltip")}
      >
        {t("ai.fetch")}
      </Button>
    </Group>
  );

  return (
    <>
      <AgentEditor
        opened={editorOpen}
        onClose={() => setEditorOpen(false)}
        agentToEdit={editingAgent}
      />

      {showSettings ? (
        <Stack gap="md" p="md" h="100%" style={{ overflowY: "auto" }}>
          <Group>
            <ActionIcon variant="subtle" onClick={() => setShowSettings(false)}>
              <FontAwesomeIcon icon={faArrowLeft} />
            </ActionIcon>
            <Title order={5}>{t("ai.settings.title")}</Title>
          </Group>

          <Select
            label={t("ai.settings.provider")}
            data={[
              { value: "mock", label: t("ai.provider.mock") },
              { value: "openai", label: t("ai.provider.openai") },
              { value: "gemini", label: t("ai.provider.gemini") },
              { value: "ollama", label: t("ai.provider.ollama") },
            ]}
            value={provider}
            onChange={(val) => {
              setProvider(val as AIProviderId);
              setAvailableModels([]); // Reset models on provider change
            }}
          />

          {provider === "openai" && (
            <>
              <PasswordInput
                label={t("ai.settings.openaiKey")}
                placeholder="sk-..."
                value={openaiKey}
                onChange={(e) => setOpenAIKey(e.currentTarget.value)}
              />
              {renderModelSelection(openaiModel, setOpenAIModel, "gpt-4o")}
            </>
          )}

          {provider === "gemini" && (
            <>
              <PasswordInput
                label={t("ai.settings.geminiKey")}
                placeholder="AIza..."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.currentTarget.value)}
              />
              {renderModelSelection(
                geminiModel,
                setGeminiModel,
                "gemini-1.5-flash",
              )}
            </>
          )}

          {provider === "ollama" && (
            <>
              <TextInput
                label={t("ai.settings.ollamaUrl")}
                placeholder="http://localhost:11434"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.currentTarget.value)}
              />
              {renderModelSelection(ollamaModel, setOllamaModel, "llama3")}
            </>
          )}

          <Divider my="md" labelPosition="center" />

          <Title order={6} size="sm" c="dimmed" mb="xs">
            {t("ai.settings.builtInAgents", "Built-in Agents")}
          </Title>
          <Stack gap="xs" mb="md">
            {builtInAgents.map((agent) => (
              <Group key={agent.id} justify="space-between">
                <Box>
                  <Text size="sm" fw={500}>
                    {agent.name}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {agent.description}
                  </Text>
                </Box>
                <Group gap={4}>{/* Built-in agents are read-only */}</Group>
              </Group>
            ))}
          </Stack>

          <Title order={6} size="sm" c="dimmed" mb="xs">
            {t("ai.settings.customAgents", "Custom Agents")}
          </Title>

          <Stack gap="xs">
            {agents.map((agent) => (
              <Group key={agent.id} justify="space-between">
                <Box>
                  <Text size="sm" fw={500}>
                    {agent.name}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {agent.description}
                  </Text>
                </Box>
                <Group gap={4}>
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    onClick={() => {
                      setEditingAgent(agent);
                      setEditorOpen(true);
                    }}
                  >
                    <FontAwesomeIcon icon={faCog} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => deleteAgent(agent.id)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              </Group>
            ))}
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                setEditingAgent(null);
                setEditorOpen(true);
              }}
            >
              {t("ai.settings.createNewAgent")}
            </Button>
          </Stack>

          <Text size="xs" c="dimmed" mt="auto">
            {t("ai.settings.disclaimer")}
          </Text>
        </Stack>
      ) : (
        <Stack gap={0} h="100%">
          {/* Header */}
          <Box
            p="xs"
            style={{
              borderBottom: "1px solid var(--mantine-color-default-border)",
            }}
          >
            <Group justify="space-between" mb="xs">
              <Title order={5}>{t("ai.assistantTitle")}</Title>
              <ActionIcon
                variant="light"
                size="sm"
                onClick={() => setShowSettings(true)}
                title={t("ai.settings.title")}
              >
                <FontAwesomeIcon icon={faCog} />
              </ActionIcon>
            </Group>

            <Select
              data={[
                { value: "standard", label: t("ai.standardAssistant") },
                ...builtInAgents.map((a) => ({
                  value: a.id,
                  label: `${t("ai.agentPrefix")} ${a.name}`,
                })),
                ...agents.map((a) => ({
                  value: a.id,
                  label: `${t("ai.agentPrefix")} ${a.name}`,
                })),
              ]}
              value={activeAgentId || "standard"}
              onChange={(val) =>
                setActiveAgent(val === "standard" ? null : val)
              }
              allowDeselect={false}
              size="xs"
            />
          </Box>

          {/* Content */}
          <Box style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            <ChatPanel onInsertCode={onInsertCode} />
          </Box>
        </Stack>
      )}
    </>
  );
};
