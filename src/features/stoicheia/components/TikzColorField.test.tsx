import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { hexToTikzColor, TikzColorField, tikzColorToHex } from './TikzColorField';

const ControlledField = () => {
  const [value, setValue] = useState('black');
  return <TikzColorField label="Color" value={value} onChange={setValue} />;
};

describe('TikzColorField', () => {
  it('offers TikZ names and accepts custom expressions', () => {
    render(<ControlledField />);
    fireEvent.change(screen.getByLabelText('Color preset'), { target: { value: 'orange' } });
    expect(screen.getByLabelText('Color')).toHaveValue('orange');
    fireEvent.change(screen.getByLabelText('Color'), { target: { value: 'red!40!blue' } });
    expect(screen.getByLabelText('Color')).toHaveValue('red!40!blue');
  });

  it('converts picker colors to valid xcolor expressions', () => {
    expect(hexToTikzColor('#ff0000')).toBe('red');
    expect(hexToTikzColor('#123456')).toBe('{rgb,255:red,18;green,52;blue,86}');
    expect(tikzColorToHex('{rgb,255:red,18;green,52;blue,86}')).toBe('#123456');
  });
});
