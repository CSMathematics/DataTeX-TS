import React, { useState, useRef, useEffect } from "react";
import {
  Stack,
  Textarea,
  Select,
  ActionIcon,
  Paper,
  Text,
  Group,
  ScrollArea,
  Code,
  Button,
  Avatar,
  Box,
  Tooltip,
  Drawer,
  Title,
} from "@mantine/core";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane, faUser } from "@fortawesome/free-solid-svg-icons";
import {
  IconSparkles2,
  IconTrash,
  IconCopy,
  IconCheck,
  IconHistory,
  IconPlus,
} from "@tabler/icons-react";
import {
  currentProvider,
  generateConversationTitle,
} from "../../services/aiService";
import { Message, useAIStore } from "../../stores/aiStore";
import { ConversationList } from "./ConversationList";

interface ChatPanelProps {
  onInsertCode: (code: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ onInsertCode }) => {
  const {
    conversations,
    activeConversationId,
    addMessage,
    deleteMessage,
    clearMessages,
    provider,
    setProvider,
    openaiModel,
    setOpenAIModel,
    geminiModel,
    setGeminiModel,
    ollamaModel,
    setOllamaModel,
    createConversation, // Ensure we can create one if needed
    updateConversationTitle,
  } = useAIStore();

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId,
  );
  const activeMessages = activeConversation ? activeConversation.messages : [];

  // Model Options
  const modelOptions = [
    {
      group: "Gemini",
      items: [
        { value: "gemini:gemini-2.5-flash", label: "Gemini 2.5 Flash" },
        { value: "gemini:gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      ],
    },
    {
      group: "OpenAI",
      items: [
        { value: "openai:gpt-4o", label: "GPT-4o" },
        { value: "openai:gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
      ],
    },
    {
      group: "Ollama",
      items: [
        { value: "ollama:llama3", label: "Llama 3" },
        { value: "ollama:mistral", label: "Mistral" },
      ],
    },
  ];

  const currentModelValue = `${provider}:${
    provider === "openai"
      ? openaiModel
      : provider === "gemini"
        ? geminiModel
        : provider === "ollama"
          ? ollamaModel
          : ""
  }`;

  const handleModelChange = (val: string | null) => {
    if (!val) return;
    const [newProvider, newModel] = val.split(":");
    setProvider(newProvider as any);
    if (newProvider === "openai") setOpenAIModel(newModel);
    if (newProvider === "gemini") setGeminiModel(newModel);
    if (newProvider === "ollama") setOllamaModel(newModel);
  };

  // Initialize ONLY if absolutely no conversations exist
  useEffect(() => {
    if (conversations.length === 0) {
      createConversation();
    }
  }, [conversations.length, createConversation]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [thoughts, setThoughts] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);

  const handleClear = () => {
    clearMessages();
    setThoughts([]);
  };

  // Listen for Agent Thoughts & Observations
  useEffect(() => {
    let unlistenThought: () => void;
    let unlistenObservation: () => void;

    import("@tauri-apps/api/event").then(async ({ listen }) => {
      unlistenThought = await listen("agent-thought", (event: any) => {
        setThoughts((prev) => [...prev, `🤔 ${event.payload}`]);
      });
      unlistenObservation = await listen("agent-observation", (event: any) => {
        // Truncate observation to avoid UI lag
        let obs = event.payload;
        if (obs.length > 200) obs = obs.substring(0, 200) + "...";
        setThoughts((prev) => [...prev, `👁️ ${obs}`]);
      });
    });

    return () => {
      if (unlistenThought) unlistenThought();
      if (unlistenObservation) unlistenObservation();
    };
  }, []);

  const scrollToBottom = () => {
    if (viewport.current) {
      viewport.current.scrollTo({
        top: viewport.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  useEffect(scrollToBottom, [activeMessages, loading, thoughts]);

  const handleSend = async () => {
    if (!input.trim()) return;

    // Ensure we have an active conversation
    if (!activeConversationId) {
      createConversation();
    }

    const userMsg: Message = { role: "user", content: input };
    addMessage(userMsg);
    setInput("");
    setThoughts([]); // Clear previous thoughts
    setLoading(true);

    try {
      // Pass current active history + new message to provider
      const response = await currentProvider.chat([...activeMessages, userMsg]);
      addMessage({ role: "assistant", content: response });

      // Auto-generate title for new conversations
      if (activeMessages.length === 0 && activeConversationId) {
        // Create the full context for the title generator
        const fullContext = [
          ...activeMessages,
          userMsg,
          { role: "assistant" as const, content: response },
        ];
        generateConversationTitle(fullContext).then((title) => {
          if (title && title !== "New Chat") {
            updateConversationTitle(activeConversationId, title);
          }
        });
      }
    } catch (e: any) {
      addMessage({
        role: "assistant",
        content: `Error: ${e.message || "Failed to get response from AI."}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    createConversation();
  };

  return (
    <>
      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Conversations"
        padding="md"
        size="xs"
        position="left"
        withCloseButton
        overlayProps={{ backgroundOpacity: 0.5, blur: 4 }}
      >
        <ConversationList onClose={() => setDrawerOpen(false)} />
      </Drawer>

      <Stack gap={0} h="100%" style={{ position: "relative" }}>
        {/* Header Bar */}
        <Group
          px="md"
          py="xs"
          justify="space-between"
          style={{
            borderBottom: "1px solid var(--mantine-color-default-border)",
            backgroundColor: "var(--mantine-color-body)",
          }}
        >
          <Group gap="2px">
            <Tooltip label="View History">
              <ActionIcon
                variant="subtle"
                color="gray.5"
                size="xs"
                onClick={() => setDrawerOpen(true)}
              >
                <IconHistory size={16} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="New Chat">
              <ActionIcon
                variant="subtle"
                color="gray.5"
                size="xs"
                onClick={handleNewChat}
              >
                <IconPlus size={16} />
              </ActionIcon>
            </Tooltip>

            <Text fw={400} size="xs" truncate style={{ maxWidth: 150 }}>
              {activeConversation?.title || "New Chat"}
            </Text>
          </Group>
          <Tooltip label="Clear chat & history">
            <ActionIcon variant="subtle" size="xs" onClick={handleClear}>
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <ScrollArea viewportRef={viewport} style={{ flex: 1 }} p="md">
          <Stack gap="md">
            {/* Messages */}

            {activeMessages.map((msg, idx) => (
              <Group
                key={idx}
                align="flex-start"
                justify={msg.role === "user" ? "flex-end" : "flex-start"}
                gap="xs"
              >
                {msg.role === "assistant" && (
                  <Avatar color="blue" radius="lg" size="sm">
                    <IconSparkles2 stroke={2} size={16} />
                  </Avatar>
                )}

                <Stack gap={4} style={{ maxWidth: "85%", flex: 1 }}>
                  <Paper
                    p="sm"
                    radius="md"
                    bg={
                      msg.role === "user"
                        ? "color-mix(in srgb, var(--mantine-color-blue-9), transparent 80%)"
                        : "color-mix(in srgb, var(--mantine-color-default-hover), transparent 50%)"
                    }
                    withBorder={true}
                    c={msg.role === "user" ? "white" : undefined}
                    style={{ fontSize: "0.9rem" }}
                  >
                    {msg.role === "user" ? (
                      <Text style={{ whiteSpace: "pre-wrap" }} size="xs">
                        {msg.content}
                      </Text>
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          code(props) {
                            const { children, className, node, ...rest } =
                              props;
                            const match = /language-(\w+)/.exec(
                              className || "",
                            );
                            const codeContent = String(children).replace(
                              /\n$/,
                              "",
                            );
                            const [copied, setCopied] = useState(false);

                            const handleCopyCode = () => {
                              navigator.clipboard.writeText(codeContent);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            };

                            // If it's a block code (has newline) or explicitly latex
                            if (match || String(children).includes("\n")) {
                              return (
                                <Paper
                                  withBorder
                                  p="xs"
                                  my="xs"
                                  bg="dark.8"
                                  style={{ overflowX: "auto" }}
                                >
                                  <Group justify="space-between" mb={4}>
                                    <Text size="xs" c="dimmed">
                                      {match ? match[1].toUpperCase() : "CODE"}
                                    </Text>
                                    <Group gap={4}>
                                      <ActionIcon
                                        size="sm"
                                        variant="subtle"
                                        color={copied ? "teal" : "gray"}
                                        onClick={handleCopyCode}
                                        title="Copy code"
                                      >
                                        {copied ? (
                                          <IconCheck size={14} />
                                        ) : (
                                          <IconCopy size={14} />
                                        )}
                                      </ActionIcon>
                                      <Button
                                        size="compact-xs"
                                        variant="light"
                                        onClick={() =>
                                          onInsertCode(codeContent)
                                        }
                                      >
                                        Insert
                                      </Button>
                                    </Group>
                                  </Group>
                                  <Code
                                    block
                                    style={{ whiteSpace: "pre-wrap" }}
                                    color="dark"
                                  >
                                    {children}
                                  </Code>
                                </Paper>
                              );
                            }
                            return (
                              <Code className={className} {...rest}>
                                {children}
                              </Code>
                            );
                          },
                          p({ children }) {
                            return (
                              <Text
                                mb="xs"
                                style={{ lineHeight: 1.5 }}
                                size="xs"
                              >
                                {children}
                              </Text>
                            );
                          },
                          ul({ children }) {
                            return (
                              <Box component="ul" pl="md" my="xs">
                                {children}
                              </Box>
                            );
                          },
                          ol({ children }) {
                            return (
                              <Box component="ol" pl="md" my="xs">
                                {children}
                              </Box>
                            );
                          },
                          li({ children }) {
                            return (
                              <Box component="li" mb={4}>
                                <Text size="xs" span>
                                  {children}
                                </Text>
                              </Box>
                            );
                          },
                          h1({ children }) {
                            return (
                              <Title order={4} my="sm">
                                {children}
                              </Title>
                            );
                          },
                          h2({ children }) {
                            return (
                              <Title order={5} my="sm">
                                {children}
                              </Title>
                            );
                          },
                          h3({ children }) {
                            return (
                              <Title order={6} my="xs">
                                {children}
                              </Title>
                            );
                          },
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </Paper>

                  <Group
                    gap={2}
                    justify={msg.role === "user" ? "flex-end" : "flex-start"}
                    style={{ opacity: 0.5 }}
                  >
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="gray"
                      onClick={() => navigator.clipboard.writeText(msg.content)}
                      title="Copy message"
                    >
                      <IconCopy size={12} />
                    </ActionIcon>
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="red"
                      onClick={() => deleteMessage(idx)}
                      title="Delete message"
                    >
                      <IconTrash size={12} />
                    </ActionIcon>
                  </Group>
                </Stack>

                {msg.role === "user" && (
                  <Avatar color="gray" radius="lg" size="sm">
                    <FontAwesomeIcon icon={faUser} size="xs" />
                  </Avatar>
                )}
              </Group>
            ))}
            {thoughts.length > 0 && (
              <Paper
                p="xs"
                bg="dark.8"
                mb="sm"
                style={{
                  borderLeft: "2px solid var(--mantine-primary-color-filled)",
                }}
              >
                <Text size="xs" fw={700} c="dimmed" mb={4}>
                  Agent Process
                </Text>
                <ScrollArea.Autosize mah={150} type="always" offsetScrollbars>
                  <Code
                    block
                    color="dark"
                    style={{
                      fontSize: "0.75rem",
                      whiteSpace: "pre-wrap",
                      backgroundColor: "transparent",
                    }}
                  >
                    {thoughts.join("\n")}
                  </Code>
                </ScrollArea.Autosize>
              </Paper>
            )}

            {loading && (
              <Group align="flex-start" gap="xs">
                <Avatar color="blue" radius="lg" size="sm">
                  <IconSparkles2 stroke={2} size={16} />
                </Avatar>
                <Paper
                  p="xs"
                  radius="md"
                  bg="var(--mantine-color-default-hover)"
                >
                  <Text size="xs" c="dimmed">
                    Typing...
                  </Text>
                </Paper>
              </Group>
            )}
          </Stack>
        </ScrollArea>

        {/* Input Area */}
        <Paper
          p="sm"
          radius={0}
          bg="var(--mantine-color-body)"
          style={{
            borderTop: "1px solid var(--mantine-color-default-border)",
          }}
        >
          <Textarea
            placeholder="Ask AI to create something..."
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            autosize
            minRows={1}
            maxRows={8}
            size="sm"
            variant="filled"
            radius="md"
            styles={{
              input: {
                fontSize: "0.85rem",
              },
            }}
          />
          <Group mt="xs" justify="space-between" align="center">
            <Select
              size="xs"
              variant="filled"
              radius="md"
              value={currentModelValue}
              onChange={handleModelChange}
              data={modelOptions}
              allowDeselect={false}
              checkIconPosition="right"
              style={{ flex: 1, maxWidth: 200 }}
            />

            <Button
              size="xs"
              variant="light"
              radius="md"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              rightSection={<FontAwesomeIcon icon={faPaperPlane} />}
            >
              Send
            </Button>
          </Group>

          <Text
            size="xs"
            c="dimmed"
            mt={4}
            ta="center"
            style={{ fontSize: 9, opacity: 0.7 }}
          >
            AI can make mistakes. Check generated code.
          </Text>
        </Paper>
      </Stack>
    </>
  );
};
