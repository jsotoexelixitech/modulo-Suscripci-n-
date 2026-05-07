import { describe, test, expect } from 'vitest';
import { vehicleSignature } from '../../lib/money';

describe('vehicleSignature', () => {
  test('produce string en mayúsculas con todos los campos', () => {
    const sig = vehicleSignature({
      placa: 'ae123kt',
      marca: 'Toyota',
      modelo: 'Corolla',
      año: '2020',
      uso: 'Particular',
    });
    expect(sig).toBe('AE123KT|TOYOTA|COROLLA|2020|PARTICULAR||');
  });

  test('cambia cuando cambia la placa', () => {
    const a = vehicleSignature({ placa: 'A', marca: 'm', modelo: 'mo', año: '2020', uso: 'u' });
    const b = vehicleSignature({ placa: 'B', marca: 'm', modelo: 'mo', año: '2020', uso: 'u' });
    expect(a).not.toBe(b);
  });

  test('incluye cversion cuando se pasa', () => {
    const sig = vehicleSignature({
      placa: 'AE123KT', marca: 'TOYOTA', modelo: 'COROLLA',
      año: '2020', uso: 'Particular', cversion: '03',
    });
    expect(sig).toContain('|03|');
  });

  test('incluye ccategoria_uso cuando se pasa', () => {
    const sig = vehicleSignature({
      placa: 'AE123KT', marca: 'TOYOTA', modelo: 'COROLLA',
      año: '2020', uso: 'Particular', ccategoria_uso: 4,
    });
    expect(sig).toContain('4');
  });

  test('cambiar cversion produce firma distinta', () => {
    const a = vehicleSignature({
      placa: 'AE', marca: 'm', modelo: 'mo', año: '2020', uso: 'u', cversion: '01',
    });
    const b = vehicleSignature({
      placa: 'AE', marca: 'm', modelo: 'mo', año: '2020', uso: 'u', cversion: '02',
    });
    expect(a).not.toBe(b);
  });
});
