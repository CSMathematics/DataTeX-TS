import { createTheme, MantineThemeOverride, mergeMantineTheme, MantineColorsTuple, DEFAULT_THEME } from "@mantine/core";
import { baseTheme } from "./base-theme";

export interface UITheme {
    id: string;
    label: string;
    type: 'light' | 'dark'; // The generic scheme
    theme: MantineThemeOverride;
}

// --- Custom Colors ---
const dataTexDarkColors: MantineColorsTuple = [
    "#C1C2C5", "#A6A7AB", "#909296", "#5c5f66", "#373A40",
    "#2C2E33", "#25262b", "#1A1B1E", "#141517", "#101113",
];

// Combine defaults with our base settings
const fullBaseTheme = mergeMantineTheme(DEFAULT_THEME, baseTheme);

// --- Theme Definitions ---

const lightBlue: UITheme = {
    id: 'light-blue',
    label: 'Light Blue (Default)',
    type: 'light',
    theme: mergeMantineTheme(fullBaseTheme, createTheme({
        primaryColor: 'blue',
        colors: {
            // Standard Mantine colors are already in fullBaseTheme
        },
        other: {
            appBg: 'var(--mantine-color-white)',
            sidebarBg: 'var(--mantine-color-gray-0)',
            headerBg: 'var(--mantine-color-white)',
            statusBarBg: 'var(--mantine-color-blue-8)',
            panelBg: 'var(--mantine-color-gray-0)'
        }
    }))
};

const lightGray: UITheme = {
    id: 'light-gray',
    label: 'Light Gray (Minimal)',
    type: 'light',
    theme: mergeMantineTheme(fullBaseTheme, createTheme({
        primaryColor: 'gray',
        other: {
            appBg: '#ffffff',
            sidebarBg: '#f8f9fa',
            headerBg: '#ffffff',
            statusBarBg: '#495057', // Gray 7
            panelBg: '#f8f9fa'
        }
    }))
};

const lightTeal: UITheme = {
    id: 'light-teal',
    label: 'Light Teal (Nature)',
    type: 'light',
    theme: mergeMantineTheme(fullBaseTheme, createTheme({
        primaryColor: 'teal',
        other: {
            appBg: '#e6fcf5', // Teal 0
            sidebarBg: '#c3fae8', // Teal 1
            headerBg: '#e6fcf5',
            statusBarBg: 'var(--mantine-color-teal-8)',
            panelBg: '#c3fae8'
        }
    }))
};

const darkBlue: UITheme = {
    id: 'dark-blue',
    label: 'Dark Blue (Default)',
    type: 'dark',
    theme: mergeMantineTheme(fullBaseTheme, createTheme({
        primaryColor: 'blue',
        colors: {
            dark: dataTexDarkColors
        },
        other: {
            appBg: '#1A1B1E', // Dark 7
            sidebarBg: '#141517', // Dark 8 (Activity bar)
            headerBg: '#1A1B1E', // Dark 7
            statusBarBg: '#235fce', // Original blue
            panelBg: '#25262b' // Dark 6 (Sidebars)
        }
    }))
};

const darkDeep: UITheme = {
    id: 'dark-deep',
    label: 'Deep Black (OLED)',
    type: 'dark',
    theme: mergeMantineTheme(fullBaseTheme, createTheme({
        primaryColor: 'violet',
        colors: {
            // Custom dark scale for pure black
            dark: [
                "#d5d7e0", "#acaebf", "#8c8fa3", "#666980", "#4d4f66",
                "#34354a", "#2b2c3d", "#1d1e30", "#0c0d21", "#000000",
            ]
        },
        other: {
            appBg: '#000000',
            sidebarBg: '#000000',
            headerBg: '#000000',
            statusBarBg: 'var(--mantine-color-violet-9)',
            panelBg: '#101113' // Slightly lighter
        }
    }))
};

const darkMonokai: UITheme = {
    id: 'dark-monokai',
    label: 'Monokai Vivid',
    type: 'dark',
    theme: mergeMantineTheme(fullBaseTheme, createTheme({
        primaryColor: 'orange', // Closest to monokai orange/yellow
        colors: {
            // Monokai-ish darks
            dark: [
                "#f8f8f2", "#e6db74", "#a6e22e", "#66d9ef", "#ae81ff",
                "#75715e", "#49483e", "#272822", "#1e1f1c", "#171814"
            ]
        },
        other: {
            appBg: '#272822',
            sidebarBg: '#1e1f1c',
            headerBg: '#272822',
            statusBarBg: '#ae81ff', // Purple
            panelBg: '#272822'
        }
    }))
};

const darkNord: UITheme = {
    id: 'dark-nord',
    label: 'Nordic Cool',
    type: 'dark',
    theme: mergeMantineTheme(fullBaseTheme, createTheme({
        primaryColor: 'cyan', // Nord8
        colors: {
             // Nord Palette approximation for Dark array
             dark: [
                "#d8dee9", "#e5e9f0", "#eceff4", "#8fbcbb", "#88c0d0",
                "#81a1c1", "#5e81ac", "#4c566a", "#434c5e", "#3b4252" // Using Nord polar nights
            ]
        },
        other: {
            appBg: '#2e3440', // Nord0
            sidebarBg: '#3b4252', // Nord1
            headerBg: '#2e3440',
            statusBarBg: '#5e81ac', // Nord10
            panelBg: '#3b4252'
        }
    }))
};

// --- Export ---

export const THEMES: Record<string, UITheme> = {
    'light-blue': lightBlue,
    'light-gray': lightGray,
    'light-teal': lightTeal,
    'dark-blue': darkBlue,
    'dark-deep': darkDeep,
    'dark-monokai': darkMonokai,
    'dark-nord': darkNord,
};

export const getTheme = (id: string): UITheme => {
    return THEMES[id] || THEMES['dark-blue'];
};
