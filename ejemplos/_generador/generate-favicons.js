/**
 * Genera los favicons de La Mundial usando el isotipo OFICIAL tal cual,
 * con fondo TRANSPARENTE (sin lienzo navy alrededor).
 *
 * Source: public/logo-isotipo.png  (M-symbol con fondo negro)
 *
 * Pasos:
 *  1) Chroma-key del fondo negro → alpha transparente (anti-aliased).
 *  2) Crop ajustado al bounding box del símbolo (sin espacio en blanco).
 *  3) Exporta los tamaños estándar como PNG transparentes.
 *  4) Genera favicon.svg vectorial con el isotipo embebido (sin fondo).
 */
const fs    = require('fs');
const path  = require('path');
const sharp = require('sharp');

const SRC = path.resolve(__dirname, '..', '..', 'frontend', 'public', 'logo-isotipo.png');
const OUT = path.resolve(__dirname, '..', '..', 'frontend', 'public');

/** Convierte el fondo negro a alpha transparente (con anti-aliasing). */
async function chromaKey() {
  const { data, info } = await sharp(SRC)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.from(data);
  const lo = 18;
  const hi = 55;

  for (let i = 0; i < out.length; i += 4) {
    const lum = 0.299 * out[i] + 0.587 * out[i + 1] + 0.114 * out[i + 2];
    if (lum <= lo) {
      out[i + 3] = 0;
    } else if (lum < hi) {
      out[i + 3] = Math.round(((lum - lo) / (hi - lo)) * 255);
    }
  }

  return sharp(out, { raw: info }).png().toBuffer();
}

/** Recorta los pixeles transparentes alrededor del símbolo. */
async function trimTransparent(buf) {
  return sharp(buf)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 5 })
    .toBuffer();
}

/** Centra el símbolo dentro de un lienzo cuadrado transparente con padding. */
async function squarePadded(buf, size, paddingPct = 0.06) {
  const inner = Math.round(size * (1 - paddingPct * 2));
  const symbol = await sharp(buf)
    .resize({
      width: inner,
      height: inner,
      fit: 'inside',
      kernel: sharp.kernel.lanczos3,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: symbol, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

(async () => {
  console.log('· Source:', SRC);
  const keyed = await chromaKey();
  console.log('✓ Chroma-key del fondo negro aplicado');

  const trimmed = await trimTransparent(keyed);
  console.log('✓ Recortado a bounding box');

  // Versión transparente reusable también desde el frontend (logos pequeños)
  const isotipoTransparente = await sharp(trimmed)
    .resize({ width: 1024, fit: 'inside' })
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(OUT, 'logo-isotipo-transparente.png'), isotipoTransparente);
  console.log(`✓ logo-isotipo-transparente.png  ${(isotipoTransparente.length / 1024).toFixed(1)} KB`);

  // Tamaños PNG estándar (sin fondo, transparentes)
  const sizes = [
    { size: 32,  name: 'favicon-32.png' },
    { size: 64,  name: 'favicon-64.png' },
    { size: 180, name: 'apple-touch-icon.png' },
    { size: 192, name: 'icon-192.png' },
    { size: 512, name: 'icon-512.png' },
  ];

  for (const { size, name } of sizes) {
    const out = await squarePadded(trimmed, size, 0.04);
    fs.writeFileSync(path.join(OUT, name), out);
    const kb = (out.length / 1024).toFixed(1);
    console.log(`✓ ${name.padEnd(28)} ${size}x${size}  ${kb} KB`);
  }

  // Favicon SVG vectorial (isotipo embebido, sin fondo)
  const symbolForSvg = await sharp(trimmed)
    .resize(800, 800, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const meta = await sharp(symbolForSvg).metadata();
  const symbolB64 = symbolForSvg.toString('base64');

  // Calcula posición centrada para preservar aspect ratio
  const vbW = 512;
  const vbH = 512;
  const aspect = meta.width / meta.height;
  let drawW, drawH;
  if (aspect >= 1) {
    drawW = vbW * 0.92;
    drawH = drawW / aspect;
  } else {
    drawH = vbH * 0.92;
    drawW = drawH * aspect;
  }
  const x = (vbW - drawW) / 2;
  const y = (vbH - drawH) / 2;

  const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}">
  <image href="data:image/png;base64,${symbolB64}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${drawW.toFixed(1)}" height="${drawH.toFixed(1)}" preserveAspectRatio="xMidYMid meet"/>
</svg>
`;
  fs.writeFileSync(path.join(OUT, 'favicon.svg'), faviconSvg);
  console.log(`✓ favicon.svg                  vector (${(faviconSvg.length / 1024).toFixed(1)} KB)`);

  fs.copyFileSync(path.join(OUT, 'favicon-32.png'), path.join(OUT, 'favicon.ico'));
  console.log(`✓ favicon.ico                  alias del PNG 32`);

  console.log('\nTodos los favicons en:', OUT);
})().catch((e) => { console.error('Error:', e); process.exit(1); });
