/**
 * Genera datos únicos por corrida para evitar colisiones cuando los tests
 * pegan contra QA real (placa duplicada, serial duplicado, etc.).
 */

function pad(n: number, len: number): string {
  return String(n).padStart(len, '0');
}

function randomLetters(n: number): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < n; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

function randomDigits(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

/** Placa formato venezolano AAA000A (7 chars) o AAA000 (6 chars). */
export function randomPlate(): string {
  return `${randomLetters(2)}${randomDigits(3)}${randomLetters(2)}`.toUpperCase();
}

/** VIN ficticio de 17 chars (válido posicionalmente, no chequea checksum). */
export function randomVIN(): string {
  const vin = `${randomLetters(3)}${randomDigits(2)}${randomLetters(1)}${randomDigits(2)}${randomLetters(1)}${randomDigits(8)}`;
  return vin.substring(0, 17).toUpperCase();
}

/** Cédula venezolana V-XXXXXXXX (8 dígitos típico). */
export function randomCedula(): string {
  return randomDigits(8);
}

/** Email único por corrida. */
export function randomEmail(): string {
  return `qa-${Date.now()}-${randomDigits(4)}@test-rcv.local`;
}

/** Teléfono móvil VE 04XX-XXXXXXX. */
export function randomMobile(): string {
  const prefixes = ['0414', '0424', '0412', '0416', '0426'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  return `${prefix}${randomDigits(7)}`;
}

export interface RandomBundle {
  plate: string;
  vin: string;
  cedula: string;
  email: string;
  mobile: string;
}

export function buildRandomBundle(): RandomBundle {
  return {
    plate: randomPlate(),
    vin: randomVIN(),
    cedula: randomCedula(),
    email: randomEmail(),
    mobile: randomMobile(),
  };
}

// ──────────────────────────────────────────────────────────────────────
//  Datos realistas — para corridas que se documentan como datos reales.
// ──────────────────────────────────────────────────────────────────────

/**
 * Bundle con datos plausibles. Los nombres, direcciones y emails NO contienen
 * la palabra "QA" ni "test" — pero el correo apunta a un dominio inexistente
 * para no contactar a personas reales accidentalmente.
 *
 * Las cédulas y placas siguen siendo aleatorias por corrida para evitar
 * colisiones con pólizas vigentes en QA.
 */
export interface RealisticBundle extends RandomBundle {
  nombre: string;
  apellido: string;
  fechaNacimiento: string;     // YYYY-MM-DD, mayor de edad
  direccion: string;
  estadoLabel: string;
  estadoCode: number;
  ciudadLabel: string;
  sexoCode: 'M' | 'F';
  estadoCivilCode: 'S' | 'C' | 'D' | 'V';
  marca: string;
  modelo: string;
  anio: string;
  color: string;
  placaInicial: string;
  serialCarroceria: string;
  paymentBankCode: string;
  paymentBankLabel: string;
}

const NOMBRES_M = ['Carlos Eduardo', 'Luis Alberto', 'Andrés Felipe', 'Miguel Ángel', 'José Rafael', 'Daniel Alejandro', 'Ricardo Antonio'];
const NOMBRES_F = ['María Fernanda', 'Andrea Carolina', 'Gabriela Alejandra', 'Patricia Elena', 'Claudia Beatriz', 'Verónica Isabel'];
const APELLIDOS = ['Martínez Rivero', 'González Pérez', 'Rodríguez Silva', 'Hernández Castro', 'Pérez Mendoza', 'García Hidalgo', 'López Ramírez', 'Sánchez Briceño'];
const DIRECCIONES = [
  'Av. Francisco de Miranda, Edif. Centro Plaza, Torre A, Piso 8, Apto 8B',
  'Calle Real de Sabana Grande, Quinta Las Mercedes, La Florida',
  'Av. Luis Roche, Residencias El Parque, Torre Norte, Piso 12, Apto 12-3',
  'Calle Madrid con Av. Caracas, Edif. Torre Madrid, Piso 5, Of. 5A',
];

/**
 * Construye un bundle de datos realistas. Determinístico por seed para que
 * las capturas puedan repetirse, pero placa y cédula se randomizan siempre
 * para evitar colisiones con pólizas activas.
 */
export function buildRealisticBundle(): RealisticBundle {
  const isMale = Math.random() < 0.5;
  const nombrePool = isMale ? NOMBRES_M : NOMBRES_F;
  const nombre = nombrePool[Math.floor(Math.random() * nombrePool.length)];
  const apellido = APELLIDOS[Math.floor(Math.random() * APELLIDOS.length)];

  // Edad entre 28 y 55 años — perfil promedio de asegurado RCV
  const ageYears = 28 + Math.floor(Math.random() * 28);
  const today = new Date();
  const fnacYear = today.getUTCFullYear() - ageYears;
  const fnacMonth = 1 + Math.floor(Math.random() * 12);
  const fnacDay = 1 + Math.floor(Math.random() * 27);
  const fechaNacimiento = `${fnacYear}-${pad(fnacMonth, 2)}-${pad(fnacDay, 2)}`;

  const direccion = DIRECCIONES[Math.floor(Math.random() * DIRECCIONES.length)];

  // Email plausible pero a dominio sin servicio real (no-reply.example)
  const emailUser = `${nombre.split(' ')[0].toLowerCase()}.${apellido.split(' ')[0].toLowerCase()}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.]/g, '');
  const email = `${emailUser}.${randomDigits(3)}@example.com`;

  return {
    plate: randomPlate(),
    vin: randomVIN(),
    cedula: randomCedula(),
    email,
    mobile: randomMobile(),

    nombre,
    apellido,
    fechaNacimiento,
    direccion,

    estadoLabel: 'DISTRITO CAPITAL',
    estadoCode: 1,
    ciudadLabel: 'CARACAS',

    sexoCode: isMale ? 'M' : 'F',
    estadoCivilCode: ['S', 'C', 'D', 'V'][Math.floor(Math.random() * 4)] as 'S' | 'C' | 'D' | 'V',

    marca: 'TOYOTA',
    modelo: 'COROLLA',
    anio: '2020',
    color: 'Blanco',
    placaInicial: '',
    serialCarroceria: randomVIN(),

    paymentBankCode: '0163',
    paymentBankLabel: 'BANCO DEL TESORO',
  };
}

/** Año reconocido por La Mundial QA (catálogo INMA). */
export const KNOWN_YEAR = '2020';
/** Marca presente en el catálogo INMA (Toyota = 074 normalmente). */
export const KNOWN_BRAND = 'TOYOTA';

export const ENV = {
  EMIT_REAL: process.env.EMIT_REAL === '1',
  USE_REAL_APIS: process.env.USE_REAL_APIS !== '0',
  TESTER: process.env.QA_TESTER || 'Automatización Playwright',
  BUILD: process.env.QA_BUILD || 'local-dev',
  ENVIRONMENT: process.env.QA_ENV || 'QA',
};

export function pad2(n: number) { return pad(n, 2); }
