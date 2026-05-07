import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mockear sonner antes de importar el wrapper
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  },
}));

import { toast } from '../../store/toastStore';
import { toast as sonnerToast } from 'sonner';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('toastStore (wrapper de sonner)', () => {
  test('toast.success llama a sonner.success con duration por default', () => {
    toast.success('Hecho');
    expect(sonnerToast.success).toHaveBeenCalledWith('Hecho', {
      description: undefined,
      duration: 4500,
    });
  });

  test('toast.error pasa description', () => {
    toast.error('Error', 'Algo falló');
    expect(sonnerToast.error).toHaveBeenCalledWith('Error', {
      description: 'Algo falló',
      duration: 4500,
    });
  });

  test('toast.warning permite override de duration', () => {
    toast.warning('Cuidado', 'desc', 1000);
    expect(sonnerToast.warning).toHaveBeenCalledWith('Cuidado', {
      description: 'desc',
      duration: 1000,
    });
  });

  test('toast.info funciona', () => {
    toast.info('Info');
    expect(sonnerToast.info).toHaveBeenCalledTimes(1);
  });

  test('toast.dismiss propaga el id', () => {
    toast.dismiss('abc');
    expect(sonnerToast.dismiss).toHaveBeenCalledWith('abc');
  });
});
