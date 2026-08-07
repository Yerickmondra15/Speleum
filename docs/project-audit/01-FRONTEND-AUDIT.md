# Speleum - Frontend audit

Este documento cubre rutas, componentes, providers, estilos, assets, responsive por revision estatica, accesibilidad y codigo cliente. Ver tambien [00-MASTER-STATUS.md](./00-MASTER-STATUS.md).

## Estructura frontend

Speleum usa Next.js App Router. Las rutas reales confirmadas por `next build` son:

- `/` desde `app/page.tsx`
- `/login` desde `app/login/page.tsx`
- `/play` desde `app/play/page.tsx`
- `/profile` desde `app/profile/page.tsx`
- `/ranking` desde `app/ranking/page.tsx`
- `/world` desde `app/world/page.tsx`
- `/How-to-play` desde `app/How-to-play/page.tsx`

Layouts/providers:

- `app/layout.tsx`: metadata, script inline para tema, `ThemeProvider`, `LanguageProvider`, `AuthProvider`.
- `lib/theme/ThemeProvider.tsx`: tema claro/oscuro con `localStorage` y `data-theme`.
- `lib/i18n/LanguageProvider.tsx`: locale ES/EN con `localStorage` y `document.documentElement.lang`.
- `app/auth/AuthProvider.tsx`: estado de auth cliente, llamadas a endpoints, logout y actualizacion de criatura.

Componentes globales:

- `app/components/ThemeSwitcher.tsx`
- `app/components/LanguageSwitcher.tsx`
- `app/components/PreferenceToggleGroup.tsx`

Componentes de juego cliente:

- Entrada: `app/play/components/PlayScene.tsx`
- Menu: `PlayMenu`, `CharacterSelect`, `MatchmakingScreen`, `LoadingCaveScreen`
- Local: `TacticalGame`
- Multijugador: `MultiplayerMenu`, `MultiplayerGame`
- UI juego: `GameMap`, `GameHud`, `ActionControls`, `RadarPanel`, `GameOverlay`, `GameTopControls`, `PauseOverlay`

Estilos:

- Tailwind v4 por `@import "tailwindcss"` en `app/globals.css`.
- Variables CSS para tema en `:root` y `html[data-theme="light"]`.
- No existe `tailwind.config.*`; esto coincide con Tailwind v4.

Assets:

- Logos en `public/Grafico/`.
- Criaturas en `public/creatures/`.
- Favicon real: `app/favicon.ico`.
- Assets residuales de plantilla: `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`.
- Metadata referencia iconos inexistentes: `/icon-light-32x32.png`, `/icon-dark-32x32.png`, `/icon.svg`, `/apple-icon.png`.

## Revision por ruta

### `/`

**Archivo:** `app/page.tsx`  
**Tipo:** Client component.  
**Proposito:** Home, navegacion principal, hero, biologias/criaturas, CTA a play/login/ranking/world/how-to-play.  
**Componentes:** `Link`, `Image`, `AnimatePresence`, `motion`, `ThemeSwitcher`, `LanguageSwitcher`, `useAuth`, `useLanguage`, `useTheme`.  
**APIs:** `logout()` llama `DELETE /api/auth/session` via AuthProvider.  
**Estado real:** Funcional con errores menores.

Problemas:

- Redireccion/CTA depende de `status === "signed-in"` del provider cliente; mientras carga puede mostrar login/play de forma transitoria.
- Mobile menu existe con `aria-expanded` y se cierra por estado local, correcto.
- Usa `tracking-[0.42em]`, `tracking-[0.32em]` y textos grandes; probable riesgo de overflow en idiomas largos o pantallas muy angostas.
- La pagina mezcla muchos bloques visuales y cards; no hay pruebas visuales confirmadas.
- `LIGHTS_ON_KEY` guarda interaccion estetica en `localStorage`.

### `/login`

**Archivo:** `app/login/page.tsx`  
**Tipo:** Client component.  
**Proposito:** Registro, login, paso de verificacion, reenvio de codigo.  
**Componentes:** Framer Motion, SVG inline animado, formularios controlados, AuthProvider.  
**APIs:** `/api/auth/register`, `/api/auth/login`, `/api/auth/verify-email-code`, `/api/auth/verify-login-code`, `/api/auth/resend-code`.  
**Estado real:** Funcional con errores.

Problemas:

- Es un archivo muy grande (~39 KB) con UI, animaciones, validaciones, flujo y copy mezclados.
- No hay recuperacion de cuenta.
- La visibilidad de `demoCode` depende de respuesta backend; si `DEMO_AUTH_CODES_PUBLIC` esta activo, el codigo queda en UI.
- Validaciones cliente no sustituyen validaciones server, pero existen.
- Hay labels visuales y botones con `aria-label` para password, positivo.
- No se comprobo comportamiento con teclado virtual movil.

### `/play`

**Archivo:** `app/play/page.tsx`, `app/play/components/PlayScene.tsx`  
**Tipo:** Page server que renderiza client component.  
**Proposito:** Seleccion modo local/multijugador, criatura, partida.  
**APIs:** `/api/users/me/active-creature`, `/api/matches/results`, Socket.IO.  
**Estado real:** Parcialmente implementado.

Problemas:

- Proteccion de ruta solo cliente: `PlayScene` hace `router.replace("/login")` en `useEffect`.
- `PlayScene` usa pantallas temporizadas `searching` y `loading` antes de local; eso simula matchmaking para local.
- Local y multijugador usan implementaciones separadas (`TacticalGame` vs `MultiplayerGame`).
- HUD y radar tienen posicion absoluta con `bottom`/`right`, `h-dvh`, `overflow-hidden`; probable riesgo en telefonos y teclado/orientacion horizontal.
- `TacticalGame` contiene `console.log` de fuente/seed/templates de cueva.

### `/profile`

**Archivo:** `app/profile/page.tsx`, `app/profile/profile-panel.tsx`  
**Tipo:** Page server que renderiza client component.  
**Proposito:** Perfil, estadisticas, criatura activa, acciones play/logout.  
**APIs:** `/api/profile`, `/api/auth/session` via logout.  
**Estado real:** Funcional con errores.

Problemas:

- Proteccion cliente con `router.replace("/login")`; no hay middleware.
- Doble enlace a `/play` con labels distintos puede ser redundante.
- Si `/api/profile` falla por DB, muestra error generico o redirige en 401.

### `/ranking`

**Archivo:** `app/ranking/page.tsx`, `app/ranking.tsx`  
**Tipo:** Page server que renderiza client component.  
**Proposito:** Tabla ranking global desde Prisma.  
**APIs:** `/api/ranking`.  
**Estado real:** Funcional con errores.

Problemas:

- No maneja errores HTTP de forma diferenciada; `catch` deja lista vacia.
- Ranking puede ser manipulado por problema backend de resultados.
- Nombre `app/ranking.tsx` fuera de carpeta de ruta es valido como componente, pero puede confundir mantenimiento.

### `/world`

**Archivo:** `app/world/page.tsx`  
**Tipo:** Client component.  
**Proposito:** Lore/biologia/criaturas.  
**APIs:** Ninguna.  
**Estado real:** Funcional.

Problemas:

- No todos los textos parecen venir de `messages`; se mezcla contenido armado localmente con traducciones.
- Visualmente depende de cards, imagenes y gradientes; no se comprobo responsive real.

### `/How-to-play`

**Archivo:** `app/How-to-play/page.tsx`  
**Tipo:** Client component.  
**Proposito:** Reglas, controles, criaturas.  
**APIs:** Ninguna.  
**Estado real:** Funcional con errores menores.

Problemas:

- Ruta usa mayuscula exacta `How-to-play`; enlaces internos coinciden, pero puede ser fragil para usuarios que escriban `/how-to-play`.
- Textos de reglas estan dentro del archivo, no centralizados totalmente en `messages`.

## Responsive

No se realizo comprobacion visual en browser por falta de script/herramienta e2e instalada y porque no se instalaron dependencias. Revision estatica:

Riesgos confirmados por clases:

- `app/play/components/TacticalGame.tsx` y `MultiplayerGame.tsx`: `h-dvh min-h-dvh overflow-hidden overscroll-none`; en movil evita scroll y obliga a que HUD, radar y controles quepan siempre.
- `RadarPanel` contenedor en juego: `w-28` en movil y `bottom: calc(env(safe-area-inset-bottom) + 5.5rem)`; puede competir con `ActionControls`.
- `GameHud` y paneles laterales usan overlays absolutos; probable superposicion en telefonos pequenos.
- `MultiplayerMenu.tsx`: labels con `tracking-[0.22em]` y codigo con `tracking-[0.34em]`; probable overflow con textos largos/localizacion.
- `page.tsx` home: hero con `sm:text-8xl` y tracking alto; en desktop probablemente intencional, en pantallas intermedias puede dominar demasiado.
- `login/page.tsx`: formulario y SVG animado complejos; no se comprobo teclado virtual.

## Diseno y consistencia

Confirmado:

- Tema claro/oscuro esta centralizado en CSS variables y `ThemeProvider`.
- Idioma ES/EN existe en `lib/i18n/messages.ts` y se persiste.
- Botones principales usan clases globales `theme-button-*`.
- Uso consistente de `lucide-react`.
- Imagenes de criaturas tienen `alt`.

Problemas:

- Muchas paginas tienen copy hardcodeado en espanol, especialmente juego, lobby, `/How-to-play`, partes de `/world`. La internacionalizacion no cubre todo el sitio.
- El juego multijugador/local usa mensajes en espanol aunque `LanguageProvider` exista.
- Metadata esta en espanol sin alternativa por locale.
- Los iconos de metadata no existen en disco.

## Accesibilidad

Fortalezas:

- Botones de password en login tienen `aria-label`.
- Mobile menu tiene `aria-expanded`.
- Imagenes principales tienen `alt`.
- Inputs principales estan dentro de `label` o tienen contexto textual.

Riesgos:

- Muchos botones icon-only no tienen tooltip ni nombre visible fuera de contexto; algunos links icon-only en home tienen solo icono, sin `aria-label` confirmado.
- Contraste no se midio automaticamente.
- Focus visible depende del navegador/clases; no hay estilo global explicito para `:focus-visible`.
- Modales/overlays (`GameOverlay`, `PauseOverlay`) no se comprobaron como dialogos accesibles, focus trap o escape.
- Juego por teclado existe, pero controles tactiles y lector de pantalla no estan adaptados al tablero.

## Codigo frontend

Hallazgos:

- `app/login/page.tsx` y `TacticalGame.tsx` son componentes grandes con responsabilidades mezcladas.
- `lib/session.ts` mantiene una sesion legacy en `localStorage` (`speleum-user`) que no aparece integrada con AuthProvider moderno; probable codigo no usado.
- `app/play/components/MultiplayerMenu.tsx` contiene texto `NOMBRE TEMPORAL`.
- `TacticalGame.tsx` loguea datos de mapa en consola.
- Fetches de guardado de resultados hacen `.catch` pero no informan al usuario si falla persistencia.
- `AuthProvider.updateActiveCreature` acepta cualquier string enviado al endpoint; backend tampoco valida contra criaturas.
- Uso de `"use client"` es necesario en muchas pantallas, pero paginas informativas completas son client components solo por providers/framer; aumenta JS.

## Matriz frontend

| Elemento | Archivo | Estado | Problema | Severidad | Recomendacion |
| --- | --- | --- | --- | --- | --- |
| Ruta `/play` | `app/play/components/PlayScene.tsx` | Funcional con errores | Proteccion solo cliente | HIGH | Middleware o guard server. |
| Ruta `/profile` | `app/profile/profile-panel.tsx` | Funcional con errores | Proteccion solo cliente | HIGH | Middleware o server guard. |
| Login | `app/login/page.tsx` | Funcional con errores | Componente demasiado grande | MEDIUM | Separar flujo, formulario, animacion y verificacion. |
| Internacionalizacion juego | `app/play/**` | Parcial | Mensajes hardcodeados en espanol | MEDIUM | Mover copy a `messages`. |
| HUD/radar movil | `TacticalGame.tsx`, `MultiplayerGame.tsx` | No comprobado visualmente | Riesgo de overlay/overflow | HIGH | Pruebas en 375px/landscape y ajustes. |
| Metadata icons | `app/layout.tsx` | No funcional | Assets referidos no existen | LOW | Crear assets o quitar referencias. |
| Lobby | `MultiplayerMenu.tsx` | Funcional con errores | `NOMBRE TEMPORAL` en UI | LOW | Cambiar label final. |
| Result save UX | `TacticalGame.tsx`, `MultiplayerGame.tsx` | Parcial | Falla silenciosa de persistencia | MEDIUM | Mostrar estado o retry controlado. |
| Sesion legacy | `lib/session.ts` | Probable no utilizado | Auth localStorage antiguo | LOW | Eliminar tras confirmar imports. |
| Switchers | `ThemeSwitcher.tsx`, `LanguageSwitcher.tsx` | Funcional | No hay tooltip/focus especial | LOW | Revisar accesibilidad. |

## Problemas importantes

### [HIGH] Rutas privadas protegidas solo despues de hidratar

**Estado:** Confirmado  
**Archivo:** `app/play/components/PlayScene.tsx`, `app/profile/profile-panel.tsx`  
**Simbolo relacionado:** `router.replace("/login")`  
**Sistema:** Frontend / Auth  
**Descripcion:** `/play` y `/profile` cargan como rutas publicas y redirigen desde cliente.

**Evidencia:** No existe `middleware.ts`; el guard esta en `useEffect`.

**Consecuencia:** UX debil, flashes de pantalla y control incompleto de acceso a paginas.

**Como reproducirlo:** Abrir `/play` o `/profile` sin sesion.

**Recomendacion:** Middleware o wrapper server que valide cookie.

**Dependencias afectadas:** AuthProvider, profile, play.

### [MEDIUM] Internacionalizacion incompleta en juego y paginas

**Estado:** Confirmado  
**Archivo:** `app/play/components/*.tsx`, `app/How-to-play/page.tsx`, `app/world/page.tsx`  
**Simbolo relacionado:** textos hardcodeados  
**Sistema:** Frontend  
**Descripcion:** Aunque hay ES/EN, muchas cadenas del juego y lobby estan fijas en espanol.

**Evidencia:** Mensajes como `"Abres una ventana corta de parry."`, `"SALA PRIVADA"`, `"NOMBRE TEMPORAL"` aparecen en componentes.

**Consecuencia:** El idioma no funciona en todo el sitio.

**Como reproducirlo:** Cambiar a ingles y entrar al juego/lobby.

**Recomendacion:** Centralizar strings en `lib/i18n/messages.ts`.

**Dependencias afectadas:** UI, QA, documentacion.

### [LOW] Iconos de metadata faltantes

**Estado:** Confirmado  
**Archivo:** `app/layout.tsx`  
**Simbolo relacionado:** `metadata.icons`  
**Sistema:** Frontend / Assets  
**Descripcion:** Se referencian iconos que no existen en `public/`.

**Evidencia:** `rg` encuentra referencias; `public/` no contiene esos archivos.

**Consecuencia:** 404 de iconos en navegador/dispositivos.

**Como reproducirlo:** Solicitar `/icon.svg` o `/apple-icon.png`.

**Recomendacion:** Agregar assets reales o usar `app/favicon.ico`.

**Dependencias afectadas:** SEO/PWA/branding.
