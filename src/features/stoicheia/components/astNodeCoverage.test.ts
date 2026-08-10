import { describe, expect, it } from 'vitest';
import storeSource from '../store.ts?raw';
import constructionInspectorSource from './ConstructionInspector.tsx?raw';
import objectTreeSource from './ObjectTree.tsx?raw';
import propertiesPanelSource from './PropertiesPanel.tsx?raw';
import nodeDeletionSource from './nodeDeletion.ts?raw';
import nodeIdentitySource from './nodeIdentity.ts?raw';

const astNodeTypes = () => {
  const store = storeSource;
  const union = store.match(/export type AstNode = ([\s\S]*?);/)?.[1];
  expect(union, 'AstNode union should exist in store.ts').toBeTruthy();

  const definitionNames = [...union!.matchAll(/\b([A-Za-z0-9]+Def)\b/g)].map(match => match[1]);
  const typeByDefinition = new Map(
    [...store.matchAll(/export interface (\w+Def) \{[\s\S]*?type: "([^"]+)";/g)]
      .map(match => [match[1], match[2]] as const),
  );

  const types = definitionNames.map(definition => typeByDefinition.get(definition) ?? `?${definition}`);
  expect(types).not.toContainEqual(expect.stringMatching(/^\?/));
  return types;
};

const caseTypes = (source: string) => new Set([...source.matchAll(/case '([^']+)'/g)].map(match => match[1]));

const typeReferences = (source: string) => new Set([
  ...caseTypes(source),
  ...[...source.matchAll(/node\.type === '([^']+)'/g)].map(match => match[1]),
  ...[...source.matchAll(/item\.type === '([^']+)'/g)].map(match => match[1]),
  ...[...source.matchAll(/anyNode\.type === '([^']+)'/g)].map(match => match[1]),
]);

const missingTypes = (types: string[], present: Set<string>, ignored: string[] = []) => {
  const ignoredTypes = new Set(ignored);
  return types.filter(type => !ignoredTypes.has(type) && !present.has(type));
};

describe('AstNode UI coverage guards', () => {
  it('keeps every AstNode selectable and deletable from the scene tree', () => {
    const types = astNodeTypes();
    const identityTypes = caseTypes(nodeIdentitySource);
    const deletionTypes = typeReferences(nodeDeletionSource);
    const objectTree = objectTreeSource;
    const iconStart = objectTree.indexOf('const getNodeIcon');
    const labelStart = objectTree.indexOf('const getNodeLabel');
    const renderStart = objectTree.indexOf('return (', labelStart);

    expect(iconStart).toBeGreaterThanOrEqual(0);
    expect(labelStart).toBeGreaterThan(iconStart);
    expect(renderStart).toBeGreaterThan(labelStart);

    const iconTypes = caseTypes(objectTree.slice(iconStart, labelStart));
    const labelTypes = caseTypes(objectTree.slice(labelStart, renderStart));

    expect(missingTypes(types, identityTypes)).toEqual([]);
    expect(missingTypes(types, iconTypes)).toEqual([]);
    expect(missingTypes(types, labelTypes)).toEqual([]);
    expect(missingTypes(types, deletionTypes)).toEqual([]);
  });

  it('keeps every non-point AstNode routed through the construction inspector', () => {
    const types = astNodeTypes();
    const inspectorTypes = typeReferences(constructionInspectorSource);
    const propertiesPanelTypes = typeReferences(propertiesPanelSource);

    expect(propertiesPanelTypes.has('Point')).toBe(true);
    expect(missingTypes(types, inspectorTypes, ['Point'])).toEqual([]);
  });
});
