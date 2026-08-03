import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolGroup } from './ToolGroup';

const rect = (
  left: number,
  top: number,
  right: number,
  bottom: number,
): DOMRect => ({
  left,
  top,
  right,
  bottom,
  x: left,
  y: top,
  width: right - left,
  height: bottom - top,
  toJSON: () => undefined,
});

const tools = [{
  id: 'cursor' as const,
  icon: <span aria-hidden="true">P</span>,
  label: 'Point',
  description: 'Create a point',
}];

describe('ToolGroup menu bounds', () => {
  let scopeRect = rect(300, 100, 900, 600);
  let resizeCallback: ResizeObserverCallback | null;
  let originalOffsetWidth: PropertyDescriptor | undefined;
  let originalOffsetHeight: PropertyDescriptor | undefined;

  beforeEach(() => {
    scopeRect = rect(300, 100, 900, 600);
    resizeCallback = null;
    originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
    originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get(this: HTMLElement) {
        return this.getAttribute('role') === 'menu' ? 400 : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return this.getAttribute('role') === 'menu' ? 300 : 0;
      },
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('stoicheia-scope')) return scopeRect;
      if (this.tagName === 'BUTTON') return rect(840, 550, 880, 590);
      return rect(0, 0, 0, 0);
    });
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe() {}
      disconnect() {}
      unobserve() {}
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalOffsetWidth) {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'offsetWidth');
    }
    if (originalOffsetHeight) {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight');
    }
  });

  const renderOpenGroup = (scoped = true) => render(
    <div className={scoped ? 'stoicheia-scope' : undefined}>
      <ToolGroup
        label="Points"
        tools={tools}
        activeTool="cursor"
        open
        onToggle={vi.fn()}
        onSelect={vi.fn()}
      />
    </div>,
  );

  it('keeps the fixed menu inside the nearest embedded Stoicheia scope', () => {
    renderOpenGroup();

    const menu = screen.getByRole('menu', { name: 'Points' });
    expect(menu).toHaveStyle({
      left: '488px',
      top: '288px',
      maxWidth: '576px',
      maxHeight: '476px',
    });
  });

  it('repositions the menu when the embedded workspace is resized', () => {
    renderOpenGroup();
    const menu = screen.getByRole('menu', { name: 'Points' });

    scopeRect = rect(300, 100, 700, 500);
    act(() => {
      resizeCallback?.([], {} as ResizeObserver);
    });

    expect(menu).toHaveStyle({
      left: '312px',
      top: '188px',
      maxWidth: '376px',
      maxHeight: '376px',
    });
  });

  it('falls back to the document viewport outside a scoped host', () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1000);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(700);
    renderOpenGroup(false);

    const menu = screen.getByRole('menu', { name: 'Points' });
    expect(menu).toHaveStyle({
      left: '588px',
      top: '388px',
      maxWidth: '976px',
      maxHeight: '676px',
    });
  });
});
