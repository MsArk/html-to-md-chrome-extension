# Chrome Extension — HTML → Markdown Analyzer

Extensión Chrome que analiza la pestaña activa usando el servicio `msarknet-convert-html-to-markdown`.

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

## Configuración del servidor

Por defecto la extensión apunta a `http://localhost:3000`.

Para cambiar la URL del servidor, edita `src/useAnalyze.ts`:

```ts
const SERVER_URL = 'http://localhost:3000'; // ← cámbialo aquí
```

Si despliegas el servidor en producción (Railway, Fly.io, etc.):

```ts
const SERVER_URL = 'https://tu-servidor.fly.dev';
```

> **CORS**: Asegúrate de que el servidor Express tenga `cors()` habilitado (ya lo tiene por defecto en este proyecto).

---

## Flujo de uso

1. Navega a cualquier página web
2. Haz clic en el icono de la extensión
3. Pulsa **Analizar esta página**
4. La extensión obtiene la URL activa → llama a `/analyze?url=...` → muestra:
   - Tokens HTML vs Markdown
   - % de reducción
   - Vista previa del Markdown
   - Botones: **Copiar** al portapapeles / **Descargar** `.md`

---

## Permisos usados (Manifest V3)

| Permiso | Motivo |
|---------|--------|
| `activeTab` | Leer la URL de la pestaña activa |
| `tabs` | Consultar tabs con `chrome.tabs.query` |

No se solicitan permisos de almacenamiento ni de red especiales; las llamadas HTTP al servidor se hacen como `fetch` normal.
