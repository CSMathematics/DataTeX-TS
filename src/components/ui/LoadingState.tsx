import React from 'react';
import { Center, Stack, Loader, Text } from '@mantine/core';

interface LoadingStateProps {
    /** Loading message to display */
    message?: string;
    /** Size of the loader */
    size?: 'xs' | 'sm' | 'md' | 'lg';
    /** Loader type */
    type?: 'bars' | 'dots' | 'oval';
    /** Full height container */
    fullHeight?: boolean;
}

/**
 * Reusable loading state component with centered loader and optional message.
 */
export const LoadingState = React.memo(({
    message,
    size = 'md',
    type = 'bars',
    fullHeight = true
}: LoadingStateProps) => {
    return (
        <Center h={fullHeight ? "100%" : undefined} py={fullHeight ? undefined : "xl"}>
            <Stack align="center" gap="xs">
                <Loader type={type} size={size} />
                {message && (
                    <Text size="xs" c="dimmed">{message}</Text>
                )}
            </Stack>
        </Center>
    );
});

LoadingState.displayName = 'LoadingState';
