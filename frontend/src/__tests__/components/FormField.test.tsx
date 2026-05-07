import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field, Input, Select, Textarea } from '../../components/ui/FormField';

describe('Field', () => {
  test('renderiza label y children', () => {
    render(
      <Field label="Nombre"><input data-testid="x" /></Field>,
    );
    expect(screen.getByText('Nombre')).toBeInTheDocument();
    expect(screen.getByTestId('x')).toBeInTheDocument();
  });

  test('muestra hint cuando no hay error', () => {
    render(<Field label="X" hint="Mi hint"><input /></Field>);
    expect(screen.getByText('Mi hint')).toBeInTheDocument();
  });

  test('muestra error y oculta hint si ambos están presentes', () => {
    render(<Field label="X" hint="Mi hint" error="Mi error"><input /></Field>);
    expect(screen.getByText('Mi error')).toBeInTheDocument();
    expect(screen.queryByText('Mi hint')).not.toBeInTheDocument();
  });

  test('aplica sm:col-span-2 cuando full=true', () => {
    const { container } = render(
      <Field label="X" full><input /></Field>,
    );
    expect(container.firstChild).toHaveClass('sm:col-span-2');
  });
});

describe('Input', () => {
  test('renderiza con value y placeholder', () => {
    render(<Input value="hola" onChange={() => {}} placeholder="Escribe" />);
    const inp = screen.getByPlaceholderText('Escribe') as HTMLInputElement;
    expect(inp.value).toBe('hola');
  });

  test('llama onChange al teclear', async () => {
    const handler = vi.fn();
    render(<Input defaultValue="" onChange={handler} placeholder="x" />);
    await userEvent.type(screen.getByPlaceholderText('x'), 'a');
    expect(handler).toHaveBeenCalled();
  });

  test('respeta maxLength', async () => {
    render(<Input defaultValue="" maxLength={3} placeholder="x" />);
    const inp = screen.getByPlaceholderText('x') as HTMLInputElement;
    await userEvent.type(inp, '12345');
    expect(inp.value).toBe('123');
  });

  test('respeta atributo type=number', () => {
    render(<Input type="number" defaultValue="" placeholder="x" />);
    const inp = screen.getByPlaceholderText('x') as HTMLInputElement;
    expect(inp.type).toBe('number');
  });
});

describe('Select', () => {
  test('renderiza opciones y selecciona una', async () => {
    const handler = vi.fn();
    render(
      <Select defaultValue="" onChange={handler} aria-label="Plan">
        <option value="">Elige…</option>
        <option value="basic">Básico</option>
        <option value="premium">Premium</option>
      </Select>,
    );
    const sel = screen.getByLabelText('Plan') as HTMLSelectElement;
    await userEvent.selectOptions(sel, 'premium');
    expect(sel.value).toBe('premium');
    expect(handler).toHaveBeenCalled();
  });
});

describe('Textarea', () => {
  test('renderiza y permite escribir', async () => {
    render(<Textarea placeholder="Notas" defaultValue="" />);
    const ta = screen.getByPlaceholderText('Notas') as HTMLTextAreaElement;
    await userEvent.type(ta, 'observación');
    expect(ta.value).toBe('observación');
  });
});
