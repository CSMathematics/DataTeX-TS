import { describe, expect, it } from 'vitest';
import { splitTikzOptions } from './PropertiesPanel';

describe('TikZ option parsing', () => {
  it('keeps commas inside nested option values', () => {
    expect(splitTikzOptions('color=blue, add=2 and 2, label={x,y}, postaction={decorate, decoration={markings}}')).toEqual([
      'color=blue',
      'add=2 and 2',
      'label={x,y}',
      'postaction={decorate, decoration={markings}}',
    ]);
  });
});
