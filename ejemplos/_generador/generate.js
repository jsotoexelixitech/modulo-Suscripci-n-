/**
 * Generador de documentos de prueba (PNG) — Suscripción RCV / La Mundial de Seguros.
 *
 * Crea 4 documentos de identidad/circulación a nombre del MISMO titular
 * (María Alejandra Fernández García) coincidiendo con el OCR mock del backend
 * (server/src/services/documentService.js):
 *
 *   • cédula                → V-18.456.329, nacida 1990-04-15
 *   • licencia de conducir  → LIC-0234567, categoría B, vence 2027-06-30
 *   • certificado circulación → AE123KT · Toyota Corolla 2020 · VIN20TOYCO2020001
 *   • RIF (SENIAT)          → J-40123456-7
 *
 * Salida: ../documentos-prueba/*.png   (1600x1008, alta nitidez para OCR)
 */

const fs   = require('fs');
const path = require('path');
const sharp = require('sharp');

/* ------------------------------------------------------------------ */
/* Paleta de La Mundial + utilidades                                   */
/* ------------------------------------------------------------------ */
const C = {
  // Paleta oficial — Manual de Identidad La Mundial de Seguros
  navy:      '#0F1A5A',  // Azul Pennsylvania (principal)
  navyDeep:  '#091133',  // oscuro
  blueMid:   '#2E6DBF',  // azul brillante del logo
  blueSoft:  '#4A8DD5',  // azul claro del logo
  red:       '#E84F51',  // Rojo Imperial (secundario)
  amber:     '#F39E2A',
  paper:     '#FAF8F2',
  paperAlt:  '#F4F1E8',
  ink:       '#0F172A',
  inkSoft:   '#475569',
  border:    '#CBD5E1',
};

/** Genera barras pseudo-aleatorias de un código de barras (determinísticas por seed). */
function barcodeBars(seed = 1, width = 240, x = 0, y = 0, color = '#0F172A') {
  let s = seed * 9301 + 49297;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const out = [];
  let cx = x + 4;
  while (cx < x + width - 4) {
    const w = Math.max(1, Math.round(rand() * 5));
    if (rand() > 0.35) out.push(`<rect x="${cx}" y="${y + 4}" width="${w}" height="32" fill="${color}"/>`);
    cx += w + Math.max(1, Math.round(rand() * 3));
  }
  return out.join('');
}

/** Sello/QR placeholder estilo grid. */
function qrPlaceholder(x, y, size = 110, color = '#0F172A') {
  const cells = 13;
  const cs = size / cells;
  let s = 7;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  let out = `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="white" stroke="${color}" stroke-width="1"/>`;
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      if (rand() > 0.55) {
        out += `<rect x="${x + i * cs + 1}" y="${y + j * cs + 1}" width="${cs - 1}" height="${cs - 1}" fill="${color}"/>`;
      }
    }
  }
  // 3 esquinas estilo QR
  const corner = (cx, cy) => `
    <rect x="${cx}" y="${cy}" width="${cs * 3}" height="${cs * 3}" fill="${color}"/>
    <rect x="${cx + cs * 0.4}" y="${cy + cs * 0.4}" width="${cs * 2.2}" height="${cs * 2.2}" fill="white"/>
    <rect x="${cx + cs}"     y="${cy + cs}"     width="${cs}"       height="${cs}"       fill="${color}"/>`;
  out += corner(x, y);
  out += corner(x + size - cs * 3, y);
  out += corner(x, y + size - cs * 3);
  return out;
}

/** Marco común de documento: papel + watermark “DEMO”. */
function paperFrame(width, height, accent = C.navy) {
  return `
    <defs>
      <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"  stop-color="${C.paper}"/>
        <stop offset="100%" stop-color="${C.paperAlt}"/>
      </linearGradient>
      <pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse">
        <path d="M0 22 L22 0" stroke="${accent}" stroke-width="0.35" opacity="0.06"/>
      </pattern>
      <filter id="shadow" x="-2%" y="-2%" width="104%" height="104%">
        <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="${C.navyDeep}" flood-opacity="0.22"/>
      </filter>
    </defs>
    <rect width="${width}" height="${height}" rx="22" fill="url(#paper)" filter="url(#shadow)"/>
    <rect width="${width}" height="${height}" rx="22" fill="url(#grid)"/>
    <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="20" fill="none" stroke="${accent}" stroke-width="2" opacity="0.8"/>
    <g transform="translate(${width / 2}, ${height / 2}) rotate(-22)" opacity="0.07">
      <text font-family="Arial, sans-serif" font-size="190" font-weight="900"
            fill="${accent}" text-anchor="middle" letter-spacing="14">DEMO</text>
    </g>
  `;
}

/** Banda tricolor venezolana (amarillo / azul / rojo). */
function vzlaFlagStripe(x, y, w, h) {
  const each = h / 3;
  return `
    <rect x="${x}" y="${y}"             width="${w}" height="${each}" fill="#FDDA24"/>
    <rect x="${x}" y="${y + each}"      width="${w}" height="${each}" fill="${C.blueMid}"/>
    <rect x="${x}" y="${y + each * 2}"  width="${w}" height="${each}" fill="${C.red}"/>
  `;
}

/** Avatar/silueta placeholder. */
function avatar(x, y, size = 240) {
  return `
    <g transform="translate(${x}, ${y})">
      <rect width="${size}" height="${size * 1.2}" rx="8"
            fill="${C.blueSoft}" opacity="0.35" stroke="${C.navy}" stroke-width="2"/>
      <circle cx="${size / 2}" cy="${size * 0.42}" r="${size * 0.22}" fill="${C.navy}" opacity="0.55"/>
      <path d="M${size * 0.12} ${size * 1.18}
               Q${size * 0.12} ${size * 0.78} ${size / 2} ${size * 0.78}
               Q${size * 0.88} ${size * 0.78} ${size * 0.88} ${size * 1.18} Z"
            fill="${C.navy}" opacity="0.55"/>
      <text x="${size / 2}" y="${size * 1.13}" font-family="Arial, sans-serif"
            font-size="11" font-weight="700" fill="white" text-anchor="middle"
            letter-spacing="2">FOTO</text>
    </g>
  `;
}

/* ------------------------------------------------------------------ */
/* 1. CÉDULA DE IDENTIDAD (V-18.456.329 · María A. Fernández García)   */
/* ------------------------------------------------------------------ */
function svgCedula() {
  const W = 1600, H = 1008;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"
     font-family="'Segoe UI', Arial, sans-serif">
  ${paperFrame(W, H, C.amber)}

  <!-- Banda superior tricolor + cabecera -->
  ${vzlaFlagStripe(0, 0, W, 18)}
  <rect x="0" y="18" width="${W}" height="100" fill="${C.navyDeep}"/>
  <g transform="translate(48,38)" fill="white">
    <text font-size="20" font-weight="900" letter-spacing="3">REPÚBLICA BOLIVARIANA DE VENEZUELA</text>
    <text y="32" font-size="14" font-weight="600" letter-spacing="2.5" opacity="0.85">
      SERVICIO ADMINISTRATIVO DE IDENTIFICACIÓN, MIGRACIÓN Y EXTRANJERÍA · SAIME
    </text>
  </g>
  <g transform="translate(${W - 140},44)">
    <circle cx="32" cy="32" r="32" fill="white" opacity="0.95"/>
    <text x="32" y="42" font-size="32" font-weight="900" fill="${C.navyDeep}" text-anchor="middle">★</text>
  </g>

  <!-- Título -->
  <g transform="translate(48,160)">
    <text font-size="44" font-weight="900" fill="${C.ink}" letter-spacing="-0.5">CÉDULA DE IDENTIDAD</text>
    <rect y="20" width="120" height="4" fill="${C.amber}"/>
    <rect x="120" y="20" width="80" height="4" fill="${C.red}"/>
    <text y="60" font-size="18" font-weight="600" fill="${C.inkSoft}" letter-spacing="2">
      DOCUMENTO PERSONAL E INTRANSFERIBLE
    </text>
  </g>

  <!-- Foto -->
  ${avatar(48, 280, 280)}

  <!-- Datos -->
  <g transform="translate(380,280)" font-family="'Courier New', monospace">
    <g>
      <text font-size="14" font-weight="700" fill="${C.navy}" letter-spacing="2">CÉDULA</text>
      <text y="46" font-size="56" font-weight="900" fill="${C.red}">V-18.456.329</text>
    </g>

    <g transform="translate(0,110)">
      <text font-size="13" font-weight="700" fill="${C.navy}" letter-spacing="2">APELLIDOS</text>
      <text y="32" font-size="28" font-weight="800" fill="${C.ink}">FERNÁNDEZ GARCÍA</text>
    </g>

    <g transform="translate(0,180)">
      <text font-size="13" font-weight="700" fill="${C.navy}" letter-spacing="2">NOMBRES</text>
      <text y="32" font-size="28" font-weight="800" fill="${C.ink}">MARÍA ALEJANDRA</text>
    </g>

    <g transform="translate(0,260)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">FECHA DE NACIMIENTO</text>
      <text y="28" font-size="22" font-weight="700" fill="${C.ink}">15 / ABRIL / 1990</text>
    </g>

    <g transform="translate(360,260)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">SEXO</text>
      <text y="28" font-size="22" font-weight="700" fill="${C.ink}">F</text>
    </g>

    <g transform="translate(480,260)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">ESTADO CIVIL</text>
      <text y="28" font-size="22" font-weight="700" fill="${C.ink}">SOLTERA</text>
    </g>

    <g transform="translate(0,340)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">NACIONALIDAD</text>
      <text y="28" font-size="22" font-weight="700" fill="${C.ink}">VENEZOLANA</text>
    </g>

    <g transform="translate(360,340)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">LUGAR DE NACIMIENTO</text>
      <text y="28" font-size="22" font-weight="700" fill="${C.ink}">CARACAS · DTTO. CAPITAL</text>
    </g>

    <g transform="translate(0,420)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">FECHA DE EXPEDICIÓN</text>
      <text y="28" font-size="22" font-weight="700" fill="${C.ink}">22 / 08 / 2018</text>
    </g>

    <g transform="translate(360,420)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">VENCIMIENTO</text>
      <text y="28" font-size="22" font-weight="700" fill="${C.red}">22 / 08 / 2028</text>
    </g>
  </g>

  <!-- Firma + código MRZ -->
  <g transform="translate(48,640)">
    <line x1="0" y1="0" x2="280" y2="0" stroke="${C.navy}" opacity="0.5"/>
    <path d="M20 -8 Q60 -34 100 -16 T200 -10 Q240 -28 270 -8" stroke="${C.navy}" stroke-width="1.6" fill="none" opacity="0.7"/>
    <text y="22" font-size="12" font-weight="700" fill="${C.inkSoft}" letter-spacing="2">FIRMA TITULAR</text>
  </g>

  <!-- QR + Barcode -->
  ${qrPlaceholder(W - 200, 280, 150, C.navyDeep)}
  <g transform="translate(${W - 200},460)">
    <rect width="150" height="36" fill="white" stroke="${C.border}"/>
    ${barcodeBars(11, 150, 0, 0, C.navyDeep)}
    <text y="50" font-size="9" font-weight="700" fill="${C.ink}" font-family="'Courier New', monospace">V18456329</text>
  </g>

  <!-- Línea MRZ -->
  <g transform="translate(48,790)" font-family="'Courier New', monospace">
    <rect x="-12" y="-26" width="${W - 72}" height="120" fill="white" stroke="${C.border}"/>
    <text font-size="22" font-weight="700" fill="${C.ink}" letter-spacing="3">
      IDVEN18456329&lt;&lt;0123456&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;
    </text>
    <text y="32" font-size="22" font-weight="700" fill="${C.ink}" letter-spacing="3">
      9004154F2808224VEN&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;0
    </text>
    <text y="64" font-size="22" font-weight="700" fill="${C.ink}" letter-spacing="3">
      FERNANDEZ&lt;GARCIA&lt;&lt;MARIA&lt;ALEJANDRA&lt;&lt;&lt;&lt;
    </text>
  </g>

  <!-- Footer -->
  <g transform="translate(48,${H - 36})">
    <text font-size="11" font-weight="600" fill="${C.inkSoft}" letter-spacing="2">
      DOCUMENTO ELECTRÓNICO DE PRUEBA · GENERADO PARA LA MUNDIAL DE SEGUROS · SUSCRIPCIÓN RCV
    </text>
  </g>
</svg>`;
}

/* ------------------------------------------------------------------ */
/* 2. LICENCIA DE CONDUCIR (LIC-0234567 · cat. B · vence 30/06/2027)   */
/* ------------------------------------------------------------------ */
function svgLicencia() {
  const W = 1600, H = 1008;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"
     font-family="'Segoe UI', Arial, sans-serif">
  ${paperFrame(W, H, C.blueMid)}

  ${vzlaFlagStripe(0, 0, W, 18)}
  <rect x="0" y="18" width="${W}" height="110" fill="${C.navy}"/>
  <g transform="translate(48,42)" fill="white">
    <text font-size="22" font-weight="900" letter-spacing="3">REPÚBLICA BOLIVARIANA DE VENEZUELA</text>
    <text y="34" font-size="14" font-weight="600" letter-spacing="2" opacity="0.88">
      INSTITUTO NACIONAL DE TRANSPORTE TERRESTRE · INTT
    </text>
  </g>
  <g transform="translate(${W - 150},48)">
    <circle cx="32" cy="32" r="32" fill="white" opacity="0.95"/>
    <text x="32" y="42" font-size="34" font-weight="900" fill="${C.navy}" text-anchor="middle">+</text>
  </g>

  <g transform="translate(48,170)">
    <text font-size="44" font-weight="900" fill="${C.ink}" letter-spacing="-0.5">LICENCIA DE CONDUCIR</text>
    <rect y="20" width="100" height="4" fill="${C.blueMid}"/>
    <rect x="100" y="20" width="100" height="4" fill="${C.amber}"/>
    <text y="60" font-size="16" font-weight="700" fill="${C.inkSoft}" letter-spacing="2">
      CATEGORÍA B · TRANSPORTE PARTICULAR
    </text>
  </g>

  ${avatar(48, 290, 280)}

  <g transform="translate(380,290)" font-family="'Courier New', monospace">
    <g>
      <text font-size="14" font-weight="700" fill="${C.navy}" letter-spacing="2">N° DE LICENCIA</text>
      <text y="46" font-size="48" font-weight="900" fill="${C.navy}">LIC-0234567</text>
    </g>

    <g transform="translate(0,110)">
      <text font-size="13" font-weight="700" fill="${C.navy}" letter-spacing="2">TITULAR</text>
      <text y="32" font-size="26" font-weight="800" fill="${C.ink}">FERNÁNDEZ GARCÍA, MARÍA ALEJANDRA</text>
    </g>

    <g transform="translate(0,180)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">CÉDULA</text>
      <text y="28" font-size="22" font-weight="700" fill="${C.ink}">V-18.456.329</text>
    </g>

    <g transform="translate(280,180)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">CATEGORÍA</text>
      <g transform="translate(0,6)">
        <rect width="50" height="40" rx="6" fill="${C.navy}"/>
        <text x="25" y="30" font-size="28" font-weight="900" fill="white" text-anchor="middle">B</text>
      </g>
    </g>

    <g transform="translate(420,180)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">GRUPO SANGUÍNEO</text>
      <text y="28" font-size="22" font-weight="700" fill="${C.ink}">O+</text>
    </g>

    <g transform="translate(0,260)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">FECHA DE EMISIÓN</text>
      <text y="28" font-size="22" font-weight="700" fill="${C.ink}">12 / 06 / 2022</text>
    </g>

    <g transform="translate(280,260)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">VENCIMIENTO</text>
      <text y="28" font-size="22" font-weight="800" fill="${C.red}">30 / 06 / 2027</text>
    </g>

    <g transform="translate(0,330)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">RESTRICCIONES</text>
      <text y="28" font-size="20" font-weight="700" fill="${C.ink}">NINGUNA</text>
    </g>

    <g transform="translate(280,330)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">DONANTE DE ÓRGANOS</text>
      <text y="28" font-size="20" font-weight="700" fill="${C.blueMid}">SÍ</text>
    </g>

    <g transform="translate(0,400)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">DIRECCIÓN</text>
      <text y="26" font-size="18" font-weight="700" fill="${C.ink}">AV. PRINCIPAL DE LOS PALOS GRANDES</text>
      <text y="50" font-size="18" font-weight="700" fill="${C.ink}">RES. PARQUE ÁVILA, PISO 6 · CARACAS</text>
    </g>
  </g>

  <!-- QR + Barcode -->
  ${qrPlaceholder(W - 200, 290, 150, C.navy)}
  <g transform="translate(${W - 200},470)">
    <rect width="150" height="36" fill="white" stroke="${C.border}"/>
    ${barcodeBars(7, 150, 0, 0, C.navy)}
    <text y="50" font-size="9" font-weight="700" fill="${C.ink}" font-family="'Courier New', monospace">LIC0234567B</text>
  </g>

  <!-- Firmas -->
  <g transform="translate(48,790)">
    <line x1="0" y1="0" x2="280" y2="0" stroke="${C.navy}" opacity="0.5"/>
    <path d="M20 -8 Q60 -32 100 -14 T200 -10 Q240 -26 270 -8" stroke="${C.navy}" stroke-width="1.6" fill="none" opacity="0.7"/>
    <text y="22" font-size="12" font-weight="700" fill="${C.inkSoft}" letter-spacing="2">FIRMA TITULAR</text>
  </g>

  <g transform="translate(${W - 380},790)">
    <line x1="0" y1="0" x2="280" y2="0" stroke="${C.navy}" opacity="0.5"/>
    <text y="22" font-size="12" font-weight="700" fill="${C.inkSoft}" letter-spacing="2">PRESIDENTE INTT</text>
  </g>

  <g transform="translate(48,${H - 36})">
    <text font-size="11" font-weight="600" fill="${C.inkSoft}" letter-spacing="2">
      VÁLIDO EN TODO EL TERRITORIO NACIONAL · WWW.INTT.GOB.VE · DOCUMENTO DE PRUEBA · LA MUNDIAL DE SEGUROS
    </text>
  </g>
</svg>`;
}

/* ------------------------------------------------------------------ */
/* 3. CERTIFICADO DE CIRCULACIÓN (AE123KT · Toyota Corolla 2020)        */
/* ------------------------------------------------------------------ */
function svgCertificado() {
  const W = 1600, H = 1008;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"
     font-family="'Segoe UI', Arial, sans-serif">
  ${paperFrame(W, H, C.red)}

  ${vzlaFlagStripe(0, 0, W, 18)}
  <rect x="0" y="18" width="${W}" height="110" fill="${C.red}"/>
  <g transform="translate(48,42)" fill="white">
    <text font-size="22" font-weight="900" letter-spacing="3">REPÚBLICA BOLIVARIANA DE VENEZUELA</text>
    <text y="34" font-size="14" font-weight="600" letter-spacing="2" opacity="0.92">
      INSTITUTO NACIONAL DE TRANSPORTE TERRESTRE · DIRECCIÓN DE REGISTRO VEHICULAR
    </text>
  </g>
  <g transform="translate(${W - 150},48)">
    <circle cx="32" cy="32" r="32" fill="white" opacity="0.95"/>
    <text x="32" y="44" font-size="32" font-weight="900" fill="${C.red}" text-anchor="middle">⚐</text>
  </g>

  <g transform="translate(48,170)">
    <text font-size="40" font-weight="900" fill="${C.ink}" letter-spacing="-0.5">CERTIFICADO DE CIRCULACIÓN</text>
    <rect y="18" width="120" height="4" fill="${C.red}"/>
    <rect x="120" y="18" width="80" height="4" fill="${C.navy}"/>
    <text y="58" font-size="16" font-weight="700" fill="${C.inkSoft}" letter-spacing="2">
      VEHÍCULO PARTICULAR · USO LIBRE
    </text>
  </g>

  <!-- Placa destacada -->
  <g transform="translate(48,290)">
    <rect width="380" height="170" rx="14" fill="white" stroke="${C.ink}" stroke-width="3"/>
    <rect width="380" height="38" fill="${C.navyDeep}"/>
    <text x="190" y="26" font-size="16" font-weight="800" fill="white" text-anchor="middle" letter-spacing="3">VENEZUELA</text>
    <text x="190" y="125" font-size="76" font-weight="900" fill="${C.ink}" text-anchor="middle"
          font-family="'Courier New', monospace" letter-spacing="6">AE123KT</text>
    <text x="190" y="158" font-size="13" font-weight="700" fill="${C.inkSoft}" text-anchor="middle" letter-spacing="3">
      PLACA OFICIAL
    </text>
  </g>

  <!-- Datos del vehículo -->
  <g transform="translate(480,290)" font-family="'Courier New', monospace">
    <g>
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">MARCA</text>
      <text y="28" font-size="24" font-weight="800" fill="${C.ink}">TOYOTA</text>
    </g>
    <g transform="translate(280,0)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">MODELO</text>
      <text y="28" font-size="24" font-weight="800" fill="${C.ink}">COROLLA</text>
    </g>
    <g transform="translate(560,0)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">AÑO</text>
      <text y="28" font-size="24" font-weight="800" fill="${C.ink}">2020</text>
    </g>

    <g transform="translate(0,80)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">COLOR</text>
      <text y="28" font-size="24" font-weight="800" fill="${C.ink}">PLATEADO</text>
    </g>
    <g transform="translate(280,80)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">TIPO</text>
      <text y="28" font-size="24" font-weight="800" fill="${C.ink}">SEDÁN</text>
    </g>
    <g transform="translate(560,80)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">CILINDRADA</text>
      <text y="28" font-size="24" font-weight="800" fill="${C.ink}">1.8L</text>
    </g>

    <g transform="translate(0,160)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">N° SERIAL CARROCERÍA</text>
      <text y="28" font-size="22" font-weight="800" fill="${C.ink}">VIN20TOYCO2020001</text>
    </g>
    <g transform="translate(560,160)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">N° MOTOR</text>
      <text y="28" font-size="22" font-weight="800" fill="${C.ink}">2ZR-FE-0987654</text>
    </g>
  </g>

  <!-- Propietario -->
  <g transform="translate(48,520)" font-family="'Courier New', monospace">
    <rect x="-12" y="-22" width="${W - 72}" height="160" rx="10" fill="white" stroke="${C.border}"/>
    <text font-size="13" font-weight="800" fill="${C.red}" letter-spacing="3">PROPIETARIO</text>
    <text y="36" font-size="28" font-weight="800" fill="${C.ink}">FERNÁNDEZ GARCÍA, MARÍA ALEJANDRA</text>
    <g transform="translate(0,72)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">CÉDULA</text>
      <text y="28" font-size="22" font-weight="700" fill="${C.ink}">V-18.456.329</text>
    </g>
    <g transform="translate(380,72)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">USO</text>
      <text y="28" font-size="22" font-weight="700" fill="${C.ink}">PARTICULAR</text>
    </g>
    <g transform="translate(700,72)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">SERVICIO</text>
      <text y="28" font-size="22" font-weight="700" fill="${C.ink}">PRIVADO</text>
    </g>
    <g transform="translate(1000,72)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">CARGA / PASAJEROS</text>
      <text y="28" font-size="22" font-weight="700" fill="${C.ink}">5</text>
    </g>
  </g>

  <!-- Datos administrativos + QR + barcode -->
  <g transform="translate(48,720)" font-family="'Courier New', monospace">
    <g>
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">FECHA DE INSCRIPCIÓN</text>
      <text y="26" font-size="20" font-weight="700" fill="${C.ink}">10 / 03 / 2020</text>
    </g>
    <g transform="translate(280,0)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">N° DE CERTIFICADO</text>
      <text y="26" font-size="20" font-weight="700" fill="${C.ink}">CC-202003-018765</text>
    </g>
    <g transform="translate(620,0)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">VENCE TIMBRE FISCAL</text>
      <text y="26" font-size="20" font-weight="800" fill="${C.red}">31 / 12 / 2026</text>
    </g>
  </g>

  ${qrPlaceholder(W - 200, 700, 130, C.red)}

  <g transform="translate(48,830)">
    <rect width="600" height="36" fill="white" stroke="${C.border}"/>
    ${barcodeBars(13, 600, 0, 0, C.red)}
    <text y="50" font-size="10" font-weight="700" fill="${C.ink}" font-family="'Courier New', monospace">
      AE123KT-VIN20TOYCO2020001-V18456329
    </text>
  </g>

  <g transform="translate(48,${H - 36})">
    <text font-size="11" font-weight="600" fill="${C.inkSoft}" letter-spacing="2">
      DOCUMENTO HABILITANTE PARA LA CIRCULACIÓN · DEBE PORTARSE EN EL VEHÍCULO · DEMO LA MUNDIAL DE SEGUROS
    </text>
  </g>
</svg>`;
}

/* ------------------------------------------------------------------ */
/* 4. RIF (J-40123456-7 · SENIAT)                                       */
/* ------------------------------------------------------------------ */
function svgRif() {
  const W = 1600, H = 1008;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"
     font-family="'Segoe UI', Arial, sans-serif">
  ${paperFrame(W, H, C.navy)}

  ${vzlaFlagStripe(0, 0, W, 18)}
  <rect x="0" y="18" width="${W}" height="110" fill="${C.navy}"/>
  <g transform="translate(48,42)" fill="white">
    <text font-size="22" font-weight="900" letter-spacing="3">SERVICIO NACIONAL INTEGRADO DE ADMINISTRACIÓN ADUANERA Y TRIBUTARIA</text>
    <text y="34" font-size="14" font-weight="600" letter-spacing="2" opacity="0.88">
      SENIAT · MINISTERIO DEL PODER POPULAR DE ECONOMÍA Y FINANZAS
    </text>
  </g>
  <g transform="translate(${W - 150},48)">
    <circle cx="32" cy="32" r="32" fill="white" opacity="0.95"/>
    <text x="32" y="44" font-size="30" font-weight="900" fill="${C.navy}" text-anchor="middle">$</text>
  </g>

  <g transform="translate(48,170)">
    <text font-size="44" font-weight="900" fill="${C.ink}" letter-spacing="-0.5">REGISTRO DE INFORMACIÓN FISCAL</text>
    <rect y="20" width="120" height="4" fill="${C.navy}"/>
    <rect x="120" y="20" width="80" height="4" fill="${C.amber}"/>
    <text y="60" font-size="16" font-weight="700" fill="${C.inkSoft}" letter-spacing="2">
      CERTIFICADO ELECTRÓNICO · CONTRIBUYENTE FORMAL
    </text>
  </g>

  <!-- RIF destacado -->
  <g transform="translate(48,290)">
    <rect width="700" height="130" rx="14" fill="${C.navy}"/>
    <text x="40" y="46" font-size="14" font-weight="800" fill="white" letter-spacing="3" opacity="0.85">
      N° DE REGISTRO ÚNICO DE INFORMACIÓN FISCAL
    </text>
    <text x="40" y="108" font-size="64" font-weight="900" fill="white"
          font-family="'Courier New', monospace" letter-spacing="6">J-40123456-7</text>
  </g>

  <!-- QR -->
  ${qrPlaceholder(W - 220, 290, 160, C.navy)}

  <!-- Datos del contribuyente -->
  <g transform="translate(48,460)" font-family="'Courier New', monospace">
    <rect x="-12" y="-22" width="${W - 72}" height="320" rx="10" fill="white" stroke="${C.border}"/>

    <text font-size="14" font-weight="800" fill="${C.navy}" letter-spacing="3">DATOS DEL CONTRIBUYENTE</text>

    <g transform="translate(0,40)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">RAZÓN SOCIAL / NOMBRE</text>
      <text y="32" font-size="26" font-weight="800" fill="${C.ink}">FERNÁNDEZ GARCÍA, MARÍA ALEJANDRA</text>
    </g>

    <g transform="translate(0,110)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">CÉDULA DE IDENTIDAD</text>
      <text y="28" font-size="22" font-weight="700" fill="${C.ink}">V-18.456.329</text>
    </g>
    <g transform="translate(380,110)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">FECHA DE INSCRIPCIÓN</text>
      <text y="28" font-size="22" font-weight="700" fill="${C.ink}">12 / 09 / 2019</text>
    </g>
    <g transform="translate(820,110)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">VIGENCIA</text>
      <text y="28" font-size="22" font-weight="800" fill="${C.red}">12 / 09 / 2027</text>
    </g>

    <g transform="translate(0,180)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">ACTIVIDAD ECONÓMICA</text>
      <text y="28" font-size="20" font-weight="700" fill="${C.ink}">SERVICIOS PROFESIONALES Y ASESORÍA INTEGRAL</text>
    </g>

    <g transform="translate(0,240)">
      <text font-size="12" font-weight="700" fill="${C.navy}" letter-spacing="2">DIRECCIÓN FISCAL</text>
      <text y="26" font-size="18" font-weight="700" fill="${C.ink}">AV. FRANCISCO DE MIRANDA, EDIF. CENTRO PLAZA, TORRE A, OFIC. 12-A</text>
      <text y="50" font-size="18" font-weight="700" fill="${C.ink}">CHACAO · MIRANDA · 1060</text>
    </g>
  </g>

  <!-- Sello + barcode -->
  <g transform="translate(${W - 280},810)">
    <circle cx="80" cy="40" r="60" fill="none" stroke="${C.red}" stroke-width="3" opacity="0.85"/>
    <circle cx="80" cy="40" r="50" fill="none" stroke="${C.red}" stroke-width="1.5" opacity="0.7"/>
    <text x="80" y="32" font-size="11" font-weight="900" fill="${C.red}" text-anchor="middle" letter-spacing="2">SENIAT</text>
    <text x="80" y="50" font-size="9"  font-weight="800" fill="${C.red}" text-anchor="middle" letter-spacing="2">CONTRIBUYENTE</text>
    <text x="80" y="64" font-size="9"  font-weight="800" fill="${C.red}" text-anchor="middle" letter-spacing="2">VIGENTE</text>
  </g>

  <g transform="translate(48,830)">
    <rect width="500" height="36" fill="white" stroke="${C.border}"/>
    ${barcodeBars(21, 500, 0, 0, C.navy)}
    <text y="50" font-size="10" font-weight="700" fill="${C.ink}" font-family="'Courier New', monospace">
      RIF-J401234567-V18456329
    </text>
  </g>

  <g transform="translate(48,${H - 36})">
    <text font-size="11" font-weight="600" fill="${C.inkSoft}" letter-spacing="2">
      DOCUMENTO ELECTRÓNICO VERIFICABLE EN WWW.SENIAT.GOB.VE · DEMO LA MUNDIAL DE SEGUROS · USO INTERNO
    </text>
  </g>
</svg>`;
}

/* ------------------------------------------------------------------ */
/* Render → PNG                                                        */
/* ------------------------------------------------------------------ */
const OUT_DIR = path.resolve(__dirname, '..', 'documentos-prueba');
fs.mkdirSync(OUT_DIR, { recursive: true });

const docs = [
  { file: '01-cedula-maria-fernandez.png',                  build: svgCedula },
  { file: '02-licencia-conducir-maria-fernandez.png',       build: svgLicencia },
  { file: '03-certificado-circulacion-toyota-corolla.png',  build: svgCertificado },
  { file: '04-rif-maria-fernandez.png',                     build: svgRif },
];

(async () => {
  for (const { file, build } of docs) {
    const svg = build();
    const out = path.join(OUT_DIR, file);
    await sharp(Buffer.from(svg), { density: 220 })
      .resize({ width: 1920, withoutEnlargement: false })
      .png({ compressionLevel: 9, quality: 95 })
      .toFile(out);
    const { size } = fs.statSync(out);
    console.log(`✓ ${file.padEnd(50)} ${(size / 1024).toFixed(1)} KB`);
  }
  console.log(`\nGenerados en: ${OUT_DIR}`);
})().catch(err => {
  console.error('Error generando documentos:', err);
  process.exit(1);
});
