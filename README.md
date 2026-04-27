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
![PM2](https://img.shields.io/badge/PM2-cluster-2B037A?style=for-the-badge&logo=pm2&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-optional-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![PowerShell](https://img.shields.io/badge/PowerShell-5.1%20%7C%207%2B-5391FE?style=for-the-badge&logo=powershell&logoColor=white)
![License](https://img.shields.io/badge/License-Propietario-red?style=for-the-badge)

</div>

---

## Tabla de contenidos

- [Resumen](#resumen)
- [Stack tecnologico](#stack-tecnologico)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Requisitos](#requisitos)
- [Instalacion paso a paso](#instalacion-paso-a-paso)
- [Variables de entorno](#variables-de-entorno)
- [Scripts de despliegue](#scripts-de-despliegue)
- [Endpoints de la API](#endpoints-de-la-api)
- [Flujo funcional (5 pasos)](#flujo-funcional-5-pasos)
- [Troubleshooting](#troubleshooting)
- [Aviso legal](#aviso-legal)

---

## Resumen

Producto digital de **La Mundial de Seguros** para suscribir polizas RCV. El cliente sube su cedula, certificado del vehiculo (RUST) y licencia; el motor de OCR pre-rellena el formulario; el usuario elige plan y metodo de pago; y el sistema emite la poliza con numero unico.

Esta documentacion describe el stack, la estructura, las variables de entorno y los scripts de PowerShell para automatizar el ciclo `setup -> dev -> deploy -> stop`.

## Stack tecnologico

### Frontend

- **React 19** + **TypeScript** estricto
- **Vite 8** como bundler/dev server (HMR, build optimizado)
- **Tailwind CSS 4** con tema brand-aware (paleta La Mundial)
- **Zustand 5** para estado global (wizard + toasts)
- **Axios** con progreso real de upload
- **Zod** para validacion del lado cliente
- **Lucide React** + **canvas-confetti** para UI/UX

### Backend

- **Node.js 18+** (CommonJS)
- **Express 4** para la API REST
- **Multer** para uploads multipart/form-data (limite 10 MB)
- **CORS** configurable por env
- **dotenv** para configuracion por entorno
- OCR pluggable: `mock` (default), `openai`, `gemini`, `google-document-ai`

### Operaciones

- **PM2** en modo `cluster` para alta disponibilidad
- **Docker / Docker Compose** opcional (DB y cache para futuros features)
- **Cloudflare Tunnel** opcional para exponer el dev/prod a Internet
- **PowerShell 5.1+** (compatible con Windows 10/11 nativo y PS 7+)

## Estructura del proyecto

```
Suscripcion-rcv/
|
|-- frontend/                  React + Vite + Tailwind
|   |-- src/
|   |   |-- features/          Feature-based: ocr, vehicle, plans, payment...
|   |   |-- components/        UI atomica + componentes globales
|   |   |-- store/             Zustand: wizardStore, toastStore
|   |   |-- lib/               api.ts (Axios), planCatalog, utils
|   |   `-- types/             Tipos compartidos
|   |-- public/                Logos, manifest, favicons
|   |-- vite.config.ts         Proxy /api y /files -> :3001
|   `-- package.json
|
|-- server/                    Express mini-server
|   |-- src/
|   |   |-- routes/            /api/documents/upload, /api/policies/emit
|   |   |-- services/          documentService (validacion + OCR)
|   |   `-- index.js           Bootstrap (lee PORT y CORS desde .env)
|   |-- uploads/               Documentos subidos (gitignored)
|   `-- package.json
|
|-- ejemplos/                  Generadores de assets y docs de prueba
|
|-- .env                       Variables de entorno (gitignored)
|-- .env.example               Plantilla documentada
|-- ecosystem.config.js        Configuracion PM2 (cluster + frontend prod)
|
|-- setup.ps1                  Verifica deps, instala, genera .env y secrets
|-- start-dev.ps1              Lanza backend + frontend en ventanas separadas
|-- stop.ps1                   Detiene todo limpiamente
|-- deploy.ps1                 Build + PM2/Docker + health check
|
|-- LICENSE                    Aviso de propiedad intelectual
`-- README.md
```

## Requisitos

| Herramienta | Version | Obligatorio |
|---|---|---|
| Node.js | 18 LTS o superior | Si |
| npm | 9 o superior | Si |
| Git | cualquier reciente | Si |
| PowerShell | 5.1 (preinstalado en Windows 10/11) o 7+ | Si |
| PM2 | ultima | Solo para `deploy.ps1 -Mode pm2` |
| Docker Desktop | ultima | Solo para `deploy.ps1 -Mode docker` |

Instalacion de PM2 (global):

```powershell
npm install -g pm2
```

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

1. Verifica Node, npm, Git, Docker (opcional) y PM2 (opcional).
2. Crea las carpetas `server/uploads/` y `logs/`.
3. Copia `.env.example` -> `.env` si no existe.
4. Genera **SESSION_SECRET** y **JWT_SECRET** seguros (Base64 URL-safe, 48 bytes).
5. Instala dependencias en `server/` y `frontend/`.
6. Levanta `docker compose` si encuentra `docker-compose.yml`.
7. Imprime un resumen con lo configurado y lo que queda pendiente.

Flags utiles:

```powershell
.\setup.ps1 -Force         # borra node_modules y reinstala
.\setup.ps1 -SkipInstall   # solo configura, no instala
```

### 4) Modo desarrollo

```powershell
.\start-dev.ps1
```

Abre dos ventanas de PowerShell separadas:

- **RCV Backend (Express)** en `http://localhost:3001`
- **RCV Frontend (Vite)** en `http://localhost:5173`

Flags:

```powershell
.\start-dev.ps1 -NoFrontend    # solo backend
.\start-dev.ps1 -NoBackend     # solo frontend
.\start-dev.ps1 -Quiet         # corre en background con logs en logs\
```

### 5) Detener todo

```powershell
.\stop.ps1               # cierre limpio
.\stop.ps1 -Force        # mata procesos sin esperar
.\stop.ps1 -OnlyDev      # solo dev (puertos 3001 / 5173)
.\stop.ps1 -OnlyProd     # solo PM2 / docker compose
```

### 6) Despliegue de produccion

```powershell
.\deploy.ps1                 # default: PM2 cluster
.\deploy.ps1 -Mode docker    # docker compose
.\deploy.ps1 -Mode static    # solo node + build estatico
.\deploy.ps1 -SkipBuild      # reusar dist/ existente
```

El script:

1. Valida `.env` (NODE_ENV, PORT, SESSION_SECRET, JWT_SECRET, CORS_ORIGINS).
2. Instala dependencias con `npm ci` (respeta lockfile).
3. Construye el frontend (`tsc -b && vite build`).
4. Lanza con PM2 (cluster) usando `ecosystem.config.js`, o con Docker.
5. Hace **health check** contra `/api/health` (15 reintentos).
6. Imprime URLs y estado.

## Variables de entorno

Todas viven en el archivo **`.env`** de la raiz. La plantilla documentada esta en **`.env.example`**.

| Categoria | Variable | Default | Descripcion |
|---|---|---|---|
| General | `NODE_ENV` | `development` | `development` / `staging` / `production` |
| General | `APP_NAME` | `RCV-LaMundial` | Nombre del producto |
| API | `PORT` | `3001` | Puerto del backend |
| API | `CORS_ORIGINS` | `http://localhost:5173,...` | Lista separada por comas |
| API | `JSON_BODY_LIMIT` | `1mb` | Tamano max body JSON |
| API | `UPLOAD_MAX_SIZE_MB` | `10` | Tamano max por archivo |
| Secrets | `SESSION_SECRET` | (generado) | Auto-generado por setup.ps1 |
| Secrets | `JWT_SECRET` | (generado) | Auto-generado por setup.ps1 |
| Secrets | `JWT_EXPIRES_IN` | `12h` | TTL del JWT |
| OCR | `OCR_PROVIDER` | `mock` | `mock` / `openai` / `gemini` / `google-document-ai` |
| OCR | `OPENAI_API_KEY` | (vacio) | Solo si `OCR_PROVIDER=openai` |
| OCR | `OPENAI_MODEL` | `gpt-4o-mini` | Modelo de OpenAI |
| OCR | `GEMINI_API_KEY` | (vacio) | Solo si `OCR_PROVIDER=gemini` |
| OCR | `GEMINI_MODEL` | `gemini-2.0-flash` | Modelo de Gemini |
| DB | `DATABASE_URL` | (vacio) | Reservado para futuro |
| Cache | `REDIS_URL` | (vacio) | Reservado para futuro |
| Frontend | `VITE_API_URL` | (vacio) | URL publica del API en produccion |
| Frontend | `VITE_APP_NAME` | `La Mundial de Seguros` | Branding |
| Deploy | `PM2_INSTANCES` | `max` | Numero de procesos del cluster |
| Deploy | `PUBLIC_WEB_PORT` | `4173` | Puerto del frontend en produccion |

> Las variables `VITE_*` que el cliente debe ver van en **`frontend/.env`** (lo crea `setup.ps1`). Vite **no** lee variables del `.env` raiz por defecto.

## Scripts de despliegue

| Script | Proposito | Idempotente | Requiere |
|---|---|:---:|---|
| `setup.ps1` | Verificar prerequisitos, instalar deps, generar `.env` con secrets | Si | Node, npm, Git |
| `start-dev.ps1` | Modo desarrollo en ventanas separadas | Si | Setup completado |
| `stop.ps1` | Detener todo lo que escucha en puertos del proyecto | Si | - |
| `deploy.ps1` | Validar env, build, levantar con PM2 o Docker | Si | PM2 o Docker |

Todos los scripts:

- Usan prefijos `[OK]`, `[INFO]`, `[WARN]`, `[ERROR]` con colores.
- Manejan errores con `try/catch` y `$ErrorActionPreference = 'Stop'`.
- Funcionan en **PowerShell 5.1** (Windows 10/11 nativo) y **PowerShell 7+**.
- Usan **ASCII puro** (sin emojis ni caracteres no ASCII).

## Endpoints de la API

Base URL en desarrollo: `http://localhost:3001/api`

| Metodo | Ruta | Descripcion |
|---|---|---|
| GET | `/api/health` | Health check (status, env, timestamp) |
| POST | `/api/documents/upload` | Sube y procesa un documento (cedula/licencia/RUST/RIF) |
| POST | `/api/policies/emit` | Emite una poliza y retorna el numero |

### `POST /api/documents/upload`

Body: `multipart/form-data`

| Campo | Tipo | Descripcion |
|---|---|---|
| `file` | binary | JPG, PNG, SVG o PDF (max 10 MB) |
| `docType` | string | `cedula` / `licencia` / `certificado` / `rif` |

Respuesta 200:

```json
{
  "success": true,
  "message": "Documento procesado exitosamente.",
  "docType": "cedula",
  "file": {
    "id": "uuid",
    "name": "cedula.png",
    "size": 234567,
    "mimeType": "image/png",
    "url": "/files/abc.png"
  },
  "ocr": {
    "nombre": "Maria",
    "apellido": "Fernandez",
    "identificacion": "18456329",
    "tipoDoc": "V"
  }
}
```

### `POST /api/policies/emit`

Body JSON:

```json
{
  "tomador": { "nombre": "...", "apellido": "...", "identificacion": "..." },
  "plan":    { "name": "Black Signature", "price": "$120 / mes" },
  "payment": { "method": "transfer" }
}
```

Respuesta 201:

```json
{
  "success": true,
  "policy": {
    "number": "LM-2026-456789",
    "holder": "Maria Fernandez",
    "plan": "Black Signature",
    "price": "$120 / mes",
    "emittedAt": "2026-04-27T14:00:00.000Z"
  }
}
```

### `GET /api/health`

```json
{ "status": "ok", "env": "production", "time": "2026-04-27T14:00:00.000Z" }
```

## Flujo funcional (5 pasos)

1. **OCR** - Carga de cedula, licencia y certificado/RUST. Pre-llena los campos.
2. **Vehiculo** - Datos del vehiculo + conductor habitual.
3. **Datos del cliente** - Tomador, asegurado, beneficiario.
4. **Plan** - Categoria (personal, premium, comercial, flota), plan, suma asegurada, billing mensual/anual.
5. **Pago + Emision** - Metodo de pago, confirmacion, numero de poliza.

## Troubleshooting

### "El puerto 3001 ya esta en uso"

```powershell
.\stop.ps1                 # cierre limpio
.\stop.ps1 -Force          # si lo anterior no funciona
```

O cambia el puerto en `.env`: `PORT=3002` (recuerda actualizar tambien `CORS_ORIGINS` y el proxy de `frontend/vite.config.ts`).

### "Cannot find module 'dotenv'" o similar

```powershell
.\setup.ps1 -Force
```

### "npm ci falla en deploy.ps1"

Asegurate de que `package-lock.json` este commiteado y actualizado:

```powershell
Set-Location server   ; npm install ; Set-Location ..
Set-Location frontend ; npm install ; Set-Location ..
```

### "PM2 no encontrado"

```powershell
npm install -g pm2
pm2 ping
```

Si `pm2 ping` falla, abre una nueva sesion de PowerShell para que el PATH se recargue.

### "El script no se puede cargar porque la ejecucion de scripts esta deshabilitada"

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### "Vite no toma las variables del .env raiz"

Vite lee desde `frontend/.env`. Las variables que usa el cliente deben llevar prefijo `VITE_`. `setup.ps1` te crea ese archivo con los valores correctos.

### "Mi cedula/RUST no se lee bien"

Por defecto el OCR esta en modo `mock` (devuelve datos de ejemplo). Para activar OCR real:

1. Edita `.env`: `OCR_PROVIDER=openai` (o `gemini`).
2. Coloca tu API key: `OPENAI_API_KEY=sk-...`.
3. Reinicia: `.\stop.ps1 ; .\deploy.ps1`.

### Health check timeout en deploy.ps1

Revisa los logs:

```powershell
Get-Content .\logs\rcv-api.err.log -Tail 50
pm2 logs rcv-api --lines 100
```

Las causas tipicas son: puerto ocupado, falta `.env`, o `SESSION_SECRET` vacio.

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
