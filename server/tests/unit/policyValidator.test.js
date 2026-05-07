/**
 * Pruebas del validador del payload de emisión La Mundial.
 *
 * Verificamos que cada regla individual produzca el error correcto y que
 * un payload válido no produzca errores.
 */
const path = require('path');
const { validateEmissionPayload, _internal } = require(
  path.join(__dirname, '..', '..', 'src', 'services', 'lamundial', 'policyValidator'),
);

const validPayload = () => ({
  poliza: 'INT-20260507-001',
  cramo: 18,
  plan: 'RCVBAS',
  frecuencia: 'A',
  fecha_emision: '2026-05-07',

  tipo_cedula_tomador: 'V',
  rif_tomador: '12345678',
  nombre_tomador: 'JAVIER',
  apellido_tomador: 'SOTO',
  telefono_tomador: '04141234567',
  correo_tomador: 'test@example.com',
  fnac_tomador: '1990-01-15',
  direccion_tomador: 'Av. Principal',

  tipo_cedula_titular: 'V',
  rif_titular: '12345678',
  nombre_titular: 'JAVIER',
  apellido_titular: 'SOTO',

  placa: 'AE123KT',
  serial_carroceria: '1HGBH41JXMN109186',
  fano: 2020,

  mprima: 1234.56,
  mprimaext: 25.50,
  ptasa: 0.005,

  dec_persona_politica: '0',
  dec_term_y_cod: '1',
});

describe('validateEmissionPayload — payload válido', () => {
  test('payload completo y correcto → sin errores', () => {
    expect(validateEmissionPayload(validPayload())).toEqual([]);
  });
});

describe('validateEmissionPayload — null/undefined', () => {
  test('null → reporta payload requerido', () => {
    expect(validateEmissionPayload(null)).toEqual(['payload requerido']);
  });

  test('undefined → reporta payload requerido', () => {
    expect(validateEmissionPayload(undefined)).toEqual(['payload requerido']);
  });
});

describe('validateEmissionPayload — identificadores', () => {
  test('cramo distinto de 18 falla', () => {
    const p = { ...validPayload(), cramo: 22 };
    expect(validateEmissionPayload(p)).toContain('cramo debe ser 18 (RCV)');
  });

  test('plan inválido falla con detalle', () => {
    const p = { ...validPayload(), plan: 'TODO_RIESGO' };
    expect(validateEmissionPayload(p).some(e => e.includes('plan invalido'))).toBe(true);
  });

  test('frecuencia inválida falla', () => {
    const p = { ...validPayload(), frecuencia: 'X' };
    expect(validateEmissionPayload(p).some(e => e.includes('frecuencia invalida'))).toBe(true);
  });

  test('fecha emisión sin formato YYYY-MM-DD falla', () => {
    const p = { ...validPayload(), fecha_emision: '07/05/2026' };
    expect(validateEmissionPayload(p)).toContain('fecha_emision formato YYYY-MM-DD');
  });
});

describe('validateEmissionPayload — tomador', () => {
  test('tipo de cédula inválido falla', () => {
    const p = { ...validPayload(), tipo_cedula_tomador: 'X' };
    expect(validateEmissionPayload(p)).toContain('tipo_cedula_tomador invalido (V|E|J)');
  });

  test('rif tomador con menos de 6 dígitos falla', () => {
    const p = { ...validPayload(), rif_tomador: '12345' };
    expect(validateEmissionPayload(p).some(e => e.includes('rif_tomador'))).toBe(true);
  });

  test('teléfono con letras falla', () => {
    const p = { ...validPayload(), telefono_tomador: '04abc123' };
    expect(validateEmissionPayload(p)).toContain(
      'telefono_tomador invalido (8-15 digitos, opcional +)',
    );
  });

  test('correo sin @ falla', () => {
    const p = { ...validPayload(), correo_tomador: 'noesemail' };
    expect(validateEmissionPayload(p)).toContain('correo_tomador invalido');
  });

  test('menor de edad falla', () => {
    const today = new Date();
    const fnacMenor = `${today.getUTCFullYear() - 17}-01-01`;
    const p = { ...validPayload(), fnac_tomador: fnacMenor };
    expect(validateEmissionPayload(p)).toContain('tomador debe ser mayor de edad (18+)');
  });

  test('dirección vacía falla', () => {
    const p = { ...validPayload(), direccion_tomador: '   ' };
    expect(validateEmissionPayload(p)).toContain('direccion_tomador requerida');
  });
});

describe('validateEmissionPayload — vehículo', () => {
  test('placa de 5 caracteres falla', () => {
    const p = { ...validPayload(), placa: 'ABC12' };
    expect(validateEmissionPayload(p).some(e => e.includes('placa invalida'))).toBe(true);
  });

  test('placa con minúsculas falla', () => {
    const p = { ...validPayload(), placa: 'ae123kt' };
    expect(validateEmissionPayload(p).some(e => e.includes('placa invalida'))).toBe(true);
  });

  test('placa de 8 chars válida', () => {
    const p = { ...validPayload(), placa: 'AB123CDE' };
    expect(validateEmissionPayload(p).filter(e => e.includes('placa')).length).toBe(0);
  });

  test('año fuera de rango falla', () => {
    const p = { ...validPayload(), fano: 1979 };
    expect(validateEmissionPayload(p).some(e => e.includes('fano fuera de rango'))).toBe(true);
  });

  test('serial vacío falla', () => {
    const p = { ...validPayload(), serial_carroceria: '' };
    expect(validateEmissionPayload(p)).toContain('serial_carroceria requerido');
  });
});

describe('validateEmissionPayload — económicos', () => {
  test('mprima 0 falla', () => {
    const p = { ...validPayload(), mprima: 0 };
    expect(validateEmissionPayload(p)).toContain('mprima debe venir de cotizacion (> 0)');
  });

  test('ptasa negativo falla', () => {
    const p = { ...validPayload(), ptasa: -1 };
    expect(validateEmissionPayload(p)).toContain('ptasa debe venir de cotizacion (> 0)');
  });

  test('mprimaext = 0 (USD) está permitido', () => {
    const p = { ...validPayload(), mprimaext: 0 };
    expect(validateEmissionPayload(p).filter(e => e.includes('mprimaext'))).toEqual([]);
  });
});

describe('validateEmissionPayload — declaraciones', () => {
  test('dec_persona_politica no booleano "0/1" falla', () => {
    const p = { ...validPayload(), dec_persona_politica: 'sí' };
    expect(validateEmissionPayload(p)).toContain('dec_persona_politica debe ser "0" o "1"');
  });

  test('dec_term_y_cod = 0 falla (debe aceptar términos)', () => {
    const p = { ...validPayload(), dec_term_y_cod: '0' };
    expect(validateEmissionPayload(p)).toContain('dec_term_y_cod debe ser "1" (acepta terminos)');
  });
});

describe('ageInYears (helper interno)', () => {
  test('edad correcta para fecha pasada', () => {
    const fnac = `${new Date().getUTCFullYear() - 30}-01-01`;
    expect(_internal.ageInYears(fnac)).toBeGreaterThanOrEqual(29);
    expect(_internal.ageInYears(fnac)).toBeLessThanOrEqual(30);
  });

  test('formato inválido devuelve -1', () => {
    expect(_internal.ageInYears('10/04/1990')).toBe(-1);
    expect(_internal.ageInYears('')).toBe(-1);
    expect(_internal.ageInYears(null)).toBe(-1);
  });
});
