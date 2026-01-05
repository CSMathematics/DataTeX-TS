import React from 'react';
import { Group, Text, ActionIcon, Tooltip } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExpand, faCompress } from '@fortawesome/free-solid-svg-icons';
import { TreeToolbarProps } from './types';

/**
 * Shared toolbar component for tree views.
 * Displays title, action buttons, and optional expand/collapse toggle.
 */
export const TreeToolbar = React.memo<TreeToolbarProps>(({
    title,
    actions,
    showExpandToggle = false,
    isExpanded = false,
    onToggleExpand
}) => {
    return (
        <Group justify="space-between" px={4}>
            <Text size="xs" fw={700} c="dimmed">
                {title}
            </Text>
            <Group gap={2}>
                {/* Custom action buttons */}
                {actions.map((action, index) => (
                    <Tooltip key={index} label={action.tooltip}>
                        <ActionIcon
                            size="xs"
                            variant={action.variant || 'subtle'}
                            color={action.color || 'gray'}
                            onClick={action.onClick}
                            disabled={action.disabled}
                        >
                            <FontAwesomeIcon 
                                icon={action.icon} 
                                style={{ width: 12, height: 12 }} 
                            />
                        </ActionIcon>
                    </Tooltip>
                ))}
                
                {/* Expand/Collapse toggle */}
                {showExpandToggle && onToggleExpand && (
                    <Tooltip label={isExpanded ? "Collapse All" : "Expand All"}>
                        <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="gray"
                            onClick={onToggleExpand}
                        >
                            <FontAwesomeIcon 
                                icon={isExpanded ? faCompress : faExpand} 
                                style={{ width: 12, height: 12 }} 
                            />
                        </ActionIcon>
                    </Tooltip>
                )}
            </Group>
        </Group>
    );
});

TreeToolbar.displayName = 'TreeToolbar';
