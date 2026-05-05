# Tareas: alinear la extensión con `convert-html-to-markdown`

La extensión Chrome consume el microservicio en `Tools/microservicios/convert-html-to-markdown/`. Ese servicio ha evolucionado (OpenAPI, rate limits, `clean`/`selector`/`webhook`, `POST /analyze`, `POST /batch`, métricas, variables de entorno, etc.). Este documento lista lo que conviene actualizar en **html-to-md-chrome-extension** para no quedar desincronizados.

**Referencia de API:** `Tools/microservicios/convert-html-to-markdown/src/openapi.json` y `README.md` del microservicio.

---

## Crítico (coherencia con la API actual)

- [x] **Tipos (`src/types.ts`)**
  - [x] Alinear `AnalyzeResponse` con el backend: `url`, `html`, `markdown`, `timingsMs`, `cached?` (opcional).
  - [x] Eliminar o redefinir `outputFiles` si no lo devuelve el servidor (hoy el popup no lo usa, pero el tipo engaña y rompe contratos futuros).
  - [x] Añadir tipos mínimos para errores JSON del backend (`{ error: { code, message, details? } }`) y, si se implementa flujo async, `AnalyzeQueuedResponse` / `WebhookBody` según `convert-html-to-markdown/src/types.ts`.

- [x] **Cliente HTTP (`src/useAnalyze.ts`)**
  - [x] **URL base por build:** usar `import.meta.env` con fallback `http://localhost:3000` y sin configuración editable en popup por usuario final.
  - [x] **Query string GET `/analyze`:** soportar al menos `url` (ya) y, si hay UX, `selector` y `clean` como en el servidor (boolean → `1`/`true` según documentación OpenAPI).
  - [x] **Errores HTTP:** parsear cuerpo `{ error: { code, message } }` en todos los `!response.ok`; mapear códigos conocidos a mensajes claros en español.
  - [x] **202 Accepted (webhook):** mostrar estado “encolado” (sin polling, por ahora).
  - [x] **Timeout:** se mantiene 30s y queda documentado en README.

- [x] **UI de error (`src/Popup.tsx`)**
  - [x] Mostrar `code` (si existe) además del mensaje para soporte y depuración.
  - [x] Mensajes específicos para rate limit (sugerir reintento en X segundos si el backend envía `retryAfter` en `details` o `Retry-After`).

---

## Importante (UX y despliegue)

- [x] **Rate limiting**
  - [x] Manejo explícito de 429 en UI y botón de analizar deshabilitado durante la solicitud para evitar doble clic agresivo.

- [x] **i18n del popup (EN/ES, default EN)**
  - [x] Todos los textos visibles del popup salen de diccionario (`en`/`es`).
  - [x] Selector de idioma en UI con persistencia de preferencia.
  - [x] Default en inglés y fallback local cuando `chrome.storage.sync` no esté disponible.

- [x] **Permisos y orígenes (`public/manifest.json`)**
  - [x] Se mantiene `storage` solo para persistir idioma del popup (EN/ES); `host_permissions` siguen acotados para localhost + despliegues típicos (`fly.dev`, `up.railway.app`).

- [x] **Documentación (`README.md` de la extensión)**
  - [x] Lista de endpoints usados (`GET /analyze`).
  - [x] Parámetros opcionales (`clean`, `selector`) y tabla de `error.code`.
  - [x] Cómo configurar URL del servidor y cómo ejecutar el microservicio (`docker compose`, puerto).

---

## Opcional / siguiente iteración

- [ ] **`POST /analyze`**  
  - No implementado (alcance alto: captura de HTML y rediseño de permisos/flujo).

- [ ] **`POST /batch`**
  - No implementado (fuera de alcance para popup actual).

- [x] **Indicador `cached`**
  - Badge `Cache` agregado en resultados cuando `cached === true`.

- [x] **`/openapi.json` o ayuda inline**
  - Se mantiene ayuda inline de la extensión; se retiró el link `Docs API` del popup por decisión de producto.

---

## Verificación rápida (checklist manual)

- [ ] Analizar página pública HTTP/HTTPS contra servidor local Docker y contra build `npm run dev`.
- [ ] Probar selector inválido y selector inexistente (esperar códigos y mensajes coherentes).
- [ ] Provocar 429 (varias ejecuciones) y confirmar mensaje usable.
- [ ] Validar `VITE_ANALYZE_API_BASE_URL` en build (sin opciones de URL en popup) y comprobar que `GET /analyze` sigue funcionando.
- [x] `npm run build` de la extensión sin errores de tipos tras actualizar `types.ts`.

---

## Decisión de producto vigente

- [x] El popup no expone configuración de servidor (sin input ni guardar URL).
- [x] El popup no muestra enlace `Docs API`.
- [x] La URL base del backend se resuelve por build/env y fallback de desarrollo.

---

## Archivos tocados de referencia en el microservicio

| Área              | Rutas útiles                                                          |
|-------------------|----------------------------------------------------------------------|
| Contrato Analyze  | `src/routes/analyze.ts`, `src/types.ts`, `src/openapi.json`         |
| Límites / env     | `README.md`, `.env.example`, `src/middleware/errorHandler.ts`        |
| Rate limit        | `src/middleware/rateLimit.ts`                                        |

Al cerrar estas tareas, borrar o marcar secciones en este `TASK.md` según el flujo de trabajo del equipo.
