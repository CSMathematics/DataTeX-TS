import { useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { ToolType } from '../store';

export interface ToolItem {
  id: ToolType;
  icon: React.ReactNode;
  label: string;
  description: string;
}

export interface ToolSection {
  id: string;
  label: string;
  tools: ToolItem[];
}

interface ToolGroupProps {
  label: string;
  tools: ToolItem[];
  sections?: ToolSection[];
  activeTool: ToolType;
  open: boolean;
  onToggle: () => void;
  onSelect: (tool: ToolType) => void;
  groupToolsLabel?: (label: string) => string;
}

interface MenuBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface MenuPosition {
  left: number;
  top: number;
  maxWidth?: number;
  maxHeight?: number;
}

const getMenuBounds = (trigger: HTMLElement): { bounds: MenuBounds; scope: HTMLElement | null } => {
  const scope = trigger.closest<HTMLElement>('.stoicheia-scope');
  const scopeRect = scope?.getBoundingClientRect();
  if (scopeRect && scopeRect.width > 0 && scopeRect.height > 0) {
    return {
      scope,
      bounds: {
        left: scopeRect.left,
        top: scopeRect.top,
        right: scopeRect.right,
        bottom: scopeRect.bottom,
      },
    };
  }

  return {
    scope,
    bounds: {
      left: 0,
      top: 0,
      right: document.documentElement.clientWidth,
      bottom: document.documentElement.clientHeight,
    },
  };
};

export function ToolGroup({ label, tools, sections, activeTool, open, onToggle, onSelect, groupToolsLabel }: ToolGroupProps) {
  const activeItem = tools.find(tool => tool.id === activeTool);
  const displayItem = activeItem ?? tools[0];
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<MenuPosition>({ left: 76, top: 12 });
  const menuSections = sections?.length ? sections : [{ id: 'all', label, tools }];
  const triggerLabel = groupToolsLabel ? groupToolsLabel(label) : `${label} tools`;

  useLayoutEffect(() => {
    if (!open) return;
    const placeMenu = () => {
      const triggerElement = triggerRef.current;
      const menu = menuRef.current;
      if (!triggerElement || !menu) return;
      const trigger = triggerElement.getBoundingClientRect();
      const { bounds } = getMenuBounds(triggerElement);
      const gap = 10;
      const margin = 12;
      const maxWidth = Math.max(0, bounds.right - bounds.left - (margin * 2));
      const maxHeight = Math.max(0, bounds.bottom - bounds.top - (margin * 2));
      const menuWidth = Math.min(menu.offsetWidth, maxWidth);
      const menuHeight = Math.min(menu.offsetHeight, maxHeight);
      const minLeft = bounds.left + margin;
      const minTop = bounds.top + margin;
      const maxLeft = Math.max(minLeft, bounds.right - menuWidth - margin);
      const maxTop = Math.max(minTop, bounds.bottom - menuHeight - margin);
      const left = Math.min(Math.max(trigger.right + gap, minLeft), maxLeft);
      const top = Math.min(Math.max(trigger.top, minTop), maxTop);
      setPosition({ left, top, maxWidth, maxHeight });
    };
    placeMenu();
    menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.scrollIntoView?.({ block: 'nearest' });
    const triggerElement = triggerRef.current;
    const menu = menuRef.current;
    const scope = triggerElement ? getMenuBounds(triggerElement).scope : null;
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(placeMenu);
    if (scope) resizeObserver?.observe(scope);
    if (menu) resizeObserver?.observe(menu);
    window.addEventListener('resize', placeMenu);
    window.addEventListener('scroll', placeMenu, true);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', placeMenu);
      window.removeEventListener('scroll', placeMenu, true);
    };
  }, [open, tools.length]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        title={triggerLabel}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
        className={`group/tool activity-button ${
          activeItem
            ? 'activity-button-active'
            : open
              ? 'activity-button-open'
              : ''
        }`}
      >
        {activeItem && <span className="activity-rail-indicator" />}
        {displayItem.icon}
        <ChevronRight
          size={10}
          className={`absolute right-0.5 bottom-0.5 text-current opacity-55 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          style={{
            left: position.left,
            top: position.top,
            maxWidth: position.maxWidth,
            maxHeight: position.maxHeight,
          }}
          className="theme-dialog inspector-scroll tool-menu fixed z-50 overflow-y-auto border backdrop-blur-xl"
        >
          <div className="tool-menu-header">
            <span>{label}</span><span className="font-mono tracking-normal">{tools.length}</span>
          </div>
          <div className="tool-menu-sections">
            {menuSections.map((section, index) => (
              <section key={section.id} className="tool-menu-section" aria-label={section.label}>
                {(sections?.length || index > 0) && (
                  <div className="tool-menu-section-title">{section.label}</div>
                )}
                <div className="tool-menu-grid grid min-[520px]:grid-cols-2">
                  {section.tools.map(tool => {
                    const isActive = activeTool === tool.id;
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={isActive}
                        onClick={() => onSelect(tool.id)}
                        title={`${tool.label} — ${tool.description}`}
                        className={`tool-menu-item ${isActive ? 'tool-menu-item-active' : ''}`}
                      >
                        <span className="tool-menu-icon">
                          {tool.icon}
                        </span>
                        <span className="min-w-0">
                          <span className="tool-menu-title">{tool.label}</span>
                          <span className="tool-menu-description">{tool.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
