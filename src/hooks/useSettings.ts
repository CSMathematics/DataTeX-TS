import { useState, useEffect } from 'react';

export interface EditorSettings {
    fontSize: number;
    fontFamily: string;
    wordWrap: 'on' | 'off';
    minimap: boolean;
    lineNumbers: 'on' | 'off' | 'relative';
    theme: string; // Monaco theme name
}

export interface GeneralSettings {
    language: string;
    autoSave: boolean;
}

export interface AppSettings {
    editor: EditorSettings;
    general: GeneralSettings;
    uiTheme: string; // Theme ID (e.g. 'dark-blue', 'light-gray')
}

const DEFAULT_SETTINGS: AppSettings = {
    editor: {
        fontSize: 14,
        fontFamily: 'Consolas, monospace',
        wordWrap: 'on',
        minimap: true,
        lineNumbers: 'on',
        theme: 'data-tex-dark',
    },
    general: {
        language: 'en',
        autoSave: false,
    },
    uiTheme: 'dark-blue',
};

export function useSettings() {
    const [settings, setSettings] = useState<AppSettings>(() => {
        const saved = localStorage.getItem('app-settings');
        if (saved) {
            try {
                // Merge saved settings with defaults to handle new fields
                const parsed = JSON.parse(saved);

                // Migration Logic
                let uiTheme = parsed.uiTheme;
                if (uiTheme === 'dark') uiTheme = 'dark-blue';
                if (uiTheme === 'light') uiTheme = 'light-blue';
                if (uiTheme === 'auto') uiTheme = 'dark-blue'; // Default 'auto' to dark-blue for now
                if (!uiTheme) uiTheme = DEFAULT_SETTINGS.uiTheme;

                return {
                    editor: { ...DEFAULT_SETTINGS.editor, ...parsed.editor },
                    general: { ...DEFAULT_SETTINGS.general, ...parsed.general },
                    uiTheme: uiTheme,
                };
            } catch (e) {
                console.error("Failed to parse settings", e);
                return DEFAULT_SETTINGS;
            }
        }
        return DEFAULT_SETTINGS;
    });

    useEffect(() => {
        localStorage.setItem('app-settings', JSON.stringify(settings));
    }, [settings]);

    const updateEditorSetting = <K extends keyof EditorSettings>(key: K, value: EditorSettings[K]) => {
        setSettings(prev => ({
            ...prev,
            editor: { ...prev.editor, [key]: value }
        }));
    };

    const updateGeneralSetting = <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => {
        setSettings(prev => ({
            ...prev,
            general: { ...prev.general, [key]: value }
        }));
    };

    const setUiTheme = (theme: string) => {
        setSettings(prev => ({ ...prev, uiTheme: theme }));
    };

    return {
        settings,
        updateEditorSetting,
        updateGeneralSetting,
        setUiTheme,
        resetSettings: () => setSettings(DEFAULT_SETTINGS)
    };
}
