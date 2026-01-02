import React from 'react';
import { Center, Stack, Text, Box } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

interface EmptyStateProps {
    /** Message to display */
    message: string;
    /** Optional FontAwesome icon */
    icon?: IconDefinition;
    /** Icon size in pixels */
    iconSize?: number;
    /** Background color */
    bg?: string;
    /** Full height container */
    fullHeight?: boolean;
    /** Optional action button */
    action?: React.ReactNode;
}

/**
 * Reusable empty state component for no-data or placeholder states.
 */
export const EmptyState = React.memo(({
    message,
    icon,
    iconSize = 32,
    bg = 'var(--mantine-color-dark-8)',
    fullHeight = true,
    action
}: EmptyStateProps) => {
    return (
        <Center h={fullHeight ? "100%" : undefined} py={fullHeight ? undefined : "xl"} bg={bg}>
            <Stack align="center" gap="md">
                {icon && (
                    <Box c="dimmed">
                        <FontAwesomeIcon icon={icon} style={{ width: iconSize, height: iconSize }} />
                    </Box>
                )}
                <Text c="dimmed" size="sm" ta="center">{message}</Text>
                {action}
            </Stack>
        </Center>
    );
});

EmptyState.displayName = 'EmptyState';
