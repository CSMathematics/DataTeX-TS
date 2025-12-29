export type Category = 'math' | 'graphics' | 'colors' | 'tables' | 'code' | 'layout' | 'misc';

export interface LatexPackage {
  id: string;
  name: string;
  category: Category;
  description: string;
  command?: string;
  hasWizard?: boolean;
}

export const PACKAGES_DB: LatexPackage[] = [
  // COLORS
  { id: 'xcolor', name: 'XColor', category: 'colors', description: 'Driver-independent color extensions.', hasWizard: true },

  // LAYOUT
  { id: 'geometry', name: 'Geometry', category: 'layout', description: 'Page dimensions and margins.', hasWizard: true },
  { id: 'fancyhdr', name: 'Fancyhdr', category: 'layout', description: 'Custom headers and footers.', command: '\\usepackage{fancyhdr}', hasWizard: true },
  { id: 'enumitem', name: 'Enumitem', category: 'layout', description: 'Custom lists, spacing and labels.', hasWizard: true },

  // MATH
  { id: 'amsmath', name: 'AMS Math', category: 'math', description: 'Equations, matrices, and alignment.', command: '\\usepackage{amsmath}' },
  // AMS Symbols removed from here as it is moved to Sidebar
  { id: 'siunitx', name: 'SI Unitx', category: 'math', description: 'SI units and number formatting.', command: '\\usepackage{siunitx}' },

  // GRAPHICS
  { id: 'tikz', name: 'TikZ', category: 'graphics', description: 'Create graphics programmatically.', hasWizard: true },
  { id: 'pstricks', name: 'PSTricks', category: 'graphics', description: 'PostScript macros for graphics.', hasWizard: true },
  { id: 'pgfplots', name: 'PGFPlots', category: 'graphics', description: 'Create plots and charts.', hasWizard: true },
  { id: 'graphicx', name: 'Graphicx', category: 'graphics', description: 'Include external images.', command: '\\usepackage{graphicx}' },

  // TABLES
  { id: 'booktabs', name: 'Booktabs', category: 'tables', description: 'Professional table layout.', hasWizard: true },
  { id: 'multirow', name: 'Multirow', category: 'tables', description: 'Cells spanning multiple rows.', hasWizard: true },

  // CODE
  { id: 'listings', name: 'Listings', category: 'code', description: 'Source code printing (Native LaTeX).', command: '\\usepackage{listings}' },
  { id: 'minted', name: 'Minted', category: 'code', description: 'Highlighted source code (Requires Pygments).', command: '\\usepackage{minted}' },
];
