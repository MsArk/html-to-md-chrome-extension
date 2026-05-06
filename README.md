# Chrome Extension — HTML → Markdown Analyzer

Extensión Chrome que analiza la pestaña activa usando el servicio `msarknet-convert-html-to-markdown`.

## Idiomas (i18n)

- Soporta interfaz en **inglés (EN)** y **español (ES)**.
- La traducción usa i18n nativo de Chrome: `chrome.i18n.getMessage(...)` + `public/_locales/{en,es}/messages.json`.
- El idioma lo determina Chrome según la configuración del navegador/SO.
- `public/manifest.json` declara `default_locale: "en"`, por lo que el fallback baseline es inglés.

## Estructura del proyecto

```
chrome-extension/
├── public/
│   ├── manifest.json        # Manifest V3
│   └── icons/               # PNG 16, 48, 128 (genera con el script)
├── src/
│   ├── main.tsx             # Entry point React
│   ├── Popup.tsx            # Componente principal
│   ├── useAnalyze.ts        # Hook que llama al servidor
│   ├── types.ts             # Tipos compartidos con el servidor
│   └── index.css            # Estilos del popup
├── scripts/
│   └── generate-icons.mjs   # Genera iconos placeholder
├── popup.html               # HTML de entrada
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Instalación y desarrollo

### 1. Instalar dependencias

```bash
npm install
```

### 2. Iconos del manifest (`scripts/generate-icons.mjs`)

Chrome exige PNG en **16**, **48** y **128** px (definidos en `public/manifest.json`). El script genera tres placeholders (fondo `#6c8bff`, letra **M**) en `public/icons/`:

| Salida | Descripción |
|--------|-------------|
| `public/icons/icon16.png` | Barra de herramientas |
| `public/icons/icon48.png` | Gestión de extensiones |
| `public/icons/icon128.png` | Chrome Web Store |

**Dependencia:** el script usa [`sharp`](https://www.npmjs.com/package/sharp): rasteriza un SVG a PNG y suele instalarse sin compilar (binarios prebuilt para Linux/macOS/Windows). Ya está en `devDependencies`; si clonas el repo basta con `pnpm install`.

*(Antes se usaba `canvas`/Cairo; eso fallaba a menudo sin librerías nativas o en Node muy nuevo.)*

**Ejecución** (siempre desde la raíz del proyecto):

```bash
node scripts/generate-icons.mjs
```

No recibe argumentos: crea `public/icons/` si no existe y sobrescribe los tres PNG. Después puedes reemplazar los archivos por tus diseños finales manteniendo los mismos nombres y tamaños.

### 3. Build de desarrollo (watch mode)

```bash
npm run dev
```

### 4. Build de producción

```bash
npm run build
```

El resultado queda en `dist/`.

---

## Cargar la extensión en Chrome

1. Abre `chrome://extensions`
2. Activa **Modo desarrollador** (toggle arriba a la derecha)
3. Haz clic en **Cargar descomprimida**
4. Selecciona la carpeta `dist/`

La extensión aparecerá en la barra de herramientas.

---

## Endpoint y parámetros soportados

La extensión usa `GET /analyze` del microservicio `convert-html-to-markdown`.

### Query params que envía el popup

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `url` | string (requerido) | URL HTTP/HTTPS de la pestaña activa o URL ingresada manualmente en el popup. |
| `selector` | string (opcional) | Selector CSS para extraer solo una parte del HTML. |
| `clean` | `minimal` o `standard` | El popup envía `standard` cuando activas “Aplicar limpieza”; en caso contrario `minimal`. |

### URL manual desde popup

- El campo **URL (opcional)** permite analizar una URL distinta de la pestana activa.
- Si dejas el campo vacio, la extensión mantiene el flujo actual: usa la URL de la pestana activa.
- Para hosts locales, se normaliza automaticamente cuando no hay esquema:
  - `localhost:4321` -> `http://localhost:4321`
  - `127.0.0.1:3000/path` -> `http://127.0.0.1:3000/path`
  - `[::1]:5173` -> `http://[::1]:5173`
- Importante: la normalizacion solo corrige el formato. Si el backend tiene proteccion SSRF estricta, puede rechazar hosts loopback (localhost/127.0.0.1/::1).
- Para dominios no locales, debes incluir `http://` o `https://`.

La respuesta de éxito esperada es:

```json
{
  "url": "https://ejemplo.com/",
  "html": { "tokens": 0, "characters": 0, "content": "..." },
  "markdown": { "tokens": 0, "characters": 0, "content": "..." },
  "timingsMs": { "fetch": 0, "convert": 0, "tokenize": 0, "total": 0 },
  "cached": true
}
```

`cached` es opcional (solo aparece en hits de caché).

---

## Configuración de URL del servidor

La URL base del backend ya **no se configura en el popup**. Se define en build:

1. Variable de entorno `VITE_ANALYZE_API_BASE_URL`
2. Fallback por defecto para desarrollo: `http://localhost:3000`

### Configurar por variable de entorno en build

```bash
VITE_ANALYZE_API_BASE_URL=https://tu-api.fly.dev npm run build
```

> Timeout del cliente en extensión: **30s** (`REQUEST_TIMEOUT_MS` en `src/useAnalyze.ts`).

---

## Manejo de errores (`error.code`)

La extensión intenta parsear siempre `{ error: { code, message, details? } }` y mostrar mensaje traducido (EN/ES con `chrome.i18n`) + código técnico.

| `error.code` | Significado en UI |
|--------------|-------------------|
| `INVALID_URL` | URL inválida o no soportada |
| `SSRF_PROTECTION` | Destino bloqueado por política SSRF del backend |
| `FETCH_FAILED` | Falló descarga remota |
| `FETCH_TIMEOUT` | Timeout al descargar página |
| `INVALID_CONTENT_TYPE` | El recurso no parece HTML |
| `BODY_TOO_LARGE` | Página demasiado grande |
| `INVALID_SELECTOR` | Selector CSS inválido |
| `SELECTOR_NOT_FOUND` | Selector válido pero sin coincidencias |
| `URL_RATE_LIMITED` | Límite por URL alcanzado (429) |
| `TOO_MANY_REQUESTS` | Límite por IP alcanzado (429) |
| `INVALID_JSON`, `MISSING_FIELD` | Error de contrato en request |
| `SERVER_ERROR`, `INTERNAL_SERVER_ERROR` | Error interno del backend |

Para `429`, si el backend devuelve `details.retryAfter` o header `Retry-After`, el popup muestra “Reintenta en Xs”.

---

## Respuesta `202 Accepted`

Si el backend responde `202` (flujo async/webhook), la extensión no hace polling: muestra estado **encolado** y evita romper la UI.

---

## Flujo de uso

1. Navega a cualquier página web
2. Haz clic en el icono de la extensión
3. (Opcional) Ingresa una URL en el campo URL para analizarla en lugar de la pestana activa
4. Pulsa **Analizar esta página**
5. La extensión toma la URL ingresada (o la activa si no hay entrada) → llama a `/analyze?url=...` → muestra:
    - Tokens HTML vs Markdown
    - % de reducción
    - Badge de caché cuando aplica (`cached`)
    - Vista previa del Markdown
    - Botones: **Copiar** al portapapeles / **Descargar** `.md`

---

## Permisos usados (Manifest V3)

| Permiso | Motivo |
|---------|--------|
| `activeTab` | Leer la URL de la pestaña activa |
| `tabs` | Consultar tabs con `chrome.tabs.query` |

`host_permissions` declarados en `public/manifest.json`:

- `http://localhost:3000/*`
- `http://127.0.0.1:3000/*`
- `https://*.fly.dev/*`
- `https://*.up.railway.app/*`

---

## Ejecutar el microservicio `convert-html-to-markdown`

Desde `Tools/microservicios/convert-html-to-markdown`:

```bash
pnpm install
pnpm build
pnpm start
```

Con Docker Compose:

```bash
docker compose up -d
```

Endpoint de ayuda del servicio:

- `GET /openapi.json` (contrato OpenAPI)
