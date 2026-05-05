# Meritop - Verificacion de Pago Movil (Banco Activo)

Cliente para verificar que un cliente realmente envio el Pago Movil que dice haber pagado, consultando los registros del banco a traves de Meritop (proxy oficial de Banco Activo).

## Archivo

| Archivo | Responsabilidad |
|---|---|
| `meritopClient.js` | Login + verifyMobilePayment + cache JWT |

## Flujo

```
Frontend                  Backend                     Meritop
   |                         |                            |
   |-- POST /payments/       |                            |
   |    verify-mobile -----> |                            |
   |                         |-- 1. POST /login --------->|
   |                         |<-- jwt (cacheado) ---------|
   |                         |-- 2. POST /payment/        |
   |                         |    verifymobilepayment --->|
   |                         |<-- isverified, ref, monto -|
   |<-- isVerified, reference|                            |
```

## API publica

```js
const { verifyMobilePayment } = require('./meritopClient');

const result = await verifyMobilePayment({
  sourcePhoneNumber: '04121234567',
  bankCode         : '0172',
  amount           : 198114.50,
  paidOn           : '2026-04-29T13:30:00',
});
// -> { isVerified, reference, verifiedAmount, verifiedOn, message, code }
```

## Variables de entorno

```env
MERITOP_URL2=http://172.30.149.18:9040
MERITOP_APIKEY=<GUID asignado>
MERITOP_USERNAME=<usuario integrador>
MERITOP_PASSWORD=<password integrador>
MERITOP_BANK=<UUID asignado>
MERITOP_CHANNEL=<UUID asignado>
MERITOP_TERMINAL=<UUID asignado>
MERITOP_ENABLED=true     # 'false' para devolver 503 sin llamar al banco
MERITOP_TIMEOUT=15000
MERITOP_MOCK=false       # 'true' para simular respuesta exitosa (dev sin VPN)
```

## Codigos de resultado

| Codigo | Significado |
|---|---|
| `B010` | Transaccion encontrada y disponible (success) |
| `B000` | Transaccion encontrada pero ya usada |
| `B001` | Transaccion no encontrada |
| `B002` | Transaccion duplicada (pago ya registrado) |
| `B003` | Error de parametros |
| `B004` | Error de conexion con Gateway |
| `B005` | Error Gateway-AS400 |

## Cache de token

El JWT se guarda en memoria con su `expiresAt`. Se considera valido hasta 60 s **antes** de su vencimiento para evitar ventanas de race-condition.

Al recibir 401 se refresca **una vez** y se reintenta. Si vuelve a fallar, se devuelve `MERITOP_AUTH_RETRY_FAILED`.

## Restricciones de red

La API real de Meritop solo es alcanzable desde:

- La red interna del banco (`172.30.x.x`)
- VPN autorizada por Banco Activo
- IP de origen registrada con Meritop (variable `MERITOP_IP`)

Para desarrollar localmente sin VPN usa:

```env
MERITOP_MOCK=true
```

Esto simula una respuesta exitosa con una referencia generada (`REF<timestamp>`).
