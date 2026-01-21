import React, { useState, useRef, useEffect } from "react";
import {
  Stack,
  TextInput,
  ActionIcon,
  Paper,
  Text,
  Group,
  ScrollArea,
  Code,
  Button,
  Avatar,
  Box,
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
} from "@tabler/icons-react";
import { currentProvider } from "../../services/aiService";
import { Message, useAIStore } from "../../stores/aiStore";

interface ChatPanelProps {
  onInsertCode: (code: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ onInsertCode }) => {
  const { messages, addMessage, deleteMessage, clearMessages } = useAIStore();

  // Initialize ONLY if empty (and avoid doing it in render to prevent loops, though persist handles it)
  // Actually, persist middleware handles hydration, so we just use what's there.
  // We can add a welcome message via useEffect if length is 0.
  useEffect(() => {
    if (messages.length === 0) {
      addMessage({
        role: "assistant",
        content:
          "Hello! I am your AI LaTeX Assistant. How can I help you today?",
      });
    }
  }, []); // Run once on mount
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (viewport.current) {
      viewport.current.scrollTo({
        top: viewport.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  useEffect(scrollToBottom, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { role: "user", content: input };
    addMessage(userMsg);
    setInput("");
    setLoading(true);

    try {
      // Pass current history + new message to provider
      const response = await currentProvider.chat([...messages, userMsg]);
      addMessage({ role: "assistant", content: response });
    } catch (e: any) {
      addMessage({
        role: "assistant",
        content: `Error: ${e.message || "Failed to get response from AI."}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Stack gap={0} h="100%" style={{ position: "relative" }}>
      <ScrollArea viewportRef={viewport} style={{ flex: 1 }} p="md">
        <Stack gap="md">
          {/* Header Actions (Clear) could go in a header bar, but here is okay for now or floating */}
          {messages.length > 2 && (
            <Group justify="center">
              <Button
                variant="subtle"
                size="xs"
                color="gray"
                leftSection={<IconTrash size={12} />}
                onClick={clearMessages}
              >
                Clear Chat
              </Button>
            </Group>
          )}

          {messages.map((msg, idx) => (
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
                          const { children, className, node, ...rest } = props;
                          const match = /language-(\w+)/.exec(className || "");
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
                                      onClick={() => onInsertCode(codeContent)}
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
                            <Text mb="xs" style={{ lineHeight: 1.5 }} size="xs">
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
          {loading && (
            <Group align="flex-start" gap="xs">
              <Avatar color="blue" radius="lg" size="sm">
                <IconSparkles2 stroke={2} size={16} />
              </Avatar>
              <Paper p="xs" radius="md" bg="var(--mantine-color-default-hover)">
                <Text size="xs" c="dimmed">
                  Typing...
                </Text>
              </Paper>
            </Group>
          )}
        </Stack>
      </ScrollArea>

      {/* Input Area */}
      <Box
        p="sm"
        style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
      >
        <TextInput
          placeholder="Ask AI to create something..."
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          rightSection={
            <ActionIcon
              onClick={handleSend}
              disabled={loading || !input.trim()}
              variant="transparent"
              color="blue"
            >
              <FontAwesomeIcon icon={faPaperPlane} />
            </ActionIcon>
          }
        />
        <Text size="xs" c="dimmed" mt={4} ta="center" style={{ fontSize: 10 }}>
          AI can make mistakes. Check generated code.
        </Text>
      </Box>
    </Stack>
  );
};
