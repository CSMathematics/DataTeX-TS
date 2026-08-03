import postcss from "postcss";

export const STOICHEIA_SCOPE = ".stoicheia-scope";
export const STOICHEIA_KEYFRAME_PREFIX = "stoicheia-";
export const STOICHEIA_LAYER_PREFIX = "stoicheia-";
export const STOICHEIA_TAILWIND_PROPERTY_PREFIX = "--stoicheia-tw-";

const TAILWIND_CUSTOM_PROPERTY_PATTERN = /--tw-[-_a-zA-Z0-9]+/g;
const STOICHEIA_TAILWIND_PROPERTY_PATTERN =
  /--stoicheia-tw-[-_a-zA-Z0-9]+/g;

const FORBIDDEN_AT_RULES = new Set([
  "custom-selector",
  "import",
  "namespace",
  "page",
  "scope",
]);

const GLOBAL_DEFINITION_AT_RULES = new Set([
  "counter-style",
  "font-face",
  "font-feature-values",
  "keyframes",
  "layer",
  "property",
  "-moz-keyframes",
  "-o-keyframes",
  "-webkit-keyframes",
]);

export class StoicheiaCssScopeError extends Error {
  constructor(message, node) {
    const location = node?.source?.start
      ? ` (${node.source.start.line}:${node.source.start.column})`
      : "";
    super(`${message}${location}`);
    this.name = "StoicheiaCssScopeError";
  }
}

function isKeyframesAtRule(node) {
  return (
    node?.type === "atrule" &&
    /(?:^|-)keyframes$/i.test(node.name)
  );
}

function isInsideKeyframes(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (isKeyframesAtRule(parent)) {
      return true;
    }
  }
  return false;
}

function parseKeyframeName(atRule) {
  const value = atRule.params.trim();
  const quote = value[0];

  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    return {
      name: value.slice(1, -1),
      quote,
    };
  }

  if (!/^[-_a-zA-Z][-_a-zA-Z0-9]*$/.test(value)) {
    throw new StoicheiaCssScopeError(
      `Unsupported @${atRule.name} name "${atRule.params}".`,
      atRule,
    );
  }

  return {
    name: value,
    quote: "",
  };
}

function replaceAnimationNames(value, nameMap) {
  let output = "";

  for (let index = 0; index < value.length;) {
    const character = value[index];

    if (character === '"' || character === "'") {
      const quote = character;
      let end = index + 1;
      let escaped = false;

      for (; end < value.length; end += 1) {
        const next = value[end];
        if (escaped) {
          escaped = false;
          continue;
        }
        if (next === "\\") {
          escaped = true;
          continue;
        }
        if (next === quote) {
          break;
        }
      }

      const contents = value.slice(index + 1, end);
      const replacement = nameMap.get(contents) ?? contents;
      output += `${quote}${replacement}${end < value.length ? quote : ""}`;
      index = Math.min(end + 1, value.length);
      continue;
    }

    if (/[-_a-zA-Z]/.test(character)) {
      let end = index + 1;
      while (end < value.length && /[-_a-zA-Z0-9]/.test(value[end])) {
        end += 1;
      }
      const identifier = value.slice(index, end);
      output += nameMap.get(identifier) ?? identifier;
      index = end;
      continue;
    }

    output += character;
    index += 1;
  }

  return output;
}

function extractCustomPropertyReferences(value) {
  const references = [];
  const pattern = /var\(\s*(--[-_a-zA-Z0-9]+)/g;
  for (const match of value.matchAll(pattern)) {
    references.push(match[1]);
  }
  return references;
}

function replaceTailwindCustomProperties(value) {
  return value.replace(
    TAILWIND_CUSTOM_PROPERTY_PATTERN,
    (property) =>
      `${STOICHEIA_TAILWIND_PROPERTY_PREFIX}${property.slice("--tw-".length)}`,
  );
}

function extractIdentifiers(value, pattern) {
  return [...value.matchAll(pattern)].map((match) => match[0]);
}

function parseLayerNames(atRule) {
  const params = atRule.params.trim();
  if (!params) {
    return [];
  }

  return params.split(",").map((rawName) => {
    const name = rawName.trim();
    const segments = name.split(".");

    if (
      !name ||
      segments.some(
        (segment) => !/^[-_a-zA-Z][-_a-zA-Z0-9]*$/.test(segment),
      )
    ) {
      throw new StoicheiaCssScopeError(
        `Unsupported @layer name "${rawName}".`,
        atRule,
      );
    }

    return {
      name,
      segments,
    };
  });
}

function namespaceCascadeLayers(root) {
  root.walkAtRules("layer", (atRule) => {
    const layers = parseLayerNames(atRule);
    if (layers.length === 0) {
      return;
    }

    atRule.params = layers
      .map(({ segments }) => {
        const [owner, ...children] = segments;
        const namespacedOwner = owner.startsWith(STOICHEIA_LAYER_PREFIX)
          ? owner
          : `${STOICHEIA_LAYER_PREFIX}${owner}`;
        return [namespacedOwner, ...children].join(".");
      })
      .join(", ");
  });
}

function namespaceTailwindCustomProperties(root) {
  root.walkAtRules((atRule) => {
    atRule.params = replaceTailwindCustomProperties(atRule.params);
  });

  root.walkRules((rule) => {
    rule.selector = replaceTailwindCustomProperties(rule.selector);
  });

  root.walkDecls((declaration) => {
    declaration.prop = replaceTailwindCustomProperties(declaration.prop);
    declaration.value = replaceTailwindCustomProperties(declaration.value);
  });
}

function unwrapCssString(value) {
  const normalized = value.trim();
  const quote = normalized[0];
  if (
    (quote === '"' || quote === "'") &&
    normalized.endsWith(quote)
  ) {
    return normalized.slice(1, -1);
  }
  return normalized;
}

function hasStoicheiaGlobalName(value) {
  return /^stoicheia(?:$|[-_ ])/i.test(unwrapCssString(value));
}

function findUnnamespacedGlobalDefinition(atRule) {
  const name = atRule.name.toLowerCase();

  if (isKeyframesAtRule(atRule)) {
    const keyframe = parseKeyframeName(atRule);
    return keyframe.name.startsWith(STOICHEIA_KEYFRAME_PREFIX)
      ? null
      : keyframe.name;
  }

  if (name === "property") {
    const property = atRule.params.trim();
    return property.startsWith("--stoicheia-") ? null : property;
  }

  if (name === "counter-style") {
    const counterStyle = atRule.params.trim();
    return counterStyle.startsWith(STOICHEIA_KEYFRAME_PREFIX)
      ? null
      : counterStyle;
  }

  if (name === "font-face") {
    const familyDeclaration = atRule.nodes?.find(
      (node) =>
        node.type === "decl" &&
        node.prop.toLowerCase() === "font-family",
    );
    if (!familyDeclaration) {
      return "<missing font-family>";
    }
    return hasStoicheiaGlobalName(familyDeclaration.value)
      ? null
      : familyDeclaration.value;
  }

  if (name === "font-feature-values") {
    return hasStoicheiaGlobalName(atRule.params)
      ? null
      : atRule.params.trim();
  }

  return null;
}

function namespaceKeyframes(root) {
  const nameMap = new Map();
  const definitions = [];
  const namespacedOwners = new Map();

  root.walkAtRules((atRule) => {
    if (!isKeyframesAtRule(atRule)) {
      return;
    }

    const parsed = parseKeyframeName(atRule);
    const namespaced = parsed.name.startsWith(STOICHEIA_KEYFRAME_PREFIX)
      ? parsed.name
      : `${STOICHEIA_KEYFRAME_PREFIX}${parsed.name}`;
    const existingOwner = namespacedOwners.get(namespaced);

    if (existingOwner && existingOwner !== parsed.name) {
      throw new StoicheiaCssScopeError(
        `Keyframe names "${existingOwner}" and "${parsed.name}" both map to "${namespaced}".`,
        atRule,
      );
    }

    namespacedOwners.set(namespaced, parsed.name);
    nameMap.set(parsed.name, namespaced);
    definitions.push({
      atRule,
      quote: parsed.quote,
      namespaced,
    });
  });

  if (definitions.length === 0) {
    return;
  }

  const animationVariables = new Set();

  root.walkDecls((declaration) => {
    if (/^(?:-[a-z]+-)?animation(?:-name)?$/i.test(declaration.prop)) {
      for (const property of extractCustomPropertyReferences(declaration.value)) {
        animationVariables.add(property);
      }
    }
  });

  let discoveredVariable = true;
  while (discoveredVariable) {
    discoveredVariable = false;
    root.walkDecls((declaration) => {
      if (!animationVariables.has(declaration.prop)) {
        return;
      }
      for (const property of extractCustomPropertyReferences(declaration.value)) {
        if (!animationVariables.has(property)) {
          animationVariables.add(property);
          discoveredVariable = true;
        }
      }
    });
  }

  for (const definition of definitions) {
    definition.atRule.params = definition.quote
      ? `${definition.quote}${definition.namespaced}${definition.quote}`
      : definition.namespaced;
  }

  root.walkDecls((declaration) => {
    if (
      /^(?:-[a-z]+-)?animation(?:-name)?$/i.test(declaration.prop) ||
      animationVariables.has(declaration.prop)
    ) {
      declaration.value = replaceAnimationNames(declaration.value, nameMap);
    }
  });
}

export function splitSelectorList(selector) {
  const selectors = [];
  let start = 0;
  let squareDepth = 0;
  let roundDepth = 0;
  let quote = null;
  let escaped = false;

  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character === "[") {
      squareDepth += 1;
      continue;
    }

    if (character === "]") {
      squareDepth = Math.max(0, squareDepth - 1);
      continue;
    }

    if (character === "(") {
      roundDepth += 1;
      continue;
    }

    if (character === ")") {
      roundDepth = Math.max(0, roundDepth - 1);
      continue;
    }

    if (character === "," && squareDepth === 0 && roundDepth === 0) {
      selectors.push(selector.slice(start, index).trim());
      start = index + 1;
    }
  }

  selectors.push(selector.slice(start).trim());

  if (selectors.some((item) => item.length === 0)) {
    throw new StoicheiaCssScopeError(
      `Invalid empty selector in "${selector}".`,
    );
  }

  return selectors;
}

function readLeadingCompound(selector) {
  let squareDepth = 0;
  let roundDepth = 0;
  let quote = null;
  let escaped = false;
  let compoundEnd = selector.length;

  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character === "[") {
      squareDepth += 1;
      continue;
    }

    if (character === "]") {
      squareDepth = Math.max(0, squareDepth - 1);
      continue;
    }

    if (character === "(") {
      roundDepth += 1;
      continue;
    }

    if (character === ")") {
      roundDepth = Math.max(0, roundDepth - 1);
      continue;
    }

    if (
      squareDepth === 0 &&
      roundDepth === 0 &&
      (/\s/.test(character) || character === ">" || character === "+" || character === "~")
    ) {
      compoundEnd = index;
      break;
    }
  }

  const compound = selector.slice(0, compoundEnd);
  let separatorEnd = compoundEnd;

  while (separatorEnd < selector.length && /\s/.test(selector[separatorEnd])) {
    separatorEnd += 1;
  }

  if (
    separatorEnd < selector.length &&
    (selector[separatorEnd] === ">" ||
      selector[separatorEnd] === "+" ||
      selector[separatorEnd] === "~")
  ) {
    separatorEnd += 1;
    while (separatorEnd < selector.length && /\s/.test(selector[separatorEnd])) {
      separatorEnd += 1;
    }
  }

  return {
    compound,
    separator: selector.slice(compoundEnd, separatorEnd),
    rest: selector.slice(separatorEnd),
  };
}

function startsWithToken(compound, token) {
  if (!compound.startsWith(token)) {
    return false;
  }

  const next = compound[token.length];
  return (
    next === undefined ||
    next === "." ||
    next === "#" ||
    next === ":" ||
    next === "["
  );
}

function readLeadingDataThemeAttribute(compound) {
  if (!compound.startsWith("[")) {
    return null;
  }

  let quote = null;
  let escaped = false;
  let end = -1;

  for (let index = 1; index < compound.length; index += 1) {
    const character = compound[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character === "]") {
      end = index;
      break;
    }
  }

  if (end === -1) {
    return null;
  }

  const contents = compound.slice(1, end);
  if (!/^\s*data-theme(?:\s*$|\s*[~|^$*]?=)/i.test(contents)) {
    return null;
  }

  return {
    suffix: compound,
  };
}

function getScopeAnchor(compound) {
  if (startsWithToken(compound, ":root")) {
    return { suffix: compound.slice(":root".length) };
  }

  // Tailwind v4 emits its theme variables for `:root, :host`. In the
  // embedded build both document-level owners map to the same local root.
  if (startsWithToken(compound, ":host")) {
    return { suffix: compound.slice(":host".length) };
  }

  if (startsWithToken(compound, "#root")) {
    return { suffix: compound.slice("#root".length) };
  }

  if (startsWithToken(compound, "html")) {
    return { suffix: compound.slice("html".length) };
  }

  if (startsWithToken(compound, "body")) {
    return { suffix: compound.slice("body".length) };
  }

  return readLeadingDataThemeAttribute(compound);
}

function startsWithScope(selector, scope) {
  if (!selector.startsWith(scope)) {
    return false;
  }

  const next = selector[scope.length];
  return (
    next === undefined ||
    /\s/.test(next) ||
    next === ">" ||
    next === "+" ||
    next === "~" ||
    next === "." ||
    next === "#" ||
    next === ":" ||
    next === "["
  );
}

function containsUnsupportedRootAnchor(selector) {
  return (
    /:root\b/.test(selector) ||
    /:host\b/.test(selector) ||
    /#root(?=$|[\s>+~.#:[,)])/.test(selector) ||
    /(^|[\s>+~,(])(?:html|body)(?=$|[\s>+~.#:[,)])/.test(selector)
  );
}

function containsUnescapedNestingAmpersand(selector) {
  let quote = null;
  let squareDepth = 0;
  let escaped = false;

  for (const character of selector) {
    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (character === "[") {
      squareDepth += 1;
      continue;
    }

    if (character === "]") {
      squareDepth = Math.max(0, squareDepth - 1);
      continue;
    }

    if (character === "&" && squareDepth === 0) {
      return true;
    }
  }

  return false;
}

export function scopeSelector(selector, scope = STOICHEIA_SCOPE) {
  const normalized = selector.trim();

  if (!normalized) {
    throw new StoicheiaCssScopeError("Cannot scope an empty selector.");
  }

  if (normalized.includes(":global(") || /(^|[^-\\w]):global\b/.test(normalized)) {
    throw new StoicheiaCssScopeError(
      `CSS Modules :global() would escape the Stoicheia boundary: "${normalized}".`,
    );
  }

  if (containsUnescapedNestingAmpersand(normalized)) {
    throw new StoicheiaCssScopeError(
      `Uncompiled nested selector is not supported: "${normalized}".`,
    );
  }

  if (startsWithScope(normalized, scope)) {
    return normalized;
  }

  let remaining = normalized;
  let scopeSuffix = "";
  let foundAnchor = false;

  while (remaining) {
    const leading = readLeadingCompound(remaining);
    const anchor = getScopeAnchor(leading.compound);

    if (!anchor) {
      break;
    }

    foundAnchor = true;
    scopeSuffix += anchor.suffix;

    if (!leading.rest) {
      remaining = "";
      break;
    }

    const next = readLeadingCompound(leading.rest);
    if (getScopeAnchor(next.compound)) {
      remaining = leading.rest;
      continue;
    }

    return `${scope}${scopeSuffix}${leading.separator}${leading.rest}`;
  }

  if (foundAnchor) {
    return `${scope}${scopeSuffix}`;
  }

  if (containsUnsupportedRootAnchor(normalized)) {
    throw new StoicheiaCssScopeError(
      `A document root anchor must be the leading selector compound: "${normalized}".`,
    );
  }

  return `${scope} ${normalized}`;
}

export function findScopeLeaks(root, scope = STOICHEIA_SCOPE) {
  const leaks = [];

  root.walkAtRules((atRule) => {
    if (FORBIDDEN_AT_RULES.has(atRule.name.toLowerCase())) {
      leaks.push({
        kind: "at-rule",
        value: `@${atRule.name} ${atRule.params}`.trim(),
        line: atRule.source?.start?.line ?? null,
      });
    }
  });

  root.walkRules((rule) => {
    if (isInsideKeyframes(rule)) {
      return;
    }

    let selectors;
    try {
      selectors = splitSelectorList(rule.selector);
    } catch (error) {
      leaks.push({
        kind: "selector",
        value: rule.selector,
        line: rule.source?.start?.line ?? null,
        reason: error.message,
      });
      return;
    }

    for (const selector of selectors) {
      if (!startsWithScope(selector, scope)) {
        leaks.push({
          kind: "selector",
          value: selector,
          line: rule.source?.start?.line ?? null,
        });
      }
    }
  });

  return leaks;
}

export function findGlobalNamespaceLeaks(root) {
  const leaks = [];

  root.walkAtRules((atRule) => {
    const atRuleName = atRule.name.toLowerCase();
    const unnamespacedDefinition =
      findUnnamespacedGlobalDefinition(atRule);

    if (unnamespacedDefinition !== null) {
      leaks.push({
        kind: atRuleName,
        value: unnamespacedDefinition,
        line: atRule.source?.start?.line ?? null,
      });
    }

    if (atRuleName === "layer") {
      for (const { name, segments } of parseLayerNames(atRule)) {
        if (!segments[0].startsWith(STOICHEIA_LAYER_PREFIX)) {
          leaks.push({
            kind: "layer",
            value: name,
            line: atRule.source?.start?.line ?? null,
          });
        }
      }
    }

    for (const property of extractIdentifiers(
      atRule.params,
      TAILWIND_CUSTOM_PROPERTY_PATTERN,
    )) {
      leaks.push({
        kind: "tailwind-custom-property",
        value: property,
        line: atRule.source?.start?.line ?? null,
      });
    }
  });

  root.walkRules((rule) => {
    for (const property of extractIdentifiers(
      rule.selector,
      TAILWIND_CUSTOM_PROPERTY_PATTERN,
    )) {
      leaks.push({
        kind: "tailwind-custom-property",
        value: property,
        line: rule.source?.start?.line ?? null,
      });
    }
  });

  root.walkDecls((declaration) => {
    for (const property of extractIdentifiers(
      `${declaration.prop} ${declaration.value}`,
      TAILWIND_CUSTOM_PROPERTY_PATTERN,
    )) {
      leaks.push({
        kind: "tailwind-custom-property",
        value: property,
        line: declaration.source?.start?.line ?? null,
      });
    }
  });

  return leaks;
}

export function auditCss(css, options = {}) {
  const {
    from = "<stoicheia-css>",
    scope = STOICHEIA_SCOPE,
  } = options;
  const root = postcss.parse(css, { from });
  const atRules = {};
  const documentAnchors = [];
  const globalDefinitions = [];
  const cascadeLayers = new Set();
  const tailwindCustomProperties = new Set();
  let styleRuleCount = 0;
  let keyframeStepCount = 0;

  root.walkAtRules((atRule) => {
    const name = atRule.name.toLowerCase();
    atRules[name] = (atRules[name] ?? 0) + 1;

    if (GLOBAL_DEFINITION_AT_RULES.has(name)) {
      globalDefinitions.push({
        name,
        params: atRule.params,
        line: atRule.source?.start?.line ?? null,
      });
    }

    if (name === "layer") {
      for (const layer of parseLayerNames(atRule)) {
        cascadeLayers.add(layer.name);
      }
    }

    for (const property of extractIdentifiers(
      atRule.params,
      STOICHEIA_TAILWIND_PROPERTY_PATTERN,
    )) {
      tailwindCustomProperties.add(property);
    }
  });

  root.walkRules((rule) => {
    if (isInsideKeyframes(rule)) {
      keyframeStepCount += 1;
      return;
    }

    styleRuleCount += 1;
    for (const selector of splitSelectorList(rule.selector)) {
      const leading = readLeadingCompound(selector);
      if (
        getScopeAnchor(leading.compound) ||
        containsUnsupportedRootAnchor(selector)
      ) {
        documentAnchors.push({
          selector,
          line: rule.source?.start?.line ?? null,
        });
      }
    }

    for (const property of extractIdentifiers(
      rule.selector,
      STOICHEIA_TAILWIND_PROPERTY_PATTERN,
    )) {
      tailwindCustomProperties.add(property);
    }
  });

  root.walkDecls((declaration) => {
    for (const property of extractIdentifiers(
      `${declaration.prop} ${declaration.value}`,
      STOICHEIA_TAILWIND_PROPERTY_PATTERN,
    )) {
      tailwindCustomProperties.add(property);
    }
  });

  return {
    scope,
    styleRuleCount,
    keyframeStepCount,
    atRules: Object.fromEntries(
      Object.entries(atRules).sort(([left], [right]) => left.localeCompare(right)),
    ),
    documentAnchors,
    globalDefinitions,
    namespacedGlobals: {
      cascadeLayers: [...cascadeLayers].sort(),
      tailwindCustomProperties: [...tailwindCustomProperties].sort(),
    },
    globalNamespaceLeaks: findGlobalNamespaceLeaks(root),
    leaksBeforeTransform: findScopeLeaks(root, scope),
  };
}

export function scopeCss(css, options = {}) {
  const {
    from = "<stoicheia-compiled-css>",
    scope = STOICHEIA_SCOPE,
  } = options;
  const root = postcss.parse(css, { from });

  root.walkAtRules((atRule) => {
    const name = atRule.name.toLowerCase();
    if (FORBIDDEN_AT_RULES.has(name)) {
      throw new StoicheiaCssScopeError(
        `@${atRule.name} is not allowed in compiled embedded CSS because it can bypass the scope boundary.`,
        atRule,
      );
    }
  });

  namespaceCascadeLayers(root);
  namespaceTailwindCustomProperties(root);
  namespaceKeyframes(root);

  root.walkRules((rule) => {
    if (isInsideKeyframes(rule)) {
      return;
    }

    try {
      rule.selector = splitSelectorList(rule.selector)
        .map((selector) => scopeSelector(selector, scope))
        .join(",\n");
    } catch (error) {
      if (error instanceof StoicheiaCssScopeError) {
        throw new StoicheiaCssScopeError(error.message, rule);
      }
      throw error;
    }
  });

  const leaks = findScopeLeaks(root, scope);
  if (leaks.length > 0) {
    const first = leaks[0];
    throw new StoicheiaCssScopeError(
      `Scoped CSS validation failed for ${first.kind} "${first.value}".`,
    );
  }

  const globalNamespaceLeaks = findGlobalNamespaceLeaks(root);
  if (globalNamespaceLeaks.length > 0) {
    const first = globalNamespaceLeaks[0];
    throw new StoicheiaCssScopeError(
      `Global CSS namespace validation failed for ${first.kind} "${first.value}".`,
    );
  }

  const output = root.toString();
  return output.endsWith("\n") ? output : `${output}\n`;
}
