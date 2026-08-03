export type GlobalStyleKind = 'point' | 'line' | 'arc' | 'compass' | 'label' | 'colors';

export interface GlobalStyleConfig {
  kind: GlobalStyleKind;
  command: string;
  label: string;
  defaults: string;
}

export interface SourceStyleCommand {
  id: string;
  kind: GlobalStyleKind | 'custom';
  command: string;
  label: string;
  options: string;
  enabled: boolean;
  name?: string;
  start: number;
  end: number;
}

export const STYLE_OFF_PREFIX = '% stoicheia-style-off ';

export const GLOBAL_STYLE_CONFIGS: GlobalStyleConfig[] = [
  { kind: 'point', command: 'tkzSetUpPoint', label: 'Points', defaults: 'size=2,color=teal,fill=teal' },
  { kind: 'line', command: 'tkzSetUpLine', label: 'Lines', defaults: 'line width=.4pt,color=teal' },
  { kind: 'arc', command: 'tkzSetUpArc', label: 'Arcs', defaults: 'color=gray,line width=.4pt' },
  { kind: 'compass', command: 'tkzSetUpCompass', label: 'Compass', defaults: 'color=orange,line width=.4pt,delta=10' },
  { kind: 'label', command: 'tkzSetUpLabel', label: 'Labels', defaults: 'font=\\scriptsize,color=teal' },
  { kind: 'colors', command: 'tkzSetUpColors', label: 'Document colors', defaults: 'background=white,text=black' },
];

export const GLOBAL_STYLE_COMMANDS = Object.fromEntries(
  GLOBAL_STYLE_CONFIGS.map(config => [config.kind, config.command]),
) as Record<GlobalStyleKind, string>;

export const GLOBAL_STYLE_DEFAULTS = Object.fromEntries(
  GLOBAL_STYLE_CONFIGS.map(config => [config.kind, config.defaults]),
) as Record<GlobalStyleKind, string>;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildGlobalStyleCommand = (kind: GlobalStyleKind, options: string) => {
  const command = GLOBAL_STYLE_COMMANDS[kind];
  const clean = options.trim();
  return `\\${command}${clean ? `[${clean}]` : ''}`;
};

export const buildCustomStyleCommand = (name: string, options: string) => {
  const cleanName = name.trim();
  const cleanOptions = options.trim();
  return `\\tkzSetUpStyle${cleanOptions ? `[${cleanOptions}]` : ''}{${cleanName}}`;
};

const commandLine = (command: string, enabled: boolean) => enabled ? command : `${STYLE_OFF_PREFIX}${command}`;

const insertStyleLine = (source: string, command: string, enabled = true) => {
  const line = commandLine(command, enabled);
  const beginMatch = /\\begin\{tikzpicture\}(?:\[[^\]\n]*\])?/.exec(source);
  if (!beginMatch) return `${line}\n${source}`;
  const insertionPoint = beginMatch.index + beginMatch[0].length;
  if (source[insertionPoint] === '\n') {
    return `${source.slice(0, insertionPoint + 1)}${line}\n${source.slice(insertionPoint + 1)}`;
  }
  return `${source.slice(0, insertionPoint)}\n${line}\n${source.slice(insertionPoint)}`;
};

const replaceMatch = (source: string, match: RegExpExecArray, command: string, enabled: boolean) => {
  const prefix = match[1] ?? '';
  const indent = match[2] ?? '';
  const replacement = `${prefix}${indent}${commandLine(command, enabled)}`;
  return `${source.slice(0, match.index)}${replacement}${source.slice(match.index + match[0].length)}`;
};

const setupRegex = (kind: GlobalStyleKind) => new RegExp(
  `(^|\\n)([ \\t]*)(%[ \\t]*stoicheia-style-off[ \\t]*)?\\\\${GLOBAL_STYLE_COMMANDS[kind]}[ \\t]*(?:\\[([^\\]\\n]*)\\])?[ \\t]*(?=\\r?\\n|$)`,
  'g',
);

const customRegex = (name?: string) => new RegExp(
  `(^|\\n)([ \\t]*)(%[ \\t]*stoicheia-style-off[ \\t]*)?\\\\tkzSetUpStyle[ \\t]*(?:\\[([^\\]\\n]*)\\])?[ \\t]*\\{${name ? escapeRegExp(name) : '([^}\\n]+)'}\\}[ \\t]*(?=\\r?\\n|$)`,
  'g',
);

export const parseStyleCommands = (source: string): SourceStyleCommand[] => {
  const commands: SourceStyleCommand[] = [];

  for (const config of GLOBAL_STYLE_CONFIGS) {
    const regex = setupRegex(config.kind);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source))) {
      commands.push({
        id: `global-${config.kind}`,
        kind: config.kind,
        command: config.command,
        label: config.label,
        options: match[4]?.trim() ?? '',
        enabled: !match[3],
        start: match.index + (match[1]?.length ?? 0),
        end: match.index + match[0].length,
      });
    }
  }

  const regex = customRegex();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source))) {
    const name = match[5]?.trim() ?? '';
    commands.push({
      id: `custom-${name}`,
      kind: 'custom',
      command: 'tkzSetUpStyle',
      label: name,
      name,
      options: match[4]?.trim() ?? '',
      enabled: !match[3],
      start: match.index + (match[1]?.length ?? 0),
      end: match.index + match[0].length,
    });
  }

  return commands.sort((first, second) => first.start - second.start);
};

export const findGlobalStyle = (source: string, kind: GlobalStyleKind) => (
  parseStyleCommands(source).find(command => command.kind === kind)
);

export const findCustomStyle = (source: string, name: string) => (
  parseStyleCommands(source).find(command => command.kind === 'custom' && command.name === name.trim())
);

export const upsertGlobalStyleInSource = (source: string, kind: GlobalStyleKind, options: string, enabled?: boolean) => {
  const command = buildGlobalStyleCommand(kind, options);
  const match = setupRegex(kind).exec(source);
  if (!match) return insertStyleLine(source, command, enabled ?? true);
  return replaceMatch(source, match, command, enabled ?? !match[3]);
};

export const toggleGlobalStyleInSource = (source: string, kind: GlobalStyleKind, enabled: boolean) => {
  const current = findGlobalStyle(source, kind);
  if (!current) return enabled ? insertStyleLine(source, buildGlobalStyleCommand(kind, GLOBAL_STYLE_DEFAULTS[kind]), true) : source;
  return upsertGlobalStyleInSource(source, kind, current.options, enabled);
};

export const removeGlobalStyleFromSource = (source: string, kind: GlobalStyleKind) => {
  const match = setupRegex(kind).exec(source);
  return match ? `${source.slice(0, match.index)}${match[1] ?? ''}${source.slice(match.index + match[0].length)}` : source;
};

export const upsertCustomStyleInSource = (source: string, name: string, options: string, enabled?: boolean) => {
  const cleanName = name.trim();
  if (!cleanName) return source;
  const command = buildCustomStyleCommand(cleanName, options);
  const match = customRegex(cleanName).exec(source);
  if (!match) return insertStyleLine(source, command, enabled ?? true);
  return replaceMatch(source, match, command, enabled ?? !match[3]);
};

export const toggleCustomStyleInSource = (source: string, name: string, enabled: boolean) => {
  const current = findCustomStyle(source, name);
  if (!current) return source;
  return upsertCustomStyleInSource(source, name, current.options, enabled);
};

export const removeCustomStyleFromSource = (source: string, name: string) => {
  const match = customRegex(name.trim()).exec(source);
  return match ? `${source.slice(0, match.index)}${match[1] ?? ''}${source.slice(match.index + match[0].length)}` : source;
};
