export interface SemanticSvgText {
  text: string;
}

export interface SemanticSvgElement {
  tag: string;
  attributes?: Record<string, string>;
  children?: SemanticSvgNode[];
}

export type SemanticSvgNode = SemanticSvgElement | SemanticSvgText;

export interface SemanticSvgSnapshot {
  schemaVersion: 1;
  root: SemanticSvgElement;
}

const SVG_ID_PREFIX = 'semantic-svg-id-';
const URL_REFERENCE_PATTERN = /url\(\s*#([^\s)]+)\s*\)/g;

const referencedIds = (element: Element) => {
  const references = new Set<string>();
  for (const candidate of [element, ...Array.from(element.querySelectorAll('*'))]) {
    for (const attribute of Array.from(candidate.attributes)) {
      for (const match of attribute.value.matchAll(URL_REFERENCE_PATTERN)) {
        references.add(match[1]);
      }
      if (
        (attribute.name === 'href' || attribute.name === 'xlink:href')
        && attribute.value.startsWith('#')
      ) {
        references.add(attribute.value.slice(1));
      }
    }
  }
  return references;
};

const canonicalIdMap = (root: Element, references: ReadonlySet<string>) => {
  const ids = new Map<string, string>();
  let nextId = 1;
  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    const id = element.getAttribute('id');
    if (!id) continue;
    const insideDefinitions = Boolean(element.parentElement?.closest('defs'));
    if (insideDefinitions && !references.has(id)) continue;
    if (!ids.has(id)) {
      ids.set(id, `${SVG_ID_PREFIX}${nextId}`);
      nextId += 1;
    }
  }
  return ids;
};

const canonicalAttributeValue = (
  name: string,
  value: string,
  ids: ReadonlyMap<string, string>,
) => {
  if (name === 'id') return ids.get(value) ?? value;
  const urlsCanonicalized = value.replace(
    URL_REFERENCE_PATTERN,
    (_reference, id: string) => `url(#${ids.get(id) ?? id})`,
  );
  if (
    (name === 'href' || name === 'xlink:href')
    && urlsCanonicalized.startsWith('#')
  ) {
    const id = urlsCanonicalized.slice(1);
    return `#${ids.get(id) ?? id}`;
  }
  return urlsCanonicalized;
};

const projectElement = (
  element: Element,
  ids: ReadonlyMap<string, string>,
  references: ReadonlySet<string>,
): SemanticSvgElement | null => {
  const id = element.getAttribute('id');
  const insideDefinitions = Boolean(element.parentElement?.closest('defs'));
  if (insideDefinitions && id && !references.has(id)) return null;

  const attributes = Object.fromEntries(
    Array.from(element.attributes)
      .filter(attribute => attribute.name !== 'class')
      .sort((left, right) => (
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0
      ))
      .map(attribute => [
        attribute.name,
        canonicalAttributeValue(attribute.name, attribute.value, ids),
      ]),
  );
  const children: SemanticSvgNode[] = [];
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === 1) {
      const projected = projectElement(child as Element, ids, references);
      if (projected) children.push(projected);
      continue;
    }
    if (child.nodeType === 3 && child.nodeValue?.trim()) {
      children.push({ text: child.nodeValue });
    }
  }

  if (element.localName === 'defs' && children.length === 0) return null;
  return {
    tag: element.localName,
    ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
    ...(children.length > 0 ? { children } : {}),
  };
};

export const projectSemanticSvg = (svg: SVGSVGElement): SemanticSvgSnapshot => {
  if (svg.localName !== 'svg') throw new Error('Semantic SVG projection requires an SVG root');
  const references = referencedIds(svg);
  const ids = canonicalIdMap(svg, references);
  const root = projectElement(svg, ids, references);
  if (!root) throw new Error('Semantic SVG projection produced no root');
  return { schemaVersion: 1, root };
};
