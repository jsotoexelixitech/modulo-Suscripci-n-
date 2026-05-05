# SyPago - Debito OTP (clave de un solo uso)

Pasarela de cobros venezolana que permite debitar la cuenta del cliente usando un OTP que su propio banco le envia. La Mundial actua como acreedor.

## Archivo

| Archivo | Responsabilidad |
|---|---|
| `sypagoClient.js` | requestOtp + confirmOtp + getTransactionStatus |

## Flujo

```
Frontend                Backend                  SyPago                  Banco cliente
   |                       |                         |                        |
   |-- POST /payments/     |                         |                        |
   |    otp/request ------>|                         |                        |
   |                       |-- POST /request/otp --->|                        |
   |                       |                         |-- envia OTP ---------->|
   |                       |                         |<-- ack -----------------|
   |                       |<-- success ------------|                        |
   |<-- 'OTP enviada' -----|                         |                        |
   |                       |                         |                        |
   | (cliente recibe OTP)  |                         |                        |
   |                       |                         |                        |
   |-- POST /payments/     |                         |                        |
   |    otp/confirm ------>|                         |                        |
   |                       |-- POST /transaction/    |                        |
   |                       |       otp ------------->|                        |
   |                       |                         |-- ejecuta debito ----->|
   |                       |<-- transaction_id ------|                        |
   |<-- transaction_id ----|                         |                        |
```

## API publica

```js
const sypago = require('./sypagoClient');

await sypago.requestOtp({
  documentType  : 'V',
  documentNumber: '24174934',
  debtorBankCode: '0105',
  debtorPhone   : '04141234567',
  amount        : 198.50,
});
// -> { message, success: true }

await sypago.confirmOtp({
  documentType, documentNumber, debtorBankCode, debtorPhone,
  debtorName: 'Maria Fernandez',
  amount    : 198.50,
  otp       : '123456',
  concept   : 'Poliza RCV',
});
// -> { transaction_id, operation_secret }

await sypago.getTransactionStatus(transaction_id);
// -> { status, ... }
```

## Variables de entorno

```env
SYPAGO_URL=https://pruebas.sypago.net:8086
SYPAGO_BEARER_TOKEN=<JWT muy largo entregado por SyPago>
SYPAGO_BANK_CODE=0108                     # banco acreedor (La Mundial)
SYPAGO_TYPE=CNTA
SYPAGO_NUMBER=01086071769795033206
SYPAGO_WEBHOOK_URL=                       # opcional
SYPAGO_TIMEOUT=20000
SYPAGO_MOCK=false                         # 'true' para simular OTP/debito
```

> El `SYPAGO_BEARER_TOKEN` es muy largo (300+ caracteres). Asegurate de pegarlo COMPLETO en una sola linea.

## Codigos de error

Todos los errores se mapean a `SypagoError` con codigos prefijo `SYPAGO_`:

| Codigo | Significado |
|---|---|
| `SYPAGO_MISSING_TOKEN` | Falta `SYPAGO_BEARER_TOKEN` |
| `SYPAGO_AUTH_ERROR` | El token fue rechazado por SyPago (revisar caducidad) |
| `SYPAGO_CONNECTION_ERROR` | No se pudo conectar al host |
| `SYPAGO_INVALID_OTP` | OTP incorrecto o vencido |
| `SYPAGO_INSUFFICIENT_FUNDS` | Cliente sin fondos |
| `SYPAGO_ERROR` | Error generico (revisar `sypagoCode` y `message`) |

## Modo mock

```env
SYPAGO_MOCK=true
```

Simula request/confirm sin tocar la API real. Util para tests E2E del frontend o cuando el JWT esta vencido.
