const isEscaped = (source: string, index: number) => {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
};

const findOutsideComments = (
  source: string,
  token: string,
  startIndex: number,
) => {
  let inComment = false;
  for (let index = startIndex; index <= source.length - token.length; index += 1) {
    const char = source[index];
    if (inComment) {
      if (char === "\n" || char === "\r") inComment = false;
      continue;
    }
    if (char === "%" && !isEscaped(source, index)) {
      inComment = true;
      continue;
    }
    if (source.startsWith(token, index)) return index;
  }
  return -1;
};

export const extractFirstTikzpicture = (source: string) => {
  const beginToken = "\\begin{tikzpicture}";
  const endToken = "\\end{tikzpicture}";
  const begin = findOutsideComments(source, beginToken, 0);
  if (begin < 0) return null;

  let depth = 1;
  let cursor = begin + beginToken.length;
  while (cursor < source.length) {
    const nextBegin = findOutsideComments(source, beginToken, cursor);
    const nextEnd = findOutsideComments(source, endToken, cursor);
    if (nextEnd < 0) return null;
    if (nextBegin >= 0 && nextBegin < nextEnd) {
      depth += 1;
      cursor = nextBegin + beginToken.length;
      continue;
    }
    depth -= 1;
    cursor = nextEnd + endToken.length;
    if (depth === 0) return source.slice(begin, cursor).trim();
  }
  return null;
};

export type StoicheiaCopySourceMode = "document" | "tikzpicture";

export const copyableStoicheiaSource = (
  source: string,
  mode: StoicheiaCopySourceMode,
) => mode === "tikzpicture" ? extractFirstTikzpicture(source) ?? source : source;
