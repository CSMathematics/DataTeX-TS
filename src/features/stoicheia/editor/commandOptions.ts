export interface TikzCommandTarget {
  command: string;
  arguments?: string;
  followedBy?: string;
}

export interface TikzCommandEntry {
  command: string;
  options: string;
  start: number;
  commandEnd: number;
  end: number;
  arguments?: string;
  argumentsEnd?: number;
}

export interface TikzCommandIndex {
  source: string;
  entries: TikzCommandEntry[];
  byCommand: Map<string, TikzCommandEntry[]>;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const readBalanced = (source: string, start: number, open: string, close: string): { content: string; end: number } | null => {
  if (source[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < source.length; index++) {
    const char = source[index];
    if (char === open) depth++;
    else if (char === close) {
      depth--;
      if (depth === 0) return { content: source.slice(start + 1, index), end: index + 1 };
    }
  }
  return null;
};

const skipWhitespace = (source: string, start: number) => {
  let index = start;
  while (/\s/.test(source[index] ?? '')) index++;
  return index;
};

export const buildTikzCommandIndex = (source: string): TikzCommandIndex => {
  const entries: TikzCommandEntry[] = [];
  const byCommand = new Map<string, TikzCommandEntry[]>();
  const pattern = /\\([A-Za-z@]+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source))) {
    const start = match.index;
    const command = match[1];
    const commandEnd = start + match[0].length;
    let cursor = commandEnd;
    let options = '';

    const optionBlock = readBalanced(source, cursor, '[', ']');
    if (optionBlock) {
      options = optionBlock.content;
      cursor = optionBlock.end;
    }

    const end = cursor;
    const argsStart = skipWhitespace(source, cursor);
    const argumentBlock = readBalanced(source, argsStart, '(', ')');
    const entry: TikzCommandEntry = {
      command,
      options,
      start,
      commandEnd,
      end,
      arguments: argumentBlock?.content,
      argumentsEnd: argumentBlock?.end,
    };

    entries.push(entry);
    const commandEntries = byCommand.get(command);
    if (commandEntries) commandEntries.push(entry);
    else byCommand.set(command, [entry]);
  }

  return { source, entries, byCommand };
};

type TikzCommandSource = string | TikzCommandIndex;

const commandIndexFor = (source: TikzCommandSource) => typeof source === 'string' ? buildTikzCommandIndex(source) : source;

const followedByMatch = (source: string, start: number, followedBy: string) => {
  const match = new RegExp(followedBy).exec(source.slice(start));
  return match?.index === 0 ? match : null;
};

const findTikzCommandEntry = (index: TikzCommandIndex, target: TikzCommandTarget): TikzCommandEntry | null => {
  const candidates = index.byCommand.get(target.command) ?? [];
  if (target.arguments !== undefined) return candidates.find(entry => entry.arguments === target.arguments) ?? null;
  if (target.followedBy) return candidates.find(entry => Boolean(followedByMatch(index.source, entry.end, target.followedBy!))) ?? null;
  return candidates[0] ?? null;
};

export const findTikzCommandRange = (source: TikzCommandSource, target: TikzCommandTarget): { start: number; end: number } | null => {
  const index = commandIndexFor(source);
  const entry = findTikzCommandEntry(index, target);
  if (!entry) return null;
  let end = target.arguments !== undefined ? entry.argumentsEnd ?? entry.end : entry.end;
  if (target.followedBy) {
    const following = followedByMatch(index.source, end, target.followedBy);
    if (following) end += following[0].length;
  }
  return { start: entry.start, end };
};

export const readTikzCommandOptions = (source: TikzCommandSource, target: TikzCommandTarget): string | null => {
  const entry = findTikzCommandEntry(commandIndexFor(source), target);
  return entry ? entry.options : null;
};

export const updateTikzCommandOptions = (source: string, target: TikzCommandTarget, options: string): string => {
  const index = buildTikzCommandIndex(source);
  const entry = findTikzCommandEntry(index, target);
  if (!entry) return source;
  const clean = options.trim();
  return `${source.slice(0, entry.commandEnd)}${clean ? `[${clean}]` : ''}${source.slice(entry.end)}`;
};

export const updateTikzBlockReferences = (
  source: string,
  targets: TikzCommandTarget[],
  replacements: Record<string, string>,
): string => {
  const index = buildTikzCommandIndex(source);
  const ranges = targets.map(target => findTikzCommandRange(index, target)).filter((range): range is { start: number; end: number } => Boolean(range));
  if (!ranges.length) return source;
  const start = Math.min(...ranges.map(range => range.start));
  const end = Math.max(...ranges.map(range => range.end));
  let block = source.slice(start, end);
  const placeholders = Object.entries(replacements).filter(([from, to]) => from && to && from !== to).map(([from, to], index) => ({ from, to, placeholder: `§${index}§` }));
  for (const { from, placeholder } of placeholders) {
    const escaped = escapeRegExp(from);
    block = block.replace(new RegExp(`(^|[^A-Za-z0-9_'])${escaped}(?=$|[^A-Za-z0-9_'])`, 'g'), (_match, prefix: string) => `${prefix}${placeholder}`);
  }
  for (const { to, placeholder } of placeholders) block = block.split(placeholder).join(to);
  return `${source.slice(0, start)}${block}${source.slice(end)}`;
};
