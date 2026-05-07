/**
 * Smoke test del VehicleStep: verifica que renderiza sin crashear y muestra
 * los inputs clave. La lógica completa (cascada de selectores, validaciones)
 * está cubierta por los E2E de Playwright que sí pegan a APIs reales.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../lib/api', () => ({
  catalogoApi: {
    anios: vi.fn().mockResolvedValue({ data: { success: true, min: 1990, max: 2026 } }),
    marcas: vi.fn().mockResolvedValue({ data: { success: true, data: [{ cmarca: '074', xmarca: 'TOYOTA' }] } }),
    modelos: vi.fn().mockResolvedValue({ data: { success: true, data: [] } }),
    versiones: vi.fn().mockResolvedValue({ data: { success: true, data: [] } }),
    categoriasUso: vi.fn().mockResolvedValue({ data: { success: true, data: [] } }),
    resolver: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

// sonner toast wrapper
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), dismiss: vi.fn(),
  },
}));

import { VehicleStep } from '../../features/vehicle/VehicleStep';
import { useWizardStore } from '../../store/wizardStore';

beforeEach(() => useWizardStore.getState().reset());

describe('VehicleStep — smoke', () => {
  test('renderiza sin crashear y muestra el input de placa', async () => {
    render(<VehicleStep />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/AE123KT/i)).toBeInTheDocument();
    });
  });

  test('escribir en placa convierte a mayúsculas y la guarda en store', async () => {
    render(<VehicleStep />);
    const placa = await screen.findByPlaceholderText(/AE123KT/i) as HTMLInputElement;
    await userEvent.type(placa, 'ae123kt');
    expect(useWizardStore.getState().vehicle.placa).toBe('AE123KT');
  });

  test('placa respeta maxLength=8', async () => {
    render(<VehicleStep />);
    const placa = await screen.findByPlaceholderText(/AE123KT/i) as HTMLInputElement;
    await userEvent.type(placa, '1234567890');
    expect(placa.value.length).toBeLessThanOrEqual(8);
  });
});
