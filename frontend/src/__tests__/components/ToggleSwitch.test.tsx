import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToggleSwitch } from '../../components/ui/ToggleSwitch';

describe('ToggleSwitch', () => {
  test('renderiza label y description', () => {
    render(
      <ToggleSwitch
        checked={false}
        onChange={() => {}}
        label="Activar"
        description="Una descripción"
      />,
    );
    expect(screen.getByText('Activar')).toBeInTheDocument();
    expect(screen.getByText('Una descripción')).toBeInTheDocument();
  });

  test('al hacer click llama onChange con !checked', async () => {
    const handler = vi.fn();
    render(<ToggleSwitch checked={false} onChange={handler} label="X" />);
    await userEvent.click(screen.getByRole('switch'));
    expect(handler).toHaveBeenCalledWith(true);
  });

  test('aria-checked refleja el estado checked=true', () => {
    render(<ToggleSwitch checked onChange={() => {}} label="X" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  test('aria-checked refleja el estado checked=false', () => {
    render(<ToggleSwitch checked={false} onChange={() => {}} label="X" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  test('toggle de true a false llama onChange(false)', async () => {
    const handler = vi.fn();
    render(<ToggleSwitch checked onChange={handler} label="X" />);
    await userEvent.click(screen.getByRole('switch'));
    expect(handler).toHaveBeenCalledWith(false);
  });
});
