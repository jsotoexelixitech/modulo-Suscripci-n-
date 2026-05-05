<div align="center">

# Suscripcion RCV - La Mundial de Seguros

Aplicacion web profesional para emision digital de polizas de **Responsabilidad Civil de Vehiculos**, con carga inteligente de documentos, OCR pluggable y emision asistida en 5 pasos.

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-5-2D3748?style=for-the-badge&logo=react&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-4-3068B7?style=for-the-badge&logo=zod&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white)
![Sharp](https://img.shields.io/badge/Sharp-image%20pipeline-99CC00?style=for-the-badge&logo=sharp&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-2.5_Flash-8E75B2?style=for-the-badge&logo=google&logoColor=white)
![PM2](https://img.shields.io/badge/PM2-cluster-2B037A?style=for-the-badge&logo=pm2&logoColor=white)
![PowerShell](https://img.shields.io/badge/PowerShell-5.1%20%7C%207%2B-5391FE?style=for-the-badge&logo=powershell&logoColor=white)
![License](https://img.shields.io/badge/License-Propietario-red?style=for-the-badge)

</div>

---

## Tabla de contenidos

- [Resumen](#resumen)
- [Stack tecnologico](#stack-tecnologico)
- [Arquitectura](#arquitectura)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Requisitos](#requisitos)
- [Comando unico de desarrollo](#comando-unico-de-desarrollo)
- [Instalacion paso a paso](#instalacion-paso-a-paso)
- [Variables de entorno](#variables-de-entorno)
- [Scripts de despliegue](#scripts-de-despliegue)
- [Endpoints de la API](#endpoints-de-la-api)
- [Integraciones externas](#integraciones-externas)
- [Flujo funcional (5 pasos)](#flujo-funcional-5-pasos)
- [Troubleshooting](#troubleshooting)
- [Aviso legal](#aviso-legal)

---

## Resumen

Producto digital de **La Mundial de Seguros** para suscribir polizas RCV (Responsabilidad Civil de Vehiculos). El cliente sube su cedula y certificado del vehiculo (RUST); el motor de OCR pre-rellena el formulario; el usuario elige plan y metodo de pago; y el sistema emite la poliza con numero unico contra la API real de La Mundial.

El proyecto integra ademas tres pasarelas externas:

| Servicio | Proposito |
|---|---|
| **La Mundial de Seguros** | Cotizacion y emision real de polizas RCV (QA / produccion) |
| **Banco Activo (Meritop)** | Verificacion automatica de Pago Movil |
| **SyPago** | Debito directo bancario via OTP (clave de un solo uso) |
| **Google Gemini** | OCR de documentos (cedula, RUST, licencia) |

## Stack tecnologico

### Frontend

- **React 19** + **TypeScript** estricto
- **Vite 8** como bundler/dev server (HMR, build optimizado)
- **Tailwind CSS 4** con tema brand-aware (paleta La Mundial)
- **Zustand 5** para estado global (wizard + toasts)
- **Axios** con progreso real de upload
- **Zod** para validacion del lado cliente
- **react-select** para combobox de bancos con busqueda
- **Lucide React** + **canvas-confetti** para UI/UX
- **Sonner** para sistema de notificaciones (toast)

### Backend

- **Node.js 18+** (CommonJS)
- **Express 4** para la API REST
- **Multer** para uploads multipart/form-data (limite 25 MB)
- **Sharp** para normalizacion HEIC/HEIF -> JPEG, rotacion EXIF, compresion
- **Axios** como cliente HTTP para integraciones (La Mundial, Meritop, SyPago)
- **CORS** configurable por env
- **dotenv** para configuracion por entorno
- OCR pluggable: `mock` (default), `gemini` (Gemini 2.5 Flash-Lite recomendado), `openai`, `google-document-ai`

### Operaciones

- **PM2** en modo `cluster` para alta disponibilidad
- **Cloudflare Tunnel** opcional para exponer el dev/prod a Internet
- **PowerShell 5.1+** (compatible con Windows 10/11 nativo y PS 7+)

## Arquitectura

```
        +------------------+        +------------------+
        |   Frontend Vite  |  HMR   |  Backend Express |
        |  (puerto 5180)   |<------>|  (puerto 3001)   |
        +--------+---------+        +---+----------+---+
                 |                      |          |
                 | Cloudflare           |          |
                 | Tunnel (opcional)    |          |
                 v                      v          v
        +------------------+   +-------------+   +-------------+
        |     Internet     |   |  La Mundial |   |   Meritop   |
        +------------------+   |  (QA/PROD)  |   | (Banco Act.)|
                               +-------------+   +-------------+
                                      |                |
                                      v                v
                               +-------------+   +-------------+
                               |   SyPago    |   |   Gemini    |
                               | (Debito OTP)|   |    (OCR)    |
                               +-------------+   +-------------+
```

**Patron**: Monolito modular con servicios desacoplados (`services/lamundial/`, `services/meritop/`, `services/sypago/`, `services/ocrProviders/`). Cada integracion vive en su carpeta y expone una sola API publica al resto del sistema. Esto permite **desactivar un proveedor con una variable de entorno** sin afectar el flujo principal.

**Punto unico de servicio en produccion**: Express sirve tanto el API (`/api/*`) como el build estatico de Vite (`frontend/dist`) — no se necesita Nginx adicional.

## Estructura del proyecto

```
Suscripcion-rcv/
|
|-- frontend/                    React + Vite + Tailwind
|   |-- public/                  Logos, manifest, favicons, SVG demos
|   |-- src/
|   |   |-- features/            Pasos del wizard
|   |   |   |-- ocr/             Carga de documentos
|   |   |   |-- emission/        Datos del cliente
|   |   |   |-- vehicle/         Datos del vehiculo
|   |   |   |-- plans/           Cotizacion + seleccion de plan
|   |   |   `-- payment/         Pago + emision + exito
|   |   |-- components/
|   |   |   |-- SidebarNav.tsx     Sidebar con steps + resumen
|   |   |   |-- TopProgressBar.tsx Barra de progreso superior
|   |   |   |-- WelcomeSplash.tsx  Animacion de bienvenida
|   |   |   |-- DocumentPreviewModal.tsx Modal para ver documentos
|   |   |   |-- Toaster.tsx        Notificaciones globales
|   |   |   `-- ui/                Primitivas: Button, Badge, FormField,
|   |   |                          IdentityInput, BankSearchSelect, etc.
|   |   |-- store/               Zustand: wizardStore, toastStore
|   |   |-- lib/                 api.ts, money.ts, planCatalog.ts, utils.ts
|   |   `-- types/               Tipos compartidos TypeScript
|   |-- vite.config.ts           Proxy /api y /files -> :3001 (HMR Cloudflare)
|   `-- package.json
|
|-- server/                      API Express
|   |-- scripts/                 Scripts de prueba de integraciones externas
|   |   |-- test-lamundial-integration.js
|   |   |-- test-mismatch-e2e.js
|   |   |-- test-policy-unit.js
|   |   `-- test-validator-unit.js
|   |-- src/
|   |   |-- routes/
|   |   |   `-- upload.js        TODOS los endpoints /api/*
|   |   |-- services/
|   |   |   |-- lamundial/       Cliente API La Mundial (cotizar, emitir, catalogos)
|   |   |   |   |-- lamundialClient.js   HTTP client con retry y cache
|   |   |   |   |-- policyService.js     Orquestacion quote + emit
|   |   |   |   |-- policyMapper.js      Mapping wizard -> payload La Mundial
|   |   |   |   |-- policyValidator.js   Validacion de payload pre-envio
|   |   |   |   `-- catalogs.js          INMA: marcas, modelos, versiones
|   |   |   |-- meritop/         Banco Activo - verificacion Pago Movil
|   |   |   |   `-- meritopClient.js     Login JWT + verifymobilepayment
|   |   |   |-- sypago/          SyPago - debito OTP
|   |   |   |   `-- sypagoClient.js      requestOtp + confirmOtp + status
|   |   |   |-- ocrProviders/    Proveedores OCR
|   |   |   |   `-- geminiProvider.js    Google Gemini 2.5 Flash-Lite
|   |   |   `-- documentService.js       Validacion + dispatch al provider
|   |   `-- index.js             Bootstrap Express (PORT, CORS, rutas, static)
|   |-- uploads/                 Documentos subidos temporalmente (gitignored)
|   `-- package.json
|
|-- ejemplos/documentos-prueba/  Documentos PNG para pruebas de OCR
|-- logs/                        Logs PM2 (gitignored)
|
|-- package.json                 Scripts unificados: dev | build | start | deploy
|-- .env                         Secretos (gitignored — NO commitear)
|-- .env.example                 Plantilla documentada con todos los valores
|-- ecosystem.config.js          Configuracion PM2 para produccion (cluster)
|
|-- setup.ps1                    Primera instalacion: deps, .env, secrets
|-- start-dev.ps1                Dev con ventanas separadas por servicio
|-- stop.ps1                     Detiene todos los procesos
|-- deploy.ps1                   Build + PM2 + health check
|
|-- LICENSE                      Aviso de propiedad intelectual
`-- README.md                    Este archivo
```

## Requisitos

| Herramienta | Version | Obligatorio |
|---|---|---|
| Node.js | 18 LTS o superior | Si |
| npm | 9 o superior | Si |
| Git | cualquier reciente | Si |
| PowerShell | 5.1 (preinstalado en Windows 10/11) o 7+ | Solo Windows |
| PM2 | ultima | Solo para `deploy.ps1 -Mode pm2` |
| Cloudflared | ultima | Solo si usas tunneles |

Instalacion de PM2 (global):

```powershell
npm install -g pm2
```

## Comando unico de desarrollo

Desde la raiz del proyecto (requiere haber ejecutado `setup.ps1` o `npm install:all` al menos una vez):

```bash
npm run dev
```

Este comando arranca en paralelo:
- `API` — Express en `http://localhost:3001` (con nodemon, hot-reload)
- `WEB` — Vite en `http://localhost:5180` (con HMR)

Los logs de cada servicio se muestran con colores distintos en la misma terminal.

### Otros comandos del root `package.json`

| Comando | Proposito |
|---|---|
| `npm run dev` | Backend + Frontend en paralelo (modo desarrollo) |
| `npm run build` | Compila el frontend para produccion |
| `npm run start` | Arranca el backend en modo produccion (sirve frontend estatico) |
| `npm run deploy` | `build` + `start` en una sola operacion |
| `npm run install:all` | Instala dependencias de `server/` y `frontend/` |
| `npm run lint` | Lint del frontend |

---

## Instalacion paso a paso

### 1) Clonar el repo

```powershell
git clone <repo-url> Suscripcion-rcv
Set-Location Suscripcion-rcv
```

### 2) Politica de ejecucion de scripts (solo la primera vez)

PowerShell por defecto bloquea scripts no firmados. Habilitalos para tu usuario:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### 3) Setup automatico

```powershell
.\setup.ps1
```

Este script:

1. Verifica Node, npm, Git, PM2 (opcional).
2. Crea las carpetas `server/uploads/` y `logs/`.
3. Copia `.env.example` -> `.env` si no existe.
4. Genera **SESSION_SECRET** y **JWT_SECRET** seguros (Base64 URL-safe, 48 bytes).
5. Instala dependencias en `server/` y `frontend/`.
6. Imprime un resumen con lo configurado y lo que queda pendiente (API keys de proveedores externos).

Flags utiles:

```powershell
.\setup.ps1 -Force         # borra node_modules y reinstala
.\setup.ps1 -SkipInstall   # solo configura, no instala
```

### 4) Modo desarrollo

**Recomendado**: comando unico desde la raiz:

```bash
npm run dev
```

**Alternativa Windows** (ventanas separadas):

```powershell
.\start-dev.ps1
```

### 5) Detener todo

```powershell
.\stop.ps1               # cierre limpio
.\stop.ps1 -Force        # mata procesos sin esperar
```

### 6) Despliegue de produccion

**Opcion A — comando unico (mas simple)**:

```bash
npm run deploy
```

Compila el frontend y arranca el backend que sirve tanto el API como los archivos estaticos en el puerto 3001.

**Opcion B — PM2 cluster (recomendado en servidor)**:

```powershell
.\deploy.ps1                 # default: PM2 cluster
.\deploy.ps1 -Mode static    # solo node + build estatico
.\deploy.ps1 -SkipBuild      # reusar dist/ existente
```

El script:

1. Valida `.env`.
2. Instala dependencias con `npm ci` (respeta lockfile).
3. Construye el frontend (`tsc -b && vite build`).
4. Lanza con PM2 (cluster) usando `ecosystem.config.js`.
5. Hace **health check** contra `/api/health` (15 reintentos).
6. Imprime URLs y estado.

## Variables de entorno

Todas viven en el archivo **`.env`** de la raiz. La plantilla documentada esta en **`.env.example`**.

### General y backend

| Categoria | Variable | Default | Descripcion |
|---|---|---|---|
| General | `NODE_ENV` | `development` | `development` / `staging` / `production` |
| API | `PORT` | `3001` | Puerto del backend |
| API | `CORS_ORIGINS` | `http://localhost:5173,...` | Lista separada por comas |
| Secrets | `SESSION_SECRET` | (generado) | Auto-generado por setup.ps1 |
| Secrets | `JWT_SECRET` | (generado) | Auto-generado por setup.ps1 |

### OCR

| Variable | Default | Descripcion |
|---|---|---|
| `OCR_PROVIDER` | `mock` | `mock` / `gemini` / `openai` / `google-document-ai` |
| `GEMINI_API_KEY` | (vacio) | Solo si `OCR_PROVIDER=gemini` |
| `GEMINI_MODEL` | `gemini-2.5-flash-lite` | Modelo recomendado |

### La Mundial de Seguros (cotizacion + emision)

| Variable | Default | Descripcion |
|---|---|---|
| `LAMUNDIAL_BASE_URL` | (QA) | Host base de la API |
| `LAMUNDIAL_APIKEY` | (vacio) | Header `apikey` literal |
| `LAMUNDIAL_PRODUCTOR` | `80080` | ID de productor |
| `LAMUNDIAL_CUSUARIO` | `4` | ID de usuario |
| `LAMUNDIAL_PLAN_DEFAULT` | `RCVBAS` | Plan por defecto |
| `POLICY_MODE` | `live` | `live` / `mock` |

### Meritop (Banco Activo - Pago Movil)

| Variable | Default | Descripcion |
|---|---|---|
| `MERITOP_URL2` | `http://172.30.149.18:9040` | URL del proxy |
| `MERITOP_APIKEY` | (vacio) | GUID de autenticacion |
| `MERITOP_USERNAME` | (vacio) | Usuario integrador |
| `MERITOP_PASSWORD` | (vacio) | Contrasena integrador |
| `MERITOP_BANK` | (vacio) | UUID del banco |
| `MERITOP_CHANNEL` | (vacio) | UUID del canal |
| `MERITOP_TERMINAL` | (vacio) | UUID del terminal |
| `MERITOP_ENABLED` | `true` | Activar/desactivar el modulo |
| `MERITOP_MOCK` | `false` | Simular respuestas (sin VPN) |

### SyPago (Debito OTP)

| Variable | Default | Descripcion |
|---|---|---|
| `SYPAGO_URL` | (QA) | Host base |
| `SYPAGO_BEARER_TOKEN` | (vacio) | JWT fijo del integrador |
| `SYPAGO_BANK_CODE` | `0108` | Banco acreedor |
| `SYPAGO_TYPE` | `CNTA` | Tipo de cuenta |
| `SYPAGO_NUMBER` | (config) | Numero de cuenta La Mundial |
| `SYPAGO_WEBHOOK_URL` | (vacio) | URL del webhook |
| `SYPAGO_MOCK` | `false` | Simular OTP/debito |

> Las variables `VITE_*` que el cliente debe ver van en **`frontend/.env`** (lo crea `setup.ps1`). Vite **no** lee variables del `.env` raiz por defecto.

## Endpoints de la API

Base URL en desarrollo: `http://localhost:3001/api`

### Salud y documentos

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/health` | Health check (status, env, timestamp) |
| POST | `/api/documents/upload` | Sube y procesa un documento (multipart/form-data) |

### Catalogo de vehiculos (INMA - via La Mundial)

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/catalogo/anios` | `{ min, max }` rango de anios disponibles |
| GET | `/api/catalogo/marcas?fano=2024` | Lista de marcas |
| GET | `/api/catalogo/modelos?fano=2024&cmarca=074` | Modelos de una marca |
| GET | `/api/catalogo/versiones?fano=2024&cmarca=074&cmodelo=005` | Versiones |
| GET | `/api/catalogo/resolver?fano=2024&marca=Toyota&modelo=Corolla` | Resuelve texto libre |

### Polizas (La Mundial)

| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/api/policies/quote` | Cotiza la prima sin emitir |
| POST | `/api/policies/emit` | Cotiza y emite la poliza |

### Pagos: Banco Activo (Meritop)

| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/api/payments/verify-mobile` | Verifica un Pago Movil enviado por el cliente |

### Pagos: Debito OTP (SyPago)

| Metodo | Ruta | Descripcion |
|---|---|---|
| POST | `/api/payments/otp/request` | Pide al banco que envie OTP al cliente |
| POST | `/api/payments/otp/confirm` | Confirma OTP y ejecuta el debito |
| GET | `/api/payments/otp/status/:transactionId` | Consulta estado de transaccion |

## Integraciones externas

### La Mundial de Seguros

Cliente HTTP en `server/src/services/lamundial/lamundialClient.js`. Llama a:

- `POST /CorreccionCalculo/api/v1/external/getCotizacionAuto` -> devuelve `mprima`, `mprimaext`, `ptasa`
- `POST /CorreccionCalculo/api/v1/external/createEmissionAuto` -> devuelve `cnpoliza`, `urlpoliza`

El orquestador (`policyService.js`) realiza el flujo completo `quote -> emit` con un solo llamado desde el frontend. La validacion del payload (`policyValidator.js`) corre antes del envio para fallar rapido.

### Banco Activo (Meritop)

Verificacion de Pago Movil. Flujo en `server/src/services/meritop/meritopClient.js`:

1. `POST /login` con `X-API-KEY` -> JWT (cacheado en memoria)
2. `POST /payment/verifymobilepayment` con `Authorization: bearer <jwt>`

El JWT se refresca automaticamente al recibir 401 una vez. Codigos de resultado mapeados:

| Codigo | Significado |
|---|---|
| B010 | Transaccion encontrada y disponible |
| B000 | Transaccion encontrada (ya usada) |
| B001 | Transaccion no encontrada |
| B002 | Transaccion duplicada |

> **Nota**: La API real solo es accesible desde la red interna del banco. Usa `MERITOP_MOCK=true` para desarrollo local.

### SyPago (Debito OTP)

Pasarela de cobros que debita la cuenta del cliente con clave de un solo uso. Flujo en `server/src/services/sypago/sypagoClient.js`:

1. `POST /api/v1/request/otp` -> el banco del cliente envia OTP al telefono/email
2. Cliente ingresa OTP en la UI
3. `POST /api/v1/transaction/otp` -> ejecuta el debito
4. (Opcional) `GET /api/v1/transaction/{id}` -> consulta estado

Soporta modo mock con `SYPAGO_MOCK=true`.

### Google Gemini (OCR)

Proveedor en `server/src/services/ocrProviders/geminiProvider.js`. Usa `gemini-2.5-flash-lite` por defecto. Procesa cedula, RUST y licencia con prompts especializados. Detecta automaticamente cuando el usuario sube un documento que NO corresponde al slot (mismatch) y devuelve un 422 accionable al frontend.

## Flujo funcional (5 pasos)

1. **OCR** - Carga de cedula y certificado/RUST. Pre-llena los campos automaticamente.
2. **Datos del cliente** - Tomador (asegurado por defecto), beneficiario opcional.
3. **Vehiculo** - Marca/modelo/version desde catalogo INMA, conductor habitual opcional.
4. **Plan** - Categoria y plan; cotizacion en tiempo real contra La Mundial.
5. **Pago + Emision** - Pago Movil (Banco Activo) o Debito OTP (SyPago); emision automatica.

## Troubleshooting

### "El puerto 3001 ya esta en uso"

```powershell
.\stop.ps1                 # cierre limpio
.\stop.ps1 -Force          # si lo anterior no funciona
```

O cambia el puerto en `.env`: `PORT=3002` (recuerda actualizar tambien `CORS_ORIGINS` y el proxy de `frontend/vite.config.ts`).

### "Cannot find module 'sharp'" en produccion

`sharp` ahora vive en `dependencies` del backend. Si actualizas desde una version vieja:

```powershell
Set-Location server ; npm install sharp ; Set-Location ..
```

### "Verificacion de Pago Movil siempre da 503"

Meritop (Banco Activo) solo funciona desde la red interna del banco. Para desarrollo local activa el modo simulado:

```env
MERITOP_MOCK=true
```

### "SyPago dice token vacio"

El JWT de SyPago suele ser muy largo. Asegurate de pegar el valor completo en `.env` (sin saltos de linea ni espacios). Verifica:

```powershell
Get-Content .env | Select-String "SYPAGO_BEARER_TOKEN"
```

### "Mi cedula/RUST no se lee bien"

Por defecto el OCR esta en modo `mock` (devuelve datos de ejemplo). Para activar OCR real:

1. Edita `.env`: `OCR_PROVIDER=gemini`.
2. Coloca tu API key: `GEMINI_API_KEY=...`.
3. Reinicia: `npm run dev`.

### "El selector de banco no filtra"

Hard-refresh del navegador (`Ctrl+Shift+R` / `Cmd+Shift+R`). Si persiste, limpia el cache de Vite:

```powershell
Remove-Item -Recurse -Force .\frontend\node_modules\.vite
npm run dev
```

### Limpiar todo y empezar de cero

```powershell
.\stop.ps1 -Force
Remove-Item -Recurse -Force .\server\node_modules, .\frontend\node_modules, .\frontend\dist, .\logs
Remove-Item .\.env
.\setup.ps1
```

## Aviso legal

(C) 2026 **La Mundial de Seguros, C.A.** - Todos los derechos reservados.

Este software es **propietario** y se distribuye bajo los terminos del archivo `LICENSE`. No esta autorizada su redistribucion, modificacion, publicacion o uso fuera de los proyectos de La Mundial de Seguros sin **autorizacion previa, expresa y por escrito** del titular.

El acceso a este repositorio se entiende concedido unicamente con fines de **desarrollo, mantenimiento o auditoria autorizados**, y se rige por los acuerdos de confidencialidad firmados con el personal o terceros involucrados.

Para licenciamientos, autorizaciones o reportes de seguridad, contactar al area de Tecnologia de La Mundial de Seguros, C.A.
