/**
 * Setup global para Vitest + jsdom + React Testing Library.
 *
 * - Importa matchers de jest-dom (toBeInTheDocument, toHaveClass, etc).
 * - Polyfills útiles para componentes que usan APIs de navegador.
 * - Limpieza automática del DOM entre tests.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// matchMedia polyfill (algunos componentes usan animaciones condicionales)
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// IntersectionObserver polyfill (usado por algunos componentes con animación)
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = '';
  thresholds = [];
}
(globalThis as unknown as { IntersectionObserver: typeof MockIntersectionObserver })
  .IntersectionObserver = MockIntersectionObserver;
