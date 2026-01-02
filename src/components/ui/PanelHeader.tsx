import React from 'react';
import { Group, Text } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

interface PanelHeaderProps {
    /** FontAwesome icon */
    icon: IconDefinition;
    /** Panel title */
    title: string;
    /** Optional subtitle or secondary text */
    subtitle?: string;
    /** Right-side actions (buttons, etc.) */
    actions?: React.ReactNode;
    /** Background color */
    bg?: string;
    /** Padding shorthand */
    p?: string;
}

/**
 * Reusable panel header with icon, title, and optional actions.
 */
export const PanelHeader = React.memo(({
    icon,
    title,
    subtitle,
    actions,
    bg = 'var(--mantine-color-body)',
    p = 'xs'
}: PanelHeaderProps) => {
    return (
        <Group 
            p={p} 
            bg={bg} 
            justify="space-between" 
            style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
        >
            <Group gap="xs">
                <FontAwesomeIcon icon={icon} />
                <Text fw={700} size="sm" truncate style={{ maxWidth: 150 }}>
                    {title}
                </Text>
                {subtitle && (
                    <Text size="xs" c="dimmed">{subtitle}</Text>
                )}
            </Group>
            {actions}
        </Group>
    );
});

PanelHeader.displayName = 'PanelHeader';
