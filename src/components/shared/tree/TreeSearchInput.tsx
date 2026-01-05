import React, { useCallback } from 'react';
import { TextInput, ActionIcon } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimes } from '@fortawesome/free-solid-svg-icons';
import { TreeSearchInputProps } from './types';

/**
 * Shared search input component for tree views.
 * Used in both Explorer and Database sidebars.
 */
export const TreeSearchInput = React.memo<TreeSearchInputProps>(({
    value,
    onChange,
    onClear,
    placeholder = 'Filter files...'
}) => {
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.currentTarget.value);
    }, [onChange]);

    return (
        <TextInput
            placeholder={placeholder}
            size="xs"
            value={value}
            onChange={handleChange}
            rightSection={
                value ? (
                    <ActionIcon 
                        size="xs" 
                        variant="transparent" 
                        onClick={onClear}
                        aria-label="Clear search"
                    >
                        <FontAwesomeIcon icon={faTimes} style={{ width: 10, height: 10 }} />
                    </ActionIcon>
                ) : (
                    <FontAwesomeIcon 
                        icon={faSearch} 
                        style={{ width: 12, height: 12, color: 'var(--mantine-color-dimmed)' }} 
                    />
                )
            }
        />
    );
});

TreeSearchInput.displayName = 'TreeSearchInput';
