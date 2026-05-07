import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IdentityInput, nationalityLabel } from '../../components/ui/IdentityInput';

describe('IdentityInput', () => {
  test('renderiza selector de nacionalidad e input', () => {
    render(
      <IdentityInput
        tipoDoc="V"
        identificacion="12345678"
        onTipoDocChange={() => {}}
        onIdentificacionChange={() => {}}
      />,
    );
    const select = screen.getByLabelText('Tipo de documento') as HTMLSelectElement;
    expect(select.value).toBe('V');
    const input = screen.getByDisplayValue('12345678') as HTMLInputElement;
    expect(input).toBeInTheDocument();
  });

  test('cambiar nacionalidad llama onTipoDocChange', async () => {
    const handler = vi.fn();
    render(
      <IdentityInput
        tipoDoc="V"
        identificacion=""
        onTipoDocChange={handler}
        onIdentificacionChange={() => {}}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText('Tipo de documento'), 'E');
    expect(handler).toHaveBeenCalledWith('E');
  });

  test('teclear en input llama onIdentificacionChange', async () => {
    const handler = vi.fn();
    render(
      <IdentityInput
        tipoDoc="V"
        identificacion=""
        onTipoDocChange={() => {}}
        onIdentificacionChange={handler}
        placeholder="Cédula"
      />,
    );
    await userEvent.type(screen.getByPlaceholderText('Cédula'), '1');
    expect(handler).toHaveBeenCalled();
  });

  test('input tiene inputMode=numeric (mostrar teclado numérico móvil)', () => {
    render(
      <IdentityInput
        tipoDoc="V"
        identificacion=""
        onTipoDocChange={() => {}}
        onIdentificacionChange={() => {}}
        placeholder="x"
      />,
    );
    expect(screen.getByPlaceholderText('x')).toHaveAttribute('inputmode', 'numeric');
  });

  test('todas las nacionalidades V/E/J/P están disponibles', () => {
    render(
      <IdentityInput
        tipoDoc="V"
        identificacion=""
        onTipoDocChange={() => {}}
        onIdentificacionChange={() => {}}
      />,
    );
    const select = screen.getByLabelText('Tipo de documento');
    const opts = select.querySelectorAll('option');
    const values = Array.from(opts).map(o => (o as HTMLOptionElement).value);
    expect(values).toEqual(['V', 'E', 'J', 'P']);
  });
});

describe('nationalityLabel', () => {
  test('V → "V - Venezolano"', () => {
    expect(nationalityLabel('V')).toBe('V - Venezolano');
  });
  test('valor desconocido devuelve el valor original', () => {
    expect(nationalityLabel('X')).toBe('X');
  });
});
