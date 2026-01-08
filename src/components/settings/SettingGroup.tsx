import React from "react";
import { Stack, Text } from "@mantine/core";

interface SettingGroupProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export const SettingGroup: React.FC<SettingGroupProps> = ({
  title,
  description,
  children,
}) => {
  return (
    <Stack gap="sm" mb="xl">
      <div>
        <Text size="sm" fw={600}>
          {title}
        </Text>
        {description && (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        )}
      </div>
      <Stack gap="md" pl="xs">
        {children}
      </Stack>
    </Stack>
  );
};
