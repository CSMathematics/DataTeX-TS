import { Clock3 } from 'lucide-react';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AstNode, useEditorStore } from '../store';
import { getNodeId } from './nodeIdentity';

const shortNodeLabel = (node: AstNode) => {
  switch (node.type) {
    case 'Point': return `Point ${node.name}`;
    case 'Segment': return `Segment ${node.p1}-${node.p2}`;
    case 'Line': return `Line ${node.p1}-${node.p2}`;
    case 'Circle': return `Circle ${node.center}-${node.radius_point}`;
    case 'SemiCircle': return `Semicircle ${node.center}-${node.radius_point}`;
    case 'Arc': return `Arc ${node.center}`;
    case 'Polygon': return `Polygon ${node.points.join('-')}`;
    case 'PolySeg': return `Polyseg ${node.points.join('-')}`;
    case 'FillPolygon': return `Fill polygon ${node.points.join('-')}`;
    case 'FillCircle': return `Fill circle ${node.center}`;
    case 'LabelPoint': return `Label ${node.point}`;
    case 'LabelSegment': return `Label ${node.p1}-${node.p2}`;
    case 'MidPoint': return `Midpoint ${node.name}`;
    case 'IntersectionPoint': return `Intersection ${node.name}`;
    case 'TriangleCenter': return `${node.option} center ${node.name}`;
    case 'AngleMark': return `Angle ${node.p1}-${node.vertex}-${node.p2}`;
    case 'RightAngleMark': return `Right angle ${node.p1}-${node.vertex}-${node.p2}`;
    case 'LengthCalculation': return `Length ${node.p1}-${node.p2}`;
    case 'AngleCalculation': return `${node.mode === 'angle' ? 'Angle' : 'Slope'} calculation`;
    default: return node.type.replace(/([a-z])([A-Z])/g, '$1 $2');
  }
};

const actionForNode = (node: AstNode) => {
  switch (node.type) {
    case 'Point':
      return 'Define';
    case 'Segment':
    case 'Line':
    case 'Circle':
    case 'SemiCircle':
    case 'Arc':
    case 'Polygon':
    case 'PolySeg':
      return 'Draw';
    case 'FillCircle':
    case 'FillPolygon':
    case 'FillSector':
    case 'FillAngle':
    case 'FillAngles':
      return 'Fill';
    case 'LabelPoint':
    case 'LabelSegment':
    case 'LabelLine':
    case 'LabelAngle':
    case 'LabelCircle':
    case 'LabelArc':
      return 'Label';
    case 'LengthCalculation':
    case 'AngleCalculation':
    case 'AngleRetrieval':
    case 'DotProduct':
    case 'PowerCircle':
      return 'Compute';
    default:
      return 'Step';
  }
};

export function ConstructionHistory() {
  const { parsedNodes, selectedNode, hoveredNode, setSelectedNode, setHoveredNode } = useEditorStore(useShallow(state => ({
    parsedNodes: state.parsedNodes,
    selectedNode: state.selectedNode,
    hoveredNode: state.hoveredNode,
    setSelectedNode: state.setSelectedNode,
    setHoveredNode: state.setHoveredNode,
  })));

  const steps = useMemo(() => parsedNodes.map((node, index) => ({
    index,
    node,
    id: getNodeId(node),
    label: shortNodeLabel(node),
    action: actionForNode(node),
  })), [parsedNodes]);

  return (
    <section className="construction-history shrink-0">
      <div className="construction-history-header">
        <div className="flex items-center gap-2">
          <span className="scene-tree-title-icon"><Clock3 size={15} /></span>
          <h2 className="scene-tree-title">History</h2>
        </div>
        <span className="scene-count-badge">{steps.length}</span>
      </div>

      {steps.length === 0 ? (
        <div className="construction-history-empty">No construction steps yet.</div>
      ) : (
        <ol className="construction-history-list">
          {steps.map(step => {
            const isSelected = selectedNode === step.id;
            const isHovered = hoveredNode === step.id;
            return (
              <li key={`${step.id}-${step.index}`} className="construction-history-item">
                <button
                  type="button"
                  className={`construction-history-button ${isSelected ? 'construction-history-button-selected' : isHovered ? 'construction-history-button-hovered' : ''}`}
                  onMouseEnter={() => setHoveredNode(step.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => setSelectedNode(step.id)}
                >
                  <span className="construction-history-step">{String(step.index + 1).padStart(2, '0')}</span>
                  <span className="construction-history-main">
                    <span className="construction-history-label">{step.label}</span>
                    <span className="construction-history-meta">{step.action} · {step.node.type}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
