/**
 * Configuración de Jest para el backend de Suscripción RCV.
 *
 * - Carga `.env.test` si existe, si no `.env`, antes de cada suite.
 * - Cobertura sobre `src/` (excluye index.js para no contar bootstrap).
 * - HTML report en `coverage/lcov-report/index.html` (lo consume el ACTA QA).
 */
const path = require('path');
const fs = require('fs');

const envFile = fs.existsSync(path.join(__dirname, '.env.test'))
  ? '.env.test'
  : '.env';

require('dotenv').config({ path: path.join(__dirname, envFile) });

module.exports = {
  testEnvironment: 'node',
  rootDir: __dirname,
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/**/__mocks__/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json-summary'],
  clearMocks: true,
  verbose: true,
  // Captura logs ruidosos del cliente La Mundial; los tests pueden silenciarlos
  // con jest.spyOn(console, 'log').mockImplementation()
  silent: false,
};
