import { CustomColorDef, CustomListDef, hexToModelValue } from '../LanguageDb';

// Interface for the configuration object
export interface PreambleConfig {
  docClass: string;
  fontSize: string;
  paperSize: string;
  encoding: string;
  mainLang: string;
  title: string;
  author: string;
  date: boolean;
  
  // Geometry
  pkgGeometry: boolean;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  columns: string;
  columnSep: number;
  sidedness: string;
  marginNotes: boolean;
  marginSep: number;
  marginWidth: number;
  includeMp: boolean;
  
  headHeight: number;
  headSep: number;
  footSkip: number;
  bindingOffset: number;
  hOffset: number;
  vOffset: number;
  
  includeHead: boolean;
  includeFoot: boolean;
  
  // Packages
  pkgAmsmath: boolean;
  pkgGraphicx: boolean;
  pkgHyperref: boolean;
  pkgTikz: boolean;
  pkgPgfplots: boolean;
  pkgBooktabs: boolean;
  pkgFloat: boolean;
  pkgFancyhdr: boolean;
  pkgXcolor: boolean;

  // New Packages
  pkgSiunitx: boolean;
  pkgMicrotype: boolean;
  pkgCsquotes: boolean;
  pkgMultirow: boolean;
  pkgTabularx: boolean;
  pkgMulticol: boolean;
  pkgTitlesec: boolean;
  pkgCaption: boolean;
  pkgSubcaption: boolean;
  pkgListings: boolean;
  pkgCleveref: boolean;
  pkgTodonotes: boolean;

  // Lists (Enumitem)
  pkgEnumitem: boolean;
  enumitemSep: string;
  enumitemItemize: string;
  enumitemEnumerate: string;
}

// --- Generator Functions ---

export const generateGeneral = (config: PreambleConfig): string => {
  let code = '';
  
  // Class Options
  let classOpts: string[] = [`${config.fontSize}pt`, config.paperSize];
  if (config.columns === 'two') classOpts.push('twocolumn');
  if (config.sidedness === 'twoside') classOpts.push('twoside');

  code += `\\documentclass[${classOpts.join(', ')}]{${config.docClass}}\n`;
  code += `\\usepackage[${config.encoding}]{inputenc}\n`;
  code += `\\usepackage[T1]{fontenc}\n`;

  let babelOpts = ['english'];
  if (config.mainLang !== 'english') babelOpts.push(config.mainLang);
  code += `\\usepackage[${babelOpts.join(',')}]{babel}\n`;
  if (config.mainLang === 'greek') code += `\\usepackage{alphabeta}\n`;

  return code;
};

export const generateGeometry = (config: PreambleConfig): string => {
  if (!config.pkgGeometry) return '';

  let gOpts: string[] = [];
  gOpts.push(`top=${config.marginTop}cm`, `bottom=${config.marginBottom}cm`, `left=${config.marginLeft}cm`, `right=${config.marginRight}cm`);
  
  if (config.columns === 'two') gOpts.push(`columnsep=${config.columnSep}cm`);
  
  if (config.marginNotes) {
    gOpts.push(`marginparsep=${config.marginSep}cm`, `marginparwidth=${config.marginWidth}cm`);
    if (config.includeMp) gOpts.push(`includemp`);
  }
  
  if (config.headHeight > 0) gOpts.push(`headheight=${config.headHeight}cm`);
  if (config.headSep > 0) gOpts.push(`headsep=${config.headSep}cm`);
  if (config.footSkip > 0) gOpts.push(`footskip=${config.footSkip}cm`);
  if (config.bindingOffset > 0) gOpts.push(`bindingoffset=${config.bindingOffset}cm`);
  if (config.hOffset !== 0) gOpts.push(`hoffset=${config.hOffset}cm`); 
  if (config.vOffset !== 0) gOpts.push(`voffset=${config.vOffset}cm`);
  
  if (config.includeHead) gOpts.push(`includehead`);
  if (config.includeFoot) gOpts.push(`includefoot`);
  if (config.sidedness === 'asymmetric') gOpts.push(`asymmetric`);

  return `\\usepackage[${gOpts.join(', ')}]{geometry}\n`;
};

export const generatePackages = (
  config: PreambleConfig, 
  customColors: CustomColorDef[], 
  codeEngine: string
): string => {
  let code = `\n% --- Packages ---\n`;
  
  if (config.pkgAmsmath) code += `\\usepackage{amsmath, amsfonts, amssymb}\n`;
  if (config.pkgGraphicx) code += `\\usepackage{graphicx}\n`;
  
  // Xcolor logic
  if (config.pkgXcolor || customColors.length > 0 || codeEngine === 'listings') {
      code += `\\usepackage[dvipsnames, table]{xcolor}\n`;
  }

  // Custom Colors Definitions
  if (customColors.length > 0) {
      code += `\n% --- Custom Colors ---\n`;
      customColors.forEach(c => {
          code += `\\definecolor{${c.name}}{${c.model}}{${c.value}}\n`;
      });
  }

  if (config.pkgBooktabs) code += `\\usepackage{booktabs}\n`;
  if (config.pkgMultirow) code += `\\usepackage{multirow}\n`;
  if (config.pkgTabularx) code += `\\usepackage{tabularx}\n`;

  if (config.pkgFloat) code += `\\usepackage{float}\n`;
  if (config.pkgCaption) code += `\\usepackage{caption}\n`;
  if (config.pkgSubcaption) code += `\\usepackage{subcaption}\n`;

  if (config.pkgTikz) code += `\\usepackage{tikz}\n`;
  if (config.pkgPgfplots) code += `\\usepackage{pgfplots}\n\\pgfplotsset{compat=1.18}\n`;

  if (config.pkgFancyhdr) code += `\\usepackage{fancyhdr}\n\\pagestyle{fancy}\n`;
  if (config.pkgMulticol) code += `\\usepackage{multicol}\n`;
  if (config.pkgTitlesec) code += `\\usepackage{titlesec}\n`;
  if (config.pkgMicrotype) code += `\\usepackage{microtype}\n`;
  if (config.pkgCsquotes) code += `\\usepackage{csquotes}\n`;
  if (config.pkgSiunitx) code += `\\usepackage{siunitx}\n`;

  if (config.pkgTodonotes) code += `\\usepackage{todonotes}\n`;
  
  return code;
};

export const generateLists = (config: PreambleConfig, customLists: CustomListDef[]): string => {
  if (!config.pkgEnumitem) return '';

  let code = `\\usepackage{enumitem}\n`;
  
  if (config.enumitemSep === 'nosep') code += `\\setlist{nosep}\n`;
  else if (config.enumitemSep === 'half') code += `\\setlist{itemsep=0.5ex}\n`;
  
  if (config.enumitemItemize !== 'default') {
      let label = '';
      if (config.enumitemItemize === 'dash') label = 'label={--}';
      else if (config.enumitemItemize === 'asterisk') label = 'label={*}';
      else if (config.enumitemItemize === 'bullet') label = 'label=\\textbullet';
      if (label) code += `\\setlist[itemize]{${label}}\n`;
  }

  if (config.enumitemEnumerate !== 'default') {
      let label = '';
      if (config.enumitemEnumerate === 'alph') label = 'label=\\alph*), ref=\\alph*)';
      else if (config.enumitemEnumerate === 'Alph') label = 'label=\\Alph*., ref=\\Alph*';
      else if (config.enumitemEnumerate === 'roman') label = 'label=\\roman*), ref=\\roman*)';
      else if (config.enumitemEnumerate === 'Roman') label = 'label=\\Roman*., ref=\\Roman*';
      else if (config.enumitemEnumerate === 'arabic_paren') label = 'label=(\\arabic*), ref=(\\arabic*)';
      
      if (label) code += `\\setlist[enumerate]{${label}}\n`;
  }

  if (customLists.length > 0) {
      code += `\n% --- Custom Lists ---\n`;
      customLists.forEach(l => {
          code += `\\newlist{${l.name}}{${l.baseType}}{3}\n`;
          if (l.label) code += `\\setlist[${l.name}]{label=${l.label}}\n`;
      });
  }
  return code;
};

export const generateCodeHighlighting = (
  engine: string,
  settings: {
    showNumbers: boolean; // Corrected property name
    breakLines: boolean;
    showFrame: boolean;
    lstColors: { // Corrected property name
      keyword: string;
      string: string;
      comment: string;
      background: string;
    };
    mintedStyle: string;
  }
): string => {
  if (engine === 'none') return '';

  let code = `\n% --- Code Highlighting (${engine}) ---\n`;

  if (engine === 'listings') {
      code += `\\usepackage{listings}\n`;
      // Define colors for listings
      code += `\\definecolor{codegreen}{rgb}{${hexToModelValue(settings.lstColors.comment, 'listings_rgb')}}\n`;
      code += `\\definecolor{codegray}{rgb}{0.5,0.5,0.5}\n`;
      code += `\\definecolor{codepurple}{rgb}{${hexToModelValue(settings.lstColors.string, 'listings_rgb')}}\n`;
      code += `\\definecolor{codeblue}{rgb}{${hexToModelValue(settings.lstColors.keyword, 'listings_rgb')}}\n`;
      code += `\\definecolor{backcolour}{rgb}{${hexToModelValue(settings.lstColors.background, 'listings_rgb')}}\n\n`;

      code += `\\lstdefinestyle{mystyle}{\n`;
      code += `    backgroundcolor=\\color{backcolour},\n`;
      code += `    commentstyle=\\color{codegreen},\n`;
      code += `    keywordstyle=\\color{codeblue},\n`;
      code += `    numberstyle=\\tiny\\color{codegray},\n`;
      code += `    stringstyle=\\color{codepurple},\n`;
      code += `    basicstyle=\\ttfamily\\footnotesize,\n`;
      if (settings.breakLines) code += `    breaklines=true,\n`;
      code += `    captionpos=b,\n    keepspaces=true,\n`;
      if (settings.showNumbers) code += `    numbers=left,\n    numbersep=5pt,\n`;
      if (settings.showFrame) code += `    frame=single,\n`;
      code += `    tabsize=2\n}\n`;
      code += `\\lstset{style=mystyle}\n`;
  } else if (engine === 'minted') {
      code += `\\usepackage{minted}\n`;
      code += `\\usemintedstyle{${settings.mintedStyle}}\n`;
      code += `\\setminted{\n`;
      if (settings.showNumbers) code += `    linenos,\n`;
      if (settings.breakLines) code += `    breaklines,\n`;
      if (settings.showFrame) code += `    frame=lines,\n`;
      code += `    fontsize=\\footnotesize,\n    tabsize=4\n}\n`;
  }
  
  return code;
};

export const generateFooterAndMeta = (config: PreambleConfig): string => {
  let code = '';
  
  // Hyperref usually goes last
  if (config.pkgHyperref) {
      code += `\\usepackage{hyperref}\n\\hypersetup{colorlinks=true, linkcolor=blue}\n`;
  }
  // Cleveref goes AFTER hyperref
  if (config.pkgCleveref) {
      code += `\\usepackage{cleveref}\n`;
  }

  code += `\n% --- Metadata ---\n`;
  code += `\\title{${config.title || 'Untitled'}}\n`;
  code += `\\author{${config.author || ''}}\n`;
  code += `\\date{${config.date ? '\\today' : ''}}\n`;

  return code;
};

export const generateFullPreamble = (
  config: PreambleConfig,
  customColors: CustomColorDef[],
  customLists: CustomListDef[],
  codeSettings: {
    engine: string;
    showNumbers: boolean;
    breakLines: boolean;
    showFrame: boolean;
    lstColors: { keyword: string; string: string; comment: string; background: string; };
    mintedStyle: string;
  }
): string => {
  let full = '';
  full += generateGeneral(config);
  full += generateGeometry(config);
  full += generatePackages(config, customColors, codeSettings.engine);
  full += generateLists(config, customLists);
  full += generateCodeHighlighting(codeSettings.engine, codeSettings);
  full += generateFooterAndMeta(config);
  
  full += `\n\\begin{document}\n\n\\maketitle\n\n\\section{Introduction}\n% Content here\n\n\\end{document}`;
  
  return full;
};