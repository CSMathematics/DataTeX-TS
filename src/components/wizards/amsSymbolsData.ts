
export interface SymbolItem {
  name: string;
  command: string;
  package?: string;
  mode?: 'math' | 'text'; // defaults to math
}

export interface SymbolCategory {
  id: string;
  label: string;
  symbols: SymbolItem[];
}

export const AMS_SYMBOLS_DATA: SymbolCategory[] = [
  {
    id: 'integrals',
    label: 'Integrals',
    symbols: [
      { name: 'Integral', command: '\\int' },
      { name: 'Double Integral', command: '\\iint' },
      { name: 'Triple Integral', command: '\\iiint' },
      { name: 'Quadruple Integral', command: '\\iiiint' }, // esint or similar, but often available or composed
      { name: 'Oint', command: '\\oint' },
      { name: 'Dots Integral', command: '\\idotsint' },
    ]
  },
  {
    id: 'sums_products',
    label: 'Sums & Products',
    symbols: [
      { name: 'Sum', command: '\\sum' },
      { name: 'Product', command: '\\prod' },
      { name: 'Coproduct', command: '\\coprod' },
      { name: 'Limit', command: '\\lim' },
    ]
  },
  {
    id: 'arrows',
    label: 'Arrows',
    symbols: [
      { name: 'Left Arrow', command: '\\leftarrow' },
      { name: 'Right Arrow', command: '\\rightarrow' },
      { name: 'Left Right Arrow', command: '\\leftrightarrow' },
      { name: 'Up Arrow', command: '\\uparrow' },
      { name: 'Down Arrow', command: '\\downarrow' },
      { name: 'Up Down Arrow', command: '\\updownarrow' },
      { name: 'Left Double Arrow', command: '\\Leftarrow' },
      { name: 'Right Double Arrow', command: '\\Rightarrow' },
      { name: 'Left Right Double Arrow', command: '\\Leftrightarrow' },
      { name: 'Up Double Arrow', command: '\\Uparrow' },
      { name: 'Down Double Arrow', command: '\\Downarrow' },
      { name: 'Up Down Double Arrow', command: '\\Updownarrow' },
      { name: 'Mapsto', command: '\\mapsto' },
      { name: 'Long Mapsto', command: '\\longmapsto' },
      { name: 'Nearrow', command: '\\nearrow' },
      { name: 'Searrow', command: '\\searrow' },
      { name: 'Swarrow', command: '\\swarrow' },
      { name: 'Nwarrow', command: '\\nwarrow' },
      { name: 'Left Harpoon Up', command: '\\leftharpoonup' },
      { name: 'Right Harpoon Up', command: '\\rightharpoonup' },
      { name: 'Left Harpoon Down', command: '\\leftharpoondown' },
      { name: 'Right Harpoon Down', command: '\\rightharpoondown' },
    ]
  },
  {
    id: 'delimiters',
    label: 'Delimiters',
    symbols: [
      { name: 'Parentheses', command: '()' }, // Special handling might be needed or just insert chars
      { name: 'Square Brackets', command: '[]' },
      { name: 'Curly Braces', command: '\\{ \\}' },
      { name: 'Angle Brackets', command: '\\langle \\rangle' },
      { name: 'Pipes', command: '| |' },
      { name: 'Double Pipes', command: '\\| \\|' },
      { name: 'Floor', command: '\\lfloor \\rfloor' },
      { name: 'Ceiling', command: '\\lceil \\rceil' },
    ]
  },
  {
    id: 'greek',
    label: 'Greek Letters',
    symbols: [
      { name: 'alpha', command: '\\alpha' },
      { name: 'beta', command: '\\beta' },
      { name: 'gamma', command: '\\gamma' },
      { name: 'Gamma', command: '\\Gamma' },
      { name: 'delta', command: '\\delta' },
      { name: 'Delta', command: '\\Delta' },
      { name: 'epsilon', command: '\\epsilon' },
      { name: 'varepsilon', command: '\\varepsilon' },
      { name: 'zeta', command: '\\zeta' },
      { name: 'eta', command: '\\eta' },
      { name: 'theta', command: '\\theta' },
      { name: 'vartheta', command: '\\vartheta' },
      { name: 'Theta', command: '\\Theta' },
      { name: 'iota', command: '\\iota' },
      { name: 'kappa', command: '\\kappa' },
      { name: 'lambda', command: '\\lambda' },
      { name: 'Lambda', command: '\\Lambda' },
      { name: 'mu', command: '\\mu' },
      { name: 'nu', command: '\\nu' },
      { name: 'xi', command: '\\xi' },
      { name: 'Xi', command: '\\Xi' },
      { name: 'pi', command: '\\pi' },
      { name: 'Pi', command: '\\Pi' },
      { name: 'rho', command: '\\rho' },
      { name: 'varrho', command: '\\varrho' },
      { name: 'sigma', command: '\\sigma' },
      { name: 'Sigma', command: '\\Sigma' },
      { name: 'tau', command: '\\tau' },
      { name: 'upsilon', command: '\\upsilon' },
      { name: 'Upsilon', command: '\\Upsilon' },
      { name: 'phi', command: '\\phi' },
      { name: 'varphi', command: '\\varphi' },
      { name: 'Phi', command: '\\Phi' },
      { name: 'chi', command: '\\chi' },
      { name: 'psi', command: '\\psi' },
      { name: 'Psi', command: '\\Psi' },
      { name: 'omega', command: '\\omega' },
      { name: 'Omega', command: '\\Omega' },
    ]
  },
  {
    id: 'binary_relations',
    label: 'Binary & Relations',
    symbols: [
        { name: 'Times', command: '\\times' },
        { name: 'Cdot', command: '\\cdot' },
        { name: 'Div', command: '\\div' },
        { name: 'Cap', command: '\\cap' },
        { name: 'Cup', command: '\\cup' },
        { name: 'Neq', command: '\\neq' },
        { name: 'Leq', command: '\\leq' },
        { name: 'Geq', command: '\\geq' },
        { name: 'In', command: '\\in' },
        { name: 'Not In', command: '\\notin' },
        { name: 'Subset', command: '\\subset' },
        { name: 'Perp', command: '\\perp' },
        { name: 'Simeq', command: '\\simeq' },
        { name: 'Approx', command: '\\approx' },
        { name: 'Wedge', command: '\\wedge' },
        { name: 'Vee', command: '\\vee' },
        { name: 'Oplus', command: '\\oplus' },
        { name: 'Otimes', command: '\\otimes' },
        { name: 'Box', command: '\\Box' },
        { name: 'Boxtimes', command: '\\boxtimes' },
        { name: 'Equiv', command: '\\equiv' },
        { name: 'Cong', command: '\\cong' },
    ]
  },
  {
    id: 'misc',
    label: 'Miscellaneous',
    symbols: [
        { name: 'Infinity', command: '\\infty' },
        { name: 'Forall', command: '\\forall' },
        { name: 'Exists', command: '\\exists' },
        { name: 'Not Exists', command: '\\nexists' },
        { name: 'Nabla', command: '\\nabla' },
        { name: 'Partial', command: '\\partial' },
        { name: 'Empty Set', command: '\\emptyset' },
        { name: 'Varnothing', command: '\\varnothing' },
        { name: 'Re', command: '\\Re' },
        { name: 'Im', command: '\\Im' },
        { name: 'Wp', command: '\\wp' },
        { name: 'Complement', command: '\\complement' },
        { name: 'Neg', command: '\\neg' },
        { name: 'Square', command: '\\square' },
        { name: 'Blacksquare', command: '\\blacksquare' },
        { name: 'Triangle', command: '\\triangle' },
        { name: 'Surd', command: '\\surd' },
    ]
  }
];
