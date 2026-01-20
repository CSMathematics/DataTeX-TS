/**
 * Package Service - Unified access to package data via Rust Backend
 */

import { invoke } from "@tauri-apps/api/core";
import {
  WIZARD_REGISTRY,
  WizardConfig,
  WizardCategory,
  hasWizard,
  getWizardConfig,
} from "../components/wizards/preamble/wizardRegistry";

// === CTAN Data Types (Mirror Rust structs) ===

interface CTANAuthor {
  givenname?: string;
  familyname?: string;
}

interface CTANLicense {
  name?: string;
  key?: string;
  free?: boolean;
}

interface CTANTopic {
  details: string;
  key: string;
}

interface CTANPackage {
  id: string;
  name: string;
  caption?: string;
  descriptions?: { text: string }[] | { description: string } | any; // Use 'any' to handle the loose type from Rust
  authors?: CTANAuthor[];
  license?: CTANLicense;
  version?: { number: string; date: string };
  topics?: CTANTopic[];
  documentation?: { href: string; details: string }[];
  home?: string;
}

// === Enhanced Package Type ===

export interface EnhancedPackage {
  // Core identifiers
  id: string;
  name: string;

  // Display info
  displayName: string;
  caption: string;
  description: string;

  // Metadata
  authors: CTANAuthor[];
  license?: CTANLicense;
  version?: { number: string; date: string };
  topics: CTANTopic[];
  documentation?: { href: string; details: string }[];
  home?: string;

  // Wizard integration
  hasWizard: boolean;
  wizardConfig?: WizardConfig;
  category?: WizardCategory;

  // Utility
  usepackageCommand: string;
}

// === Helper Functions ===

function getDescription(pkg: CTANPackage): string {
  if (!pkg.descriptions) return pkg.caption || "";

  if (Array.isArray(pkg.descriptions)) {
    // Handle array case (assuming array of objects with text property)
    const descArray = pkg.descriptions as { text: string }[];
    return descArray[0]?.text || pkg.caption || "";
  }

  // Handle object case
  const descObj = pkg.descriptions as { description: string };
  return descObj.description || pkg.caption || "";
}

function stripHtml(html: string): string {
  if (typeof document !== "undefined") {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }
  return html.replace(/<[^>]*>/g, "");
}

// === Core Functions ===

function createEnhancedPackage(ctanPkg: CTANPackage): EnhancedPackage {
  const wizardConfig = getWizardConfig(ctanPkg.id);
  const rawCaption = ctanPkg.caption || "";
  const rawDescription = getDescription(ctanPkg);

  return {
    // Core
    id: ctanPkg.id,
    name: ctanPkg.name,

    // Display
    displayName: wizardConfig?.displayName || ctanPkg.name,
    caption: stripHtml(rawCaption),
    description: stripHtml(rawDescription), // Ensure description is also stripped of basic HTML if needed

    // Metadata
    authors: ctanPkg.authors || [],
    license: ctanPkg.license,
    version: ctanPkg.version,
    topics: ctanPkg.topics || [],
    documentation: ctanPkg.documentation,
    home: ctanPkg.home,

    // Wizard
    hasWizard: hasWizard(ctanPkg.id),
    wizardConfig: wizardConfig,
    category: wizardConfig?.category,

    // Utility
    usepackageCommand: `\\usepackage{${ctanPkg.id}}`,
  };
}

/**
 * Lightweight package item for list view (from Rust backend)
 */
interface PackageListItem {
  id: string;
  name: string;
  caption: string;
  version: string;
  home: string | null;
  ctan: string | null;
}

interface PackageResponse {
  total: number;
  packages: PackageListItem[];
}

/**
 * Lightweight enhanced package for list view (minimal data for fast rendering)
 */
export interface ListPackage {
  id: string;
  name: string;
  caption: string;
  version: string;
  hasWizard: boolean;
  home: string | null;
  ctan: string | null;
}

export async function getAllPackages(
  query?: string,
  topic?: string,
  limit: number = 100,
  offset: number = 0,
): Promise<{ packages: ListPackage[]; total: number }> {
  try {
    const response = await invoke<PackageResponse>("get_packages", {
      query,
      topic,
      limit,
      offset,
    });

    const packages: ListPackage[] = response.packages.map((item) => ({
      id: item.id,
      name: item.name,
      caption: item.caption || "",
      version: item.version || "",
      hasWizard: hasWizard(item.id),
      home: item.home,
      ctan: item.ctan,
    }));

    return { packages, total: response.total };
  } catch (error) {
    console.error("Failed to fetch packages from backend:", error);
    return { packages: [], total: 0 };
  }
}

/**
 * Get package by ID from Rust backend
 */
export async function getPackageById(
  id: string,
): Promise<EnhancedPackage | undefined> {
  const ctanPkg = await invoke<CTANPackage | null>("get_package_by_id", { id });
  if (!ctanPkg) return undefined;
  return createEnhancedPackage(ctanPkg);
}

export async function getPackagesWithWizards(): Promise<EnhancedPackage[]> {
  // Get all IDs from registry
  const ids = Object.keys(WIZARD_REGISTRY);
  // Fetch them in parallel
  const promises = ids.map((id) => getPackageById(id));
  const results = await Promise.all(promises);
  return results.filter((p): p is EnhancedPackage => p !== undefined);
}

/**
 * Get packages by category (from wizard registry)
 */
export async function getPackagesByCategory(
  category: WizardCategory,
): Promise<EnhancedPackage[]> {
  const packages = await getPackagesWithWizards();
  return packages.filter((pkg) => pkg.category === category);
}

/**
 * Get packages by topic (from CTAN data)
 */
export async function getPackagesByTopic(
  topicKey: string,
): Promise<ListPackage[]> {
  const result = await getAllPackages(undefined, topicKey, 1000); // Higher limit for topics
  return result.packages;
}

/**
 * Search packages by name, caption, or ID
 */
export async function searchPackages(query: string): Promise<ListPackage[]> {
  const result = await getAllPackages(query, undefined, 100);
  return result.packages;
}

/**
 * Get all unique topics from CTAN data
 */
export async function getAllTopics(): Promise<
  { key: string; label: string }[]
> {
  const topics = await invoke<CTANTopic[]>("get_all_topics");
  return topics.map((t) => ({ key: t.key, label: t.details }));
}

/**
 * Get total package count
 * Uses the existing get_packages command which returns total count.
 */
export async function getPackageCount(): Promise<number> {
  const result = await getAllPackages(undefined, undefined, 1, 0);
  return result.total;
}

/**
 * Get count of packages with wizards
 */
export function getWizardPackageCount(): number {
  return Object.keys(WIZARD_REGISTRY).length;
}

// Re-export types and functions from wizard registry
export { hasWizard, getWizardConfig, WIZARD_REGISTRY };
export type { WizardConfig, WizardCategory };
