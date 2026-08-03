import { useEditorStore, AstNode } from '../store';
import { Move, X } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { ConstructionInspector, PointAndLabelAppearance } from './ConstructionInspector';
import { getNodeId } from './nodeIdentity';

export { splitTikzOptions } from '../tikz/options';

const constructionPointNamesFrom = (nodes: AstNode[]) => Array.from(new Set(nodes.flatMap((item: any) => {
  const singularKeys = ['name', 'name1', 'name2', 'helper', 'helper1', 'helper2', 'foot', 'foot1', 'foot2', 'foot3', 'orthocenter'];
  const singular = singularKeys.map(key => item[key]).filter((value): value is string => typeof value === 'string' && value.length > 0);
  const plural = ['names', 'results'].flatMap(key => Array.isArray(item[key]) ? item[key] : []).filter((value): value is string => typeof value === 'string' && value.length > 0);
  return [...singular, ...plural];
}))).sort((first, second) => first.localeCompare(second));

export function PropertiesPanel() {
  const { selectedNode, parsedNodes, source, setSource, setSelectedNode } = useEditorStore(useShallow(state => ({
    selectedNode: state.selectedNode,
    parsedNodes: state.parsedNodes,
    source: state.source,
    setSource: state.setSource,
    setSelectedNode: state.setSelectedNode,
  })));

  const node = parsedNodes.find(item => getNodeId(item) === selectedNode);
  if (!selectedNode || !node) return null;

  const constructionPointNames = constructionPointNamesFrom(parsedNodes);

  if (node.type === 'Point') {
    const polarAngle = node.angle ?? 0;
    const polarDistance = node.distance ?? Math.hypot(node.x, node.y);

    return (
      <div className="properties-panel h-[30rem] flex flex-col shrink-0">
        <div className="properties-panel-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="properties-panel-icon"><Move size={14} /></span>
            <div>
              <h2 className="properties-panel-title">Point {node.name}</h2>
              <p className="properties-panel-subtitle">{node.coordinate_mode === 'polar' ? 'Polar coordinates' : 'Cartesian coordinates'}</p>
            </div>
          </div>
          <button type="button" onClick={() => setSelectedNode(null)} className="inspector-close" title="Close properties">
            <X size={15} />
          </button>
        </div>
        <div className="inspector-scroll properties-panel-body flex-1 overflow-y-auto space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {node.coordinate_mode === 'polar' && (
              <>
                <div className="property-card">
                  <label className="property-label" htmlFor={`point-angle-${node.name}`}>Angle α</label>
                  <input id={`point-angle-${node.name}`} aria-label="Point angle" type="number" step="1" className="property-input mt-1" value={polarAngle} onChange={event => { const angle = Number(event.target.value); if (Number.isFinite(angle)) { const radians = angle * Math.PI / 180; useEditorStore.getState().updatePointCoords(node.name, Number((polarDistance * Math.cos(radians)).toFixed(4)), Number((polarDistance * Math.sin(radians)).toFixed(4))); } }} />
                </div>
                <div className="property-card">
                  <label className="property-label" htmlFor={`point-distance-${node.name}`}>Distance d</label>
                  <input id={`point-distance-${node.name}`} aria-label="Point distance" type="number" min="0" step="0.1" className="property-input mt-1" value={polarDistance} onChange={event => { const distance = Number(event.target.value); if (Number.isFinite(distance) && distance >= 0) { const radians = polarAngle * Math.PI / 180; useEditorStore.getState().updatePointCoords(node.name, Number((distance * Math.cos(radians)).toFixed(4)), Number((distance * Math.sin(radians)).toFixed(4))); } }} />
                </div>
              </>
            )}
            <div className="property-card">
              <label className="property-label" htmlFor={`point-x-${node.name}`}>X</label>
              <input id={`point-x-${node.name}`} aria-label="Point X" type="number" step="0.1" className="property-input mt-1" value={node.x} onChange={event => { const x = Number(event.target.value); if (Number.isFinite(x)) useEditorStore.getState().updatePointCoords(node.name, x, node.y); }} />
            </div>
            <div className="property-card">
              <label className="property-label" htmlFor={`point-y-${node.name}`}>Y</label>
              <input id={`point-y-${node.name}`} aria-label="Point Y" type="number" step="0.1" className="property-input mt-1" value={node.y} onChange={event => { const y = Number(event.target.value); if (Number.isFinite(y)) useEditorStore.getState().updatePointCoords(node.name, node.x, y); }} />
            </div>
            <p className="properties-hint col-span-2 px-1">Edit the values here or drag the point directly on the canvas.</p>
          </div>
          <PointAndLabelAppearance name={node.name} source={source} setSource={setSource} />
        </div>
      </div>
    );
  }

  return <ConstructionInspector node={node} source={source} pointNames={constructionPointNames} setSource={setSource} onClose={() => setSelectedNode(null)} />;
}
