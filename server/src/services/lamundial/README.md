# La Mundial de Seguros - Integracion API real

Cliente y orquestacion para cotizar/emitir polizas RCV contra la API de La Mundial de Seguros.

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `lamundialClient.js` | Cliente HTTP de bajo nivel. Habla con La Mundial. |
| `policyService.js`   | Orquestacion: arma payload, valida, cotiza, emite. |
| `policyMapper.js`    | Convierte el `wizardState` -> payload de La Mundial. |
| `policyValidator.js` | Validacion local del payload **antes** de enviar (fail-fast). |
| `catalogs.js`        | INMA: marcas, modelos, versiones por anio. |

## Flujo

```
Frontend                  Backend                     La Mundial
   |                         |                            |
   |-- POST /policies/emit ->|                            |
   |                         |-- 1. mapper(wizard)        |
   |                         |-- 2. validator(payload)    |
   |                         |-- 3. POST getCotizacion -->|
   |                         |<-- mprima, mprimaext, ptasa|
   |                         |-- 4. POST createEmission ->|
   |                         |<-- cnpoliza, urlpoliza ----|
   |<-- 201 policy info -----|                            |
```

## Endpoints internos expuestos

```js
const policyService = require('./policyService');

await policyService.quote(wizardState, { plan: 'RCVBAS' });
// -> { mprima, mprimaext, ptasa, metadata }

await policyService.quoteAndEmit(wizardState, { plan: 'RCVBAS', frecuencia: 'A' });
// -> { cnpoliza, cnrecibo, urlpoliza, ncuota, internalPolicyId, quote, metadata }
```

## Variables de entorno

```env
LAMUNDIAL_BASE_URL=https://qaapisys2000.lamundialdeseguros.com
LAMUNDIAL_APIKEY=<provisto por La Mundial>
LAMUNDIAL_PRODUCTOR=80080
LAMUNDIAL_CUSUARIO=4
LAMUNDIAL_PLAN_DEFAULT=RCVBAS
LAMUNDIAL_FRECUENCIA_DEFAULT=A
LAMUNDIAL_TIMEOUT_MS=30000
POLICY_MODE=live   # 'mock' para devolver numero ficticio sin llamar a la API
```

## Manejo de errores

Toda excepcion se convierte en `PolicyError` con shape consistente:

```js
{
  name: 'PolicyError',
  code: 'LAMUNDIAL_TIMEOUT' | 'LAMUNDIAL_AUTH' | 'INVALID_PAYLOAD' | ...
  httpStatus: 502 | 422 | ...,
  message: '<mensaje accionable>',
  details: { ... }   // opcional, datos del error de La Mundial
}
```

El handler de rutas (`routes/upload.js -> sendPolicyError`) los mapea a HTTP responses.

## Modo mock

Para pruebas UI sin acceso a la API:

```env
POLICY_MODE=mock
```

Devuelve un `LM-2026-XXXXXX` ficticio.
