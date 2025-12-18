// --- Constants & Data for Preamble Wizard ---

export const PAGE_WIDTH_PX = 340;
export const A4_ASPECT_RATIO = 1.414;
export const PAGE_HEIGHT_PX = PAGE_WIDTH_PX * A4_ASPECT_RATIO;
export const A4_WIDTH_CM = 21;
export const CM_TO_PX = PAGE_WIDTH_PX / A4_WIDTH_CM;

export const LANGUAGES = [
  { value: 'english', label: 'English' },
  { value: 'greek', label: 'Greek (Ελληνικά)' },
  { value: 'german', label: 'German (Deutsch)' },
  { value: 'french', label: 'French (Français)' },
  { value: 'spanish', label: 'Spanish (Español)' },
  { value: 'italian', label: 'Italian (Italiano)' },
  { value: 'portuguese', label: 'Portuguese (Português)' },
  { value: 'dutch', label: 'Dutch (Nederlands)' },
  { value: 'russian', label: 'Russian (Русский)' },
  { value: 'polish', label: 'Polish (Polski)' },
  { value: 'czech', label: 'Czech (Čeština)' },
  { value: 'turkish', label: 'Turkish (Türkçe)' },
  { value: 'swedish', label: 'Swedish (Svenska)' },
  { value: 'danish', label: 'Danish (Dansk)' },
  { value: 'norwegian', label: 'Norwegian (Norsk)' },
  { value: 'finnish', label: 'Finnish (Suomi)' },
  { value: 'hungarian', label: 'Hungarian (Magyar)' },
  { value: 'romanian', label: 'Romanian (Română)' },
  { value: 'bulgarian', label: 'Bulgarian (Български)' },
  { value: 'ukrainian', label: 'Ukrainian (Українська)' },
  { value: 'hebrew', label: 'Hebrew (עִבְרִית)' },
  { value: 'arabic', label: 'Arabic (العربية)' },
  { value: 'chinese', label: 'Chinese (中文)' },
  { value: 'japanese', label: 'Japanese (日本語)' },
  { value: 'korean', label: 'Korean (한국어)' },
  { value: 'latin', label: 'Latin' },
];

export const COLOR_MODELS = [
  { value: 'HTML', label: 'HTML (Hex)' },
  { value: 'rgb', label: 'rgb (0-1)' },
  { value: 'RGB', label: 'RGB (0-255)' },
  { value: 'cmy', label: 'cmy (0-1)' },
  { value: 'cmyk', label: 'cmyk (0-1)' },
  { value: 'hsb', label: 'hsb (0-1)' },
  { value: 'HSB', label: 'HSB (0-255)' },
  { value: 'gray', label: 'gray (0-1)' },
  { value: 'Gray', label: 'Gray (0-15)' },
];

export const PAPER_SIZES = [
  { value: 'a4paper', label: 'A4' },
  { value: 'letterpaper', label: 'Letter' },
  { value: 'a5paper', label: 'A5' },
  { value: 'b5paper', label: 'B5' },
  { value: 'executivepaper', label: 'Executive' },
  { value: 'legalpaper', label: 'Legal' },
  { value: 'a3paper', label: 'A3' },
  { value: 'b4paper', label: 'B4' },
];

// --- CODE HIGHLIGHTING CONSTANTS ---
export const LANGUAGES_DB = [
  { label: 'Python', value: 'python', listings: 'Python', minted: 'python' },
  { label: 'C', value: 'c', listings: 'C', minted: 'c' },
  { label: 'C++', value: 'cpp', listings: 'C++', minted: 'cpp' },
  { label: 'Java', value: 'java', listings: 'Java', minted: 'java' },
  { label: 'SQL', value: 'sql', listings: 'SQL', minted: 'sql' },
  { label: 'HTML', value: 'html', listings: 'HTML', minted: 'html' },
  { label: 'XML', value: 'xml', listings: 'XML', minted: 'xml' },
  { label: 'Bash/Shell', value: 'bash', listings: 'bash', minted: 'bash' },
  { label: 'Matlab', value: 'matlab', listings: 'Matlab', minted: 'matlab' },
  { label: 'LaTeX', value: 'tex', listings: 'TeX', minted: 'tex' },
  { label: 'R', value: 'r', listings: 'R', minted: 'r' },
  { label: 'PHP', value: 'php', listings: 'PHP', minted: 'php' },
  { label: 'Ruby', value: 'ruby', listings: 'Ruby', minted: 'ruby' },
  { label: 'Perl', value: 'perl', listings: 'Perl', minted: 'perl' },
  { label: 'Lua', value: 'lua', listings: 'Lua', minted: 'lua' },
  { label: 'Fortran', value: 'fortran', listings: 'Fortran', minted: 'fortran' },
  
  // Minted Only (or require extra setup in listings)
  { label: 'JavaScript', value: 'javascript', listings: null, minted: 'javascript' },
  { label: 'TypeScript', value: 'typescript', listings: null, minted: 'typescript' },
  { label: 'JSON', value: 'json', listings: null, minted: 'json' },
  { label: 'YAML', value: 'yaml', listings: null, minted: 'yaml' },
  { label: 'Go', value: 'go', listings: null, minted: 'go' },
  { label: 'Rust', value: 'rust', listings: null, minted: 'rust' },
  { label: 'Swift', value: 'swift', listings: null, minted: 'swift' },
  { label: 'Kotlin', value: 'kotlin', listings: null, minted: 'kotlin' },
  { label: 'C#', value: 'csharp', listings: null, minted: 'csharp' },
  { label: 'CSS', value: 'css', listings: null, minted: 'css' },
  { label: 'Markdown', value: 'markdown', listings: null, minted: 'markdown' },
  { label: 'Dockerfile', value: 'docker', listings: null, minted: 'docker' },
];

export const MINTED_STYLES = [
  'default', 'friendly', 'colorful', 'autumn', 'murphy', 'manni', 
  'monokai', 'perldoc', 'pastie', 'borland', 'trac', 'native', 
  'fruity', 'bw', 'vim', 'vs', 'tango'
];

export interface CustomColorDef {
  id: number;
  name: string;
  model: string;
  value: string;
  previewHex: string; // Used strictly for UI preview
}

export interface CustomListDef {
  id: number;
  name: string;
  baseType: 'itemize' | 'enumerate' | 'description';
  label: string;
}

// --- Helper: Color Conversion Logic ---
export const hexToModelValue = (hex: string, model: string): string => {
  hex = hex.replace('#', '');
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const rgbToHsv = (r: number, g: number, b: number) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    const s = max === 0 ? 0 : d / max;
    const v = max;
    let h = 0;
    if (max !== min) {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h, s, v };
  };

  // Special internal model for listings package which requires 0-1 RGB comma separated
  if (model === 'listings_rgb') {
      return `${rNorm.toFixed(2)},${gNorm.toFixed(2)},${bNorm.toFixed(2)}`;
  }

  switch (model) {
    case 'HTML': return hex.toUpperCase();
    case 'RGB': return `${r},${g},${b}`;
    case 'rgb': return `${rNorm.toFixed(3)},${gNorm.toFixed(3)},${bNorm.toFixed(3)}`;
    case 'gray': return (0.299 * rNorm + 0.587 * gNorm + 0.114 * bNorm).toFixed(3);
    case 'Gray': return Math.round((0.299 * rNorm + 0.587 * gNorm + 0.114 * bNorm) * 15).toString();
    case 'cmy': return `${(1 - rNorm).toFixed(3)},${(1 - gNorm).toFixed(3)},${(1 - bNorm).toFixed(3)}`;
    case 'cmyk':
      const k = 1 - Math.max(rNorm, gNorm, bNorm);
      if (k === 1) return '0,0,0,1';
      return `${((1 - rNorm - k) / (1 - k)).toFixed(3)},${((1 - gNorm - k) / (1 - k)).toFixed(3)},${((1 - bNorm - k) / (1 - k)).toFixed(3)},${k.toFixed(3)}`;
    case 'hsb':
      const hsb = rgbToHsv(rNorm, gNorm, bNorm);
      return `${hsb.h.toFixed(3)},${hsb.s.toFixed(3)},${hsb.v.toFixed(3)}`;
    case 'HSB':
      const HSB = rgbToHsv(rNorm, gNorm, bNorm);
      return `${Math.round(HSB.h * 255)},${Math.round(HSB.s * 255)},${Math.round(HSB.v * 255)}`;
    default: return hex;
  }
};