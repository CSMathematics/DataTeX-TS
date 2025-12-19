// Database of LaTeX Math Symbols mapped to Unicode for preview

export type SymbolCategory = 'greek' | 'operators' | 'relations' | 'arrows' | 'delimiters' | 'misc' | 'logic' | 'calculus' | 'linear_algebra';

export interface LatexSymbol {
  cmd: string;
  char: string; // Unicode representation for UI
  name?: string;
}

export const SYMBOLS_DB: Record<SymbolCategory, LatexSymbol[]> = {
  greek: [
    { cmd: '\\alpha', char: 'α' }, { cmd: '\\beta', char: 'β' }, { cmd: '\\gamma', char: 'γ' },
    { cmd: '\\delta', char: 'δ' }, { cmd: '\\epsilon', char: 'ϵ' }, { cmd: '\\zeta', char: 'ζ' },
    { cmd: '\\eta', char: 'η' }, { cmd: '\\theta', char: 'θ' }, { cmd: '\\iota', char: 'ι' },
    { cmd: '\\kappa', char: 'κ' }, { cmd: '\\lambda', char: 'λ' }, { cmd: '\\mu', char: 'μ' },
    { cmd: '\\nu', char: 'ν' }, { cmd: '\\xi', char: 'ξ' }, { cmd: '\\pi', char: 'π' },
    { cmd: '\\rho', char: 'ρ' }, { cmd: '\\sigma', char: 'σ' }, { cmd: '\\tau', char: 'τ' },
    { cmd: '\\upsilon', char: 'υ' }, { cmd: '\\phi', char: 'ϕ' }, { cmd: '\\chi', char: 'χ' },
    { cmd: '\\psi', char: 'ψ' }, { cmd: '\\omega', char: 'ω' },
    // Upper
    { cmd: '\\Gamma', char: 'Γ' }, { cmd: '\\Delta', char: 'Δ' }, { cmd: '\\Theta', char: 'Θ' },
    { cmd: '\\Lambda', char: 'Λ' }, { cmd: '\\Xi', char: 'Ξ' }, { cmd: '\\Pi', char: 'Π' },
    { cmd: '\\Sigma', char: 'Σ' }, { cmd: '\\Upsilon', char: 'Υ' }, { cmd: '\\Phi', char: 'Φ' },
    { cmd: '\\Psi', char: 'Ψ' }, { cmd: '\\Omega', char: 'Ω' }
  ],
  operators: [
    { cmd: '\\pm', char: '±' }, { cmd: '\\mp', char: '∓' }, { cmd: '\\times', char: '×' },
    { cmd: '\\cdot', char: '⋅' }, { cmd: '\\div', char: '÷' }, { cmd: '\\ast', char: '∗' },
    { cmd: '\\star', char: '★' }, { cmd: '\\circ', char: '∘' }, { cmd: '\\bullet', char: '∙' },
    { cmd: '\\oplus', char: '⊕' }, { cmd: '\\ominus', char: '⊖' }, { cmd: '\\otimes', char: '⊗' },
    { cmd: '\\oslash', char: '⊘' }, { cmd: '\\cap', char: '∩' }, { cmd: '\\cup', char: '∪' },
    { cmd: '\\vee', char: '∨' }, { cmd: '\\wedge', char: '∧' }, { cmd: '\\setminus', char: '∖' }
  ],
  relations: [
    { cmd: '\\leq', char: '≤' }, { cmd: '\\geq', char: '≥' }, { cmd: '\\equiv', char: '≡' },
    { cmd: '\\sim', char: '∼' }, { cmd: '\\simeq', char: '≃' }, { cmd: '\\approx', char: '≈' },
    { cmd: '\\cong', char: '≅' }, { cmd: '\\neq', char: '≠' }, { cmd: '\\subset', char: '⊂' },
    { cmd: '\\supset', char: '⊃' }, { cmd: '\\subseteq', char: '⊆' }, { cmd: '\\supseteq', char: '⊇' },
    { cmd: '\\in', char: '∈' }, { cmd: '\\ni', char: '∋' }, { cmd: '\\notin', char: '∉' },
    { cmd: '\\perp', char: '⊥' }, { cmd: '\\parallel', char: '∥' }
  ],
  arrows: [
    { cmd: '\\leftarrow', char: '←' }, { cmd: '\\rightarrow', char: '→' }, { cmd: '\\uparrow', char: '↑' },
    { cmd: '\\downarrow', char: '↓' }, { cmd: '\\leftrightarrow', char: '↔' }, 
    { cmd: '\\Leftarrow', char: '⇐' }, { cmd: '\\Rightarrow', char: '⇒' }, { cmd: '\\Leftrightarrow', char: '⇔' },
    { cmd: '\\mapsto', char: '↦' }, { cmd: '\\hookleftarrow', char: '↩' }, { cmd: '\\hookrightarrow', char: '↪' },
    { cmd: '\\nearrow', char: '↗' }, { cmd: '\\searrow', char: '↘' }
  ],
  delimiters: [
    { cmd: '\\{ \\}', char: '{ }' }, { cmd: '\\langle \\rangle', char: '⟨ ⟩' },
    { cmd: '\\lfloor \\rfloor', char: '⌊ ⌋' }, { cmd: '\\lceil \\rceil', char: '⌈ ⌉' },
    { cmd: '| |', char: '| |' }, { cmd: '\\| \\|', char: '‖ ‖' }
  ],
  logic: [
    { cmd: '\\forall', char: '∀' }, { cmd: '\\exists', char: '∃' }, { cmd: '\\nexists', char: '∄' },
    { cmd: '\\therefore', char: '∴' }, { cmd: '\\because', char: '∵' }, { cmd: '\\neg', char: '¬' }
  ],
  calculus: [
    { cmd: '\\int', char: '∫' }, { cmd: '\\iint', char: '∬' }, { cmd: '\\iiint', char: '∭' },
    { cmd: '\\oint', char: '∮' }, { cmd: '\\sum', char: '∑' }, { cmd: '\\prod', char: '∏' },
    { cmd: '\\coprod', char: '∐' }, { cmd: '\\lim', char: 'lim' },
    { cmd: '\\infty', char: '∞' }, { cmd: '\\to', char: '→' }, { cmd: '\\mapsto', char: '↦' },
    { cmd: '\\partial', char: '∂' }, { cmd: '\\nabla', char: '∇' }, { cmd: '\\prime', char: '′' },
    { cmd: '\\dot{}', char: 'ẋ' }, { cmd: '\\ddot{}', char: 'ẍ' }
  ],
  linear_algebra: [
    { cmd: '\\cdots', char: '⋯' }, { cmd: '\\vdots', char: '⋮' }, { cmd: '\\ddots', char: '⋱' },
    { cmd: '\\vec{}', char: 'v⃗' }, { cmd: '\\hat{}', char: 'â' }, { cmd: '\\bar{}', char: 'ā' },
    { cmd: '\\tilde{}', char: 'ã' }, { cmd: '\\mathbf{}', char: 'v' }, 
    { cmd: '\\det', char: 'det' }, { cmd: '\\dim', char: 'dim' }, { cmd: '\\ker', char: 'ker' },
    { cmd: '\\hom', char: 'hom' }, { cmd: '\\angle', char: '∠' }, { cmd: '\\triangle', char: '△' },
    { cmd: '\\perp', char: '⊥' }, { cmd: '\\parallel', char: '∥' }
  ],
  misc: [
    { cmd: '\\ell', char: 'ℓ' }, { cmd: '\\Re', char: 'ℜ' }, { cmd: '\\Im', char: 'ℑ' },
    { cmd: '\\aleph', char: 'ℵ' }, { cmd: '\\hbar', char: 'ℏ' }, { cmd: '\\emptyset', char: '∅' }
  ]
};