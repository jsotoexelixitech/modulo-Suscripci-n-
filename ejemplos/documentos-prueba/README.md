# Documentos de prueba — Suscripción RCV

Imágenes PNG (1920×1210) generadas para probar el flujo de carga + OCR del wizard.
Todos los documentos pertenecen al **mismo titular**, lo que permite validar la
coherencia entre pasos (cédula → licencia → vehículo → RIF).

| # | Archivo                                                    | Tipo en el wizard       | Datos clave que extrae el OCR |
|---|------------------------------------------------------------|-------------------------|-------------------------------|
| 1 | `01-cedula-maria-fernandez.png`                            | **Cédula**              | María Alejandra Fernández García · V-18.456.329 · 15/04/1990 · F |
| 2 | `02-licencia-conducir-maria-fernandez.png`                 | **Licencia de conducir**| LIC-0234567 · Categoría B · vence 30/06/2027 |
| 3 | `03-certificado-circulacion-toyota-corolla.png`            | **Certificado circulación** | Placa AE123KT · Toyota Corolla 2020 · color Plateado · serial VIN20TOYCO2020001 |
| 4 | `04-rif-maria-fernandez.png`                               | **RIF**                 | J-40123456-7 |

## Cómo usarlos

1. Levanta la app:
   - Backend: `cd server && node src/index.js`
   - Frontend: `cd frontend && npm run dev`
2. En el paso **Documentos**, arrastra cada PNG sobre la tarjeta correspondiente
   o haz clic en la tarjeta para seleccionarlo.
3. El OCR mockeado del backend reconocerá los datos y los pre-cargará en los
   pasos de **Emisión** y **Vehículo** automáticamente.

> Atajo: en `OcrStep` hay un botón **“Cargar documentos demo”** que carga
> versiones equivalentes en SVG sin abrir el explorador.

## Cómo regenerarlos

Los SVG fuente y el script viven en `../_generador/`.

```bash
cd ejemplos/_generador
npm install        # solo la primera vez
node generate.js   # regenera los 4 PNG
```

Para cambiar nombres, fechas o branding, edita las funciones `svgCedula`,
`svgLicencia`, `svgCertificado` y `svgRif` dentro de `generate.js`.
La paleta usa los colores de **La Mundial de Seguros** (navy `#1F2C66`,
azul medio `#3B6CB8`, rojo `#B82B2B`, ámbar `#F39E2A`).

> Nota: los archivos llevan una marca de agua **DEMO** y la leyenda
> *“Documento de prueba · La Mundial de Seguros”* en el pie. **No son
> documentos oficiales.**
