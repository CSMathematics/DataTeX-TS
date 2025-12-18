export const DOCUMENT_TEMPLATES = [
  {
    id: 'article',
    name: 'Simple Article',
    description: 'A standard article format with title and sections.',
    code: `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}

\\title{My Article}
\\author{Author Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}
Start typing here...

\\end{document}`
  },
  {
    id: 'beamer',
    name: 'Presentation (Beamer)',
    description: 'Slides for presentations.',
    code: `\\documentclass{beamer}
\\usepackage[utf8]{inputenc}
\\usetheme{Madrid}

\\title{My Presentation}
\\author{Author Name}
\\date{\\today}

\\begin{document}

\\frame{\\titlepage}

\\begin{frame}
\\frametitle{Sample Frame}
This is a slide.
\\end{frame}

\\end{document}`
  },
  {
    id: 'book',
    name: 'Book',
    description: 'A book structure with chapters.',
    code: `\\documentclass{book}
\\usepackage[utf8]{inputenc}

\\title{My Book}
\\author{Author Name}
\\date{\\today}

\\begin{document}

\\maketitle
\\tableofcontents

\\chapter{First Chapter}
Text goes here...

\\end{document}`
  },
  {
    id: 'letter',
    name: 'Letter',
    description: 'Formal letter format.',
    code: `\\documentclass{letter}
\\signature{Your Name}
\\address{Your Address \\\\ City, State}

\\begin{document}

\\begin{letter}{Recipient Name \\\\ Address}
\\opening{Dear Sir or Madam,}

The body of the letter...

\\closing{Sincerely,}
\\end{letter}

\\end{document}`
  }
];