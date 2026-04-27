/**
 * Renderiza el PDF del manual de marca a PNGs (uno por página)
 * para poder revisarlos visualmente.
 */
const fs   = require('fs');
const path = require('path');

(async () => {
  const mupdf = await import('mupdf');
  const PDF_PATH = 'C:\\Users\\javier.soto\\Downloads\\Manual de Identidad-LA MUNDIAL DE SEGUROS.pdf';
  const OUT_DIR  = path.resolve(__dirname, 'manual-pages');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const buf = fs.readFileSync(PDF_PATH);
  const doc = mupdf.PDFDocument.openDocument(buf, 'application/pdf');
  const pages = doc.countPages();
  console.log(`PDF abierto: ${pages} páginas`);

  for (let i = 0; i < pages; i++) {
    const page = doc.loadPage(i);
    const matrix = mupdf.Matrix.scale(1.6, 1.6); // ~150 dpi for 96dpi base
    const pix = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true);
    const png = pix.asPNG();
    const out = path.join(OUT_DIR, `page-${String(i + 1).padStart(2, '0')}.png`);
    fs.writeFileSync(out, png);
    console.log(`✓ ${path.basename(out)}  (${(png.length / 1024).toFixed(1)} KB)`);
    pix.destroy();
    page.destroy();
  }
  doc.destroy();
})().catch((e) => { console.error('Error:', e); process.exit(1); });
