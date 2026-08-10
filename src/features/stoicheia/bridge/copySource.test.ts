import { describe, expect, it } from "vitest";
import {
  copyableStoicheiaSource,
  extractFirstTikzpicture,
} from "./copySource";

describe("copyable Stoicheia source", () => {
  it("extracts the first complete TikZ environment from a document", () => {
    const source = String.raw`\documentclass{article}
\begin{document}
\begin{tikzpicture}[scale=2]
  \tkzDefPoint(0,0){A}
\end{tikzpicture}
\end{document}`;

    expect(extractFirstTikzpicture(source)).toBe(String.raw`\begin{tikzpicture}[scale=2]
  \tkzDefPoint(0,0){A}
\end{tikzpicture}`);
  });

  it("ignores TikZ markers inside LaTeX comments", () => {
    const source = String.raw`% \begin{tikzpicture}
% \end{tikzpicture}
\begin{tikzpicture}
\draw (0,0) -- (1,1); % \end{tikzpicture}
\end{tikzpicture}`;

    expect(extractFirstTikzpicture(source)).toContain("\\draw (0,0)");
  });

  it("keeps the full source in document mode", () => {
    const source = "\\documentclass{article}";
    expect(copyableStoicheiaSource(source, "document")).toBe(source);
  });
});
