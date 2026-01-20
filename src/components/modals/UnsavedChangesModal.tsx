import React from "react";
import { Modal, Button, Text, Group, Stack } from "@mantine/core";

interface UnsavedChangesModalProps {
  opened: boolean;
  onClose: () => void;
  onDiscard: () => void;
  onSave: () => void;
  fileName: string;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  opened,
  onClose,
  onDiscard,
  onSave,
  fileName,
}) => {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Unsaved Changes"
      centered
      size="sm"
    >
      <Stack>
        <Text size="sm">
          Do you want to save the changes you made to <b>{fileName}</b>?
        </Text>
        <Text size="xs" c="dimmed">
          Your changes will be lost if you don't save them.
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onDiscard}>
            Don't Save
          </Button>
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} color="blue">
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
