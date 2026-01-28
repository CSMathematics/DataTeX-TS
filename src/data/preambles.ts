export interface PreambleTemplate {
  id: string;
  label: string;
  description: string;
  content: string;
}

export const BUILTIN_PREAMBLES: PreambleTemplate[] = [
  {
    id: "builtin:article",
    label: "Article (Standard)",
    description:
      "Standard article class with common packages for math and graphics",
    content: `\\documentclass[11pt,a4paper,modern]{FFExercises}
\\usepackage[english,greek]{babel}
\\usepackage[utf8]{inputenc}
\\usepackage{nimbusserif}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath}
\\let\\myBbbk\\Bbbk
\\let\\Bbbk\\relax
\\usepackage[amsbb,subscriptcorrection,zswash,mtpcal,mtphrb,mtpfrak]{mtpro2}
\\usepackage{graphicx,multicol,multirow,enumitem,tabularx,mathimatika,gensymb,venndiagram,hhline,longtable,tkz-euclide,fontawesome5,eurosym,tcolorbox,tabularray,tikzpagenodes,relsize}
`,
  },
  {
    id: "builtin:book",
    label: "Book",
    description: "Standard book class for longer documents",
    content: `\\documentclass{book}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usepackage{makeidx}
`,
  },
  {
    id: "builtin:standalone",
    label: "Standalone (TikZ/Figures)",
    description: "Minimal class for compiling figures and diagrams",
    content: `\\documentclass[tikz,border=10pt]{standalone}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{pgfplots}
\\pgfplotsset{compat=1.18}
`,
  },
  {
    id: "builtin:beamer",
    label: "Beamer (Presentation)",
    description: "For creating presentation slides",
    content: `\\documentclass{beamer}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{hyperref}
\\usetheme{Madrid}
`,
  },
];

export const getPreambleContent = (id: string): string | undefined => {
  return BUILTIN_PREAMBLES.find((p) => p.id === id)?.content;
};
