import React from "react";
import {
  Stack,
  Text,
  Group,
  ActionIcon,
  ScrollArea,
  Button,
  Paper,
} from "@mantine/core";
import { IconPlus, IconTrash, IconMessage } from "@tabler/icons-react";
import { useAIStore } from "../../stores/aiStore";
import { formatDistanceToNow } from "date-fns";

interface ConversationListProps {
  onClose?: () => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  onClose,
}) => {
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    deleteConversation,
    createConversation,
  } = useAIStore();

  const handleCreate = () => {
    createConversation();
    if (onClose) onClose();
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteConversation(id);
  };

  const handleSelect = (id: string) => {
    setActiveConversation(id);
    if (onClose) onClose();
  };

  return (
    <Stack h="100%" gap="xs" p="md">
      <Button
        variant="light"
        leftSection={<IconPlus size={16} />}
        fullWidth
        onClick={handleCreate}
      >
        New Chat
      </Button>

      <Text size="xs" c="dimmed" mt="xs" fw={700}>
        HISTORY
      </Text>

      <ScrollArea style={{ flex: 1 }} type="auto">
        <Stack gap={4}>
          {conversations.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" mt="md">
              No conversations yet.
            </Text>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === activeConversationId;
              return (
                <Paper
                  key={conv.id}
                  p="xs"
                  radius="sm"
                  withBorder={isActive}
                  bg={
                    isActive
                      ? "var(--mantine-color-default-hover)"
                      : "transparent"
                  }
                  style={{
                    cursor: "pointer",
                    transition: "background-color 0.2s",
                    borderColor: "var(--mantine-primary-color-filled)",
                  }}
                  onClick={() => handleSelect(conv.id)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "var(--mantine-color-default-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="xs" style={{ flex: 1, overflow: "hidden" }}>
                      <IconMessage size={16} style={{ opacity: 0.7 }} />
                      <Stack gap={0} style={{ overflow: "hidden" }}>
                        <Text
                          size="sm"
                          truncate
                          fw={isActive ? 600 : 400}
                          c={isActive ? "bright" : "dimmed"}
                        >
                          {conv.title || "New Chat"}
                        </Text>
                        <Text
                          size="xs"
                          c="dimmed"
                          style={{ fontSize: 10, opacity: 0.6 }}
                        >
                          {formatDistanceToNow(conv.updatedAt, {
                            addSuffix: true,
                          })}
                        </Text>
                      </Stack>
                    </Group>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      color="red"
                      onClick={(e) => handleDelete(e, conv.id)}
                      style={{ opacity: 0.6 }}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                </Paper>
              );
            })
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  );
};
