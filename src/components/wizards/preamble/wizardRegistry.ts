/**
 * Wizard Registry - Maps package IDs to their wizard configurations
 * This is the source of truth for which packages have wizards and how they are configured.
 */

import type { ViewType } from "../../layout/Sidebar";

export type WizardCategory =
  | "math"
  | "graphics"
  | "colors"
  | "tables"
  | "code"
  | "layout"
  | "misc";

/**
 * Configuration for a package wizard
 */
export interface WizardConfig {
  /** The view to navigate to when opening this wizard */
  wizardView?: ViewType;
  /** Category for grouping in UI */
  category: WizardCategory;
  /** If true, this package is handled inline in PackageGallery */
  isEmbedded?: boolean;
  /** Custom display name override (if different from CTAN) */
  displayName?: string;
}

/**
 * Registry of all packages that have wizard support.
 * Key = CTAN package ID
 */
export const WIZARD_REGISTRY: Record<string, WizardConfig> = {
  // === COLORS ===
  xcolor: {
    category: "colors",
    isEmbedded: true,
    displayName: "XColor",
  },

  // === LAYOUT ===
  geometry: {
    category: "layout",
    wizardView: "wizard-preamble",
    displayName: "Geometry",
  },
  fancyhdr: {
    category: "layout",
    wizardView: "wizard-fancyhdr",
    displayName: "Fancyhdr",
  },
  enumitem: {
    category: "layout",
    isEmbedded: true,
    displayName: "Enumitem",
  },

  // === GRAPHICS ===
  tikz: {
    category: "graphics",
    wizardView: "wizard-tikz",
    isEmbedded: true,
    displayName: "TikZ",
  },

  pstricks: {
    category: "graphics",
    wizardView: "wizard-pstricks",
    isEmbedded: true,
    displayName: "PSTricks",
  },
  graphicx: {
    category: "graphics",
    displayName: "Graphicx",
    wizardView: "wizard-graphicx",
  },

  // === TABLES ===
  tabularray: {
    category: "tables",
    wizardView: "wizard-tabularray",
    isEmbedded: true,
    displayName: "Table Wizard",
  },

  // === CODE ===
  listings: {
    category: "code",
    displayName: "Listings",
  },
  minted: {
    category: "code",
    displayName: "Minted",
  },

  // === MATH ===
  amsmath: {
    category: "math",
    displayName: "AMS Math",
    wizardView: "wizard-math",
  },
  mathtools: {
    category: "math",
    displayName: "Mathtools",
    wizardView: "wizard-math",
  },
  siunitx: {
    category: "math",
    displayName: "SI Unitx",
  },
};

/**
 * Check if a package has wizard support
 */
export function hasWizard(packageId: string): boolean {
  return packageId in WIZARD_REGISTRY;
}

/**
 * Get wizard config for a package (or undefined if no wizard)
 */
export function getWizardConfig(packageId: string): WizardConfig | undefined {
  return WIZARD_REGISTRY[packageId];
}

/**
 * Get all packages with wizard support
 */
export function getWizardPackageIds(): string[] {
  return Object.keys(WIZARD_REGISTRY);
}
