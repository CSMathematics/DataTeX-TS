import React from 'react';
import { ActionIcon, Tooltip, MantineSize, MantineColor, ActionIconVariant } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

interface ToolbarButtonProps {
    /** Tooltip label */
    label: string;
    /** FontAwesome icon or React node */
    icon: IconDefinition | React.ReactNode;
    /** Click handler */
    onClick: () => void;
    /** Button size */
    size?: MantineSize;
    /** Icon size in pixels */
    iconSize?: number;
    /** Button color */
    color?: MantineColor;
    /** Button variant */
    variant?: ActionIconVariant;
    /** Disabled state */
    disabled?: boolean;
    /** Loading state */
    loading?: boolean;
    /** Custom styles for the icon */
    iconStyle?: React.CSSProperties;
    /** Custom styles for the button */
    style?: React.CSSProperties;
}

/**
 * Reusable toolbar button with tooltip, commonly used across toolbars.
 * Combines Tooltip + ActionIcon + Icon pattern.
 */
export const ToolbarButton = React.memo(({
    label,
    icon,
    onClick,
    size = 'sm',
    iconSize = 14,
    color = 'gray',
    variant = 'subtle',
    disabled = false,
    loading = false,
    iconStyle,
    style
}: ToolbarButtonProps) => {
    const isFontAwesomeIcon = (icon: IconDefinition | React.ReactNode): icon is IconDefinition => {
        return typeof icon === 'object' && icon !== null && 'iconName' in icon;
    };

    return (
        <Tooltip label={label}>
            <ActionIcon 
                variant={variant} 
                size={size} 
                color={color}
                onClick={onClick}
                disabled={disabled}
                loading={loading}
                style={style}
            >
                {isFontAwesomeIcon(icon) ? (
                    <FontAwesomeIcon 
                        icon={icon} 
                        style={{ width: iconSize, height: iconSize, ...iconStyle }} 
                    />
                ) : (
                    icon
                )}
            </ActionIcon>
        </Tooltip>
    );
});

ToolbarButton.displayName = 'ToolbarButton';
