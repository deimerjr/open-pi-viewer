# Guía de Migración: Funcionalidades Portables de Pi Viewer

Esta guía separa el **código de producto / features genéricas** de las **configuraciones y rutas locales** para que puedas replicar exactamente las mejoras en otra copia limpia del repositorio.

---

## 1. Clasificación de Archivos: ¿Qué portar y qué no?

| Categoría | Archivos | ¿Portar a la otra copia? |
|---|---|---|
| **Feature 1: Indicador "Working" y Colores** | `src/infra/preferences.ts`<br>`src/features/chat/chat.css`<br>`src/features/settings/settings.css`<br>`src/features/settings/components/ThemeCustomizer.tsx`<br>`src/features/settings/SettingsView.tsx`<br>`src/features/settings/hooks/usePreferences.ts`<br>`src/app/App.tsx`<br>`src/shared/locales/en.json`<br>`src/shared/locales/es.json`<br>`tests/infra/preferences.test.ts` | **SÍ, 100% portable**. Es código fuente agnóstico del entorno. |
| **Feature 2: Auto-refresh de MCPs y Recursos** | `src/app/App.tsx` (efecto que escucha `state.sessionId`) | **SÍ**. Permite que la barra del prompt recargue MCPs al cambiar de sesión. |
| **Fix: Aislamiento RPC y no-bloqueo en New Session** | `server/web-ipc-bridge.ts` (lógica de `connect`, `new_session`, `getActiveRpc`) | **SÍ, la lógica**. La estructura que previene que se quede pegado es código puro. |
| **Fix: Resolución Multi-archivo de MCPs** | `server/web-ipc-bridge.ts` (funciones `readMcpServersFromFile`, `getMcpServersImpl`, `toggle_mcp_server`) | **SÍ**. Permite leer tanto `.mcp.json` como `mcp-adapter.json`. |
| **Configuraciones de Usuario / Rutas Locales** | Rutas a `C:/Program Files/...`, `D:/Proyectos/...`<br>Lista de proyectos presembrados en `index.html`<br>Valores en `~/.pi/agent/settings.json`<br>Rutas de `.mcp.json` | **NO**. Estas pertenecen al entorno de cada máquina. |

---

## 2. Cambios de Código Paso a Paso (Código Puro)

### Paso 1: Preferencias y Estilos de la Animación de Carga

#### `src/infra/preferences.ts`
Agrega los tipos del modo de animación y el cálculo de estilos:
```typescript
export type WorkAnimationMode = 'multicolor' | 'single' | 'dual';

export interface WorkAnimationPreferences {
  mode: WorkAnimationMode;
  color1: string;
  color2: string;
}

export const DEFAULT_WORK_ANIMATION_PREFERENCES: WorkAnimationPreferences = {
  mode: 'multicolor',
  color1: '#00ff0a',
  color2: '#00e5ff',
};

export function isValidHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace(/^#/, '').trim();
  let r = 0, g = 0, b = 0;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16) || 0;
    g = parseInt(clean[1] + clean[1], 16) || 0;
    b = parseInt(clean[2] + clean[2], 16) || 0;
  } else if (clean.length === 6) {
    r = parseInt(clean.slice(0, 2), 16) || 0;
    g = parseInt(clean.slice(2, 4), 16) || 0;
    b = parseInt(clean.slice(4, 6), 16) || 0;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function computeWorkAnimationStyles(pref?: WorkAnimationPreferences): {
  className: string;
  style?: Record<string, string>;
} {
  const mode = pref?.mode || 'multicolor';
  const c1 = pref?.color1 || DEFAULT_WORK_ANIMATION_PREFERENCES.color1;
  const c2 = pref?.color2 || DEFAULT_WORK_ANIMATION_PREFERENCES.color2;

  if (mode === 'single') {
    return {
      className: 'prompt-degraciao-loader is-mode-single',
      style: {
        '--loader-color1': c1,
        '--loader-color1-border': hexToRgba(c1, 0.4),
        '--loader-color1-glow': hexToRgba(c1, 0.45),
      },
    };
  }

  if (mode === 'dual') {
    return {
      className: 'prompt-degraciao-loader is-mode-dual',
      style: {
        '--loader-color1': c1,
        '--loader-color1-border': hexToRgba(c1, 0.4),
        '--loader-color1-glow': hexToRgba(c1, 0.45),
        '--loader-color2': c2,
        '--loader-color2-border': hexToRgba(c2, 0.4),
        '--loader-color2-glow': hexToRgba(c2, 0.45),
      },
    };
  }

  return {
    className: 'prompt-degraciao-loader is-mode-multicolor',
  };
}

export function validateWorkAnimationPreferences(input: unknown): WorkAnimationPreferences {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ...DEFAULT_WORK_ANIMATION_PREFERENCES };
  }
  const record = input as Record<string, unknown>;
  const mode: WorkAnimationMode =
    record.mode === 'single' || record.mode === 'dual' || record.mode === 'multicolor'
      ? record.mode
      : DEFAULT_WORK_ANIMATION_PREFERENCES.mode;

  const color1 = isValidHexColor(record.color1)
    ? record.color1.trim()
    : DEFAULT_WORK_ANIMATION_PREFERENCES.color1;

  const color2 = isValidHexColor(record.color2)
    ? record.color2.trim()
    : DEFAULT_WORK_ANIMATION_PREFERENCES.color2;

  return { mode, color1, color2 };
}
```

Dentro de `UiPreferences`:
```typescript
export interface UiPreferences {
  language: SupportedLocale;
  theme: AppTheme;
  notifications?: NotificationPreferences;
  workAnimation?: WorkAnimationPreferences;
}
```

En `PreferencesController`:
```typescript
setWorkAnimation(workAnimation: WorkAnimationPreferences): UiPreferences {
  const current = this.options.getPreferences();
  const updated: UiPreferences = { ...current, workAnimation };
  const saveRes = saveUiPreferences(updated, this.options.storage);
  if (!saveRes.success) {
    this.options.setWarning(saveRes.error ?? 'Failed to save UI preferences');
  } else {
    this.options.setWarning(null);
  }
  this.options.setPreferences(updated);
  return updated;
}
```

---

#### `src/features/chat/chat.css`
Sustituye la sección del loader animado:
```css
/* Animated Working Indicator ("Working") */
.prompt-degraciao-loader {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 2px 10px;
  background: rgba(0, 19, 0, 0.75);
  border: 1px solid rgba(0, 255, 10, 0.4);
  border-radius: 9999px;
  box-shadow: 0 0 10px rgba(0, 255, 10, 0.2);
  user-select: none;
}

.prompt-degraciao-loader.is-mode-multicolor,
.prompt-degraciao-loader:not(.is-mode-single):not(.is-mode-dual) {
  animation: changeColor 5s linear infinite;
}

.prompt-degraciao-loader.is-mode-single {
  border-color: var(--loader-color1-border, rgba(0, 255, 10, 0.4));
  box-shadow: 0 0 10px var(--loader-color1-glow, rgba(0, 255, 10, 0.2));
  animation: singleColorGlow 2.5s ease-in-out infinite alternate;
}

.prompt-degraciao-loader.is-mode-dual {
  border-color: var(--loader-color1-border, rgba(0, 255, 10, 0.4));
  box-shadow: 0 0 10px var(--loader-color1-glow, rgba(0, 255, 10, 0.2));
  animation: dualBorderShift 3s ease-in-out infinite alternate;
}

@keyframes changeColor {
  0% { filter: hue-rotate(0deg); }
  100% { filter: hue-rotate(360deg); }
}

@keyframes singleColorGlow {
  0% { box-shadow: 0 0 6px var(--loader-color1-glow, rgba(0, 255, 10, 0.2)); opacity: 0.92; }
  100% { box-shadow: 0 0 14px var(--loader-color1-glow, rgba(0, 255, 10, 0.5)); opacity: 1; }
}

@keyframes dualBorderShift {
  0% {
    border-color: var(--loader-color1-border, rgba(0, 255, 10, 0.4));
    box-shadow: 0 0 10px var(--loader-color1-glow, rgba(0, 255, 10, 0.25));
  }
  100% {
    border-color: var(--loader-color2-border, rgba(0, 229, 255, 0.4));
    box-shadow: 0 0 10px var(--loader-color2-glow, rgba(0, 229, 255, 0.25));
  }
}

.prompt-degraciao-loader h2 {
  color: #00ff0a;
  font-family: consolas, "JetBrainsMono Nerd Font", var(--font-mono, monospace);
  font-weight: 500;
  font-size: 11px;
  letter-spacing: 1.5px;
  margin: 0;
  padding: 0;
  white-space: nowrap;
  text-shadow: 0 0 6px #00ff0a, 0 0 12px rgba(0, 255, 10, 0.5);
  line-height: 1.2;
}

.prompt-degraciao-loader.is-mode-single h2 {
  color: var(--loader-color1, #00ff0a);
  text-shadow: 0 0 6px var(--loader-color1, #00ff0a), 0 0 12px var(--loader-color1-glow, rgba(0, 255, 10, 0.5));
}

.prompt-degraciao-loader.is-mode-dual h2 {
  animation: dualTextShift 3s ease-in-out infinite alternate;
}

@keyframes dualTextShift {
  0% {
    color: var(--loader-color1, #00ff0a);
    text-shadow: 0 0 6px var(--loader-color1, #00ff0a), 0 0 12px var(--loader-color1-glow, rgba(0, 255, 10, 0.5));
  }
  100% {
    color: var(--loader-color2, #00e5ff);
    text-shadow: 0 0 6px var(--loader-color2, #00e5ff), 0 0 12px var(--loader-color2-glow, rgba(0, 229, 255, 0.5));
  }
}

.prompt-degraciao-loader.is-mode-single .loader .dot {
  background: var(--loader-color1, #00ff0a);
  box-shadow: 0 0 4px var(--loader-color1, #00ff0a), 0 0 8px var(--loader-color1, #00ff0a), 0 0 12px var(--loader-color1, #00ff0a);
}

.prompt-degraciao-loader.is-mode-dual .loader:first-child .dot {
  background: var(--loader-color1, #00ff0a);
  box-shadow: 0 0 4px var(--loader-color1, #00ff0a), 0 0 8px var(--loader-color1, #00ff0a), 0 0 12px var(--loader-color1, #00ff0a);
}

.prompt-degraciao-loader.is-mode-dual .loader:last-child .dot {
  background: var(--loader-color2, #00e5ff);
  box-shadow: 0 0 4px var(--loader-color2, #00e5ff), 0 0 8px var(--loader-color2, #00e5ff), 0 0 12px var(--loader-color2, #00e5ff);
}
```

---

### Paso 2: Interfaz de Configuración de la Animación

#### `src/features/settings/settings.css`
Agrega los estilos del panel de animación:
```css
.theme-work-animation-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 20px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-muted);
  border-radius: var(--radius-md);
}

.loader-mode-pills { display: flex; gap: 8px; flex-wrap: wrap; }
.loader-mode-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px;
  font-size: 12px; font-weight: 500; border-radius: var(--radius-sm);
  background-color: var(--bg-subtle); border: 1px solid var(--border-muted);
  color: var(--fg-default); cursor: pointer; transition: all 0.15s ease;
}
.loader-mode-btn.is-active {
  background-color: var(--bg-elevated); border-color: var(--accent-primary);
  color: var(--accent-primary); box-shadow: 0 0 0 1px var(--accent-primary);
}

.loader-color-pickers { display: flex; flex-direction: column; gap: 14px; }
.loader-color-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.loader-color-label { font-size: 12px; font-weight: 600; color: var(--fg-default); min-width: 110px; }
.loader-swatches-wrap { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.loader-swatch-btn {
  width: 24px; height: 24px; border-radius: 50%; border: 2px solid transparent;
  cursor: pointer; transition: transform 0.15s ease, border-color 0.15s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.loader-swatch-btn.is-active {
  border-color: #ffffff; transform: scale(1.2); box-shadow: 0 0 0 2px var(--accent-primary);
}

.loader-preview-row {
  display: flex; align-items: center; gap: 14px; padding: 10px 14px;
  background-color: var(--bg-subtle); border: 1px dashed var(--border-muted);
  border-radius: var(--radius-sm); margin-top: 4px;
}
.loader-preview-caption { font-size: 11.5px; color: var(--fg-muted); font-family: var(--font-mono); }
```

#### `src/features/settings/components/ThemeCustomizer.tsx`
- Se actualizan las props de `ThemeCustomizerProps` para recibir `workAnimation?: WorkAnimationPreferences` y `onWorkAnimationChange?: (animation: WorkAnimationPreferences) => void`.
- Se añade el array de colores rápidos `LOADER_PALETTE_SWATCHES` (8 colores de alto contraste).
- Se sustituye el texto `"Trabajando como un Degraciao..."` por `"Working"`.
- Se incluye la sección interactiva `<section className="theme-work-animation-section">` con selector de modo (Multicolor, Un color, Dos colores), paleta de colores y selector hexadecimal nativo (`<input type="color">`).

---

### Paso 3: Hook de Preferencias y Conexión en `App.tsx`

#### `src/features/settings/hooks/usePreferences.ts`
- Se expone `handleWorkAnimationChange`:
```typescript
const handleWorkAnimationChange = (newAnimation: WorkAnimationPreferences) => {
  preferencesControllerRef.current?.setWorkAnimation(newAnimation);
};
```

#### `src/app/App.tsx`
- En el prompt bar, se renderiza la sección animada dinámicamente:
```tsx
const workAnimStyles = useMemo(
  () => computeWorkAnimationStyles(preferences.workAnimation),
  [preferences.workAnimation]
);

{isBusy ? (
  <section
    className={workAnimStyles.className}
    style={workAnimStyles.style as React.CSSProperties}
    aria-live="polite"
  >
    <div className="loader" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <div key={`dot-l-${i}`} className="dot" style={{ '--i': i } as React.CSSProperties} />
      ))}
    </div>
    <h2>Working</h2>
    <div className="loader" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <div key={`dot-r-${i}`} className="dot" style={{ '--i': i } as React.CSSProperties} />
      ))}
    </div>
  </section>
) : ( ... )}
```
- Se añade el efecto de recarga reactiva de MCPs y recursos:
```tsx
useEffect(() => {
  if (state.connectionStatus === 'connected') {
    void projectMcp.refreshServers();
    void globalMcp.refreshServers();
    void projectPiResources.refreshResources();
    void globalPiResources.refreshResources();
  }
}, [state.sessionId, state.connectionStatus, config.workingDirectory]);
```

---

### Paso 4: Claves de Internacionalización

#### `src/shared/locales/es.json`
```json
"theme.loader_heading": "Animación de Carga (\"Working\")",
"theme.loader_subheading": "Personaliza los colores del indicador animado mientras el agente está trabajando.",
"theme.loader_mode_label": "Modo de Color",
"theme.loader_mode_multicolor": "Multicolor (Arcoíris)",
"theme.loader_mode_single": "Un solo color",
"theme.loader_mode_dual": "Dos colores",
"theme.loader_color1_label": "Color Principal",
"theme.loader_color2_label": "Color Secundario",
"theme.loader_color_palette": "Paleta rápida"
```

#### `src/shared/locales/en.json`
```json
"theme.loader_heading": "Work Loading Animation (\"Working\")",
"theme.loader_subheading": "Customize the colors of the animated indicator while the agent is working.",
"theme.loader_mode_label": "Color Mode",
"theme.loader_mode_multicolor": "Multicolor (Rainbow)",
"theme.loader_mode_single": "Single Color",
"theme.loader_mode_dual": "Two Colors",
"theme.loader_color1_label": "Primary Color",
"theme.loader_color2_label": "Secondary Color",
"theme.loader_color_palette": "Quick Palette"
```

---

### Paso 5: Correcciones de Robustez en `server/web-ipc-bridge.ts`

Estas son mejoras del motor IPC que **no dependen de rutas fijas**:

1. **Aislamiento de RPC entre Proyectos (`getActiveRpc`)**:
```typescript
function getActiveRpc(): PiRpcSession | null {
  if (!activeSessionFile) {
    return null;
  }
  const norm = path.resolve(activeSessionFile);
  const rpc = sessionPool.get(norm);
  return rpc && rpc.isAlive() ? rpc : null;
}
```

2. **Reinicio de sesión al cambiar de directorio (`case 'connect'`)**:
```typescript
const targetCwd = payload.workingDirectory || activeCwd;
const previousCwd = activeCwd;
const projectChanged = path.resolve(targetCwd) !== path.resolve(previousCwd);
activeCwd = targetCwd;

if (projectChanged) {
  activeSessionFile = null;
  activeSessionId = null;
}
```

3. **Creación inmediata no bloqueante (`case 'new_session'`)**:
```typescript
const dir = resolveSessionsDir(activeCwd);
fs.mkdirSync(dir, { recursive: true });
const now = new Date();
const iso = now.toISOString();
const id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const fileName = `${iso.replace(/[:.]/g, '-')}_${id}.jsonl`;
const filePath = path.join(dir, fileName);

const header = {
  type: 'session',
  version: 3,
  id,
  timestamp: iso,
  cwd: activeCwd,
};
fs.writeFileSync(filePath, JSON.stringify(header) + '\n', 'utf8');

piRpc.sessionId = id;
piRpc.sessionFile = filePath;
setSessionStatus(filePath, 'completed', id);

// Calentamiento en segundo plano sin bloquear la respuesta de la UI
void piRpc.ensureRunning(activeCwd, filePath).catch((err) => {
  console.warn('[Pi RPC new_session warmup error]:', err);
});

return {
  cancelled: false,
  sessionId: id,
  sessionFile: filePath,
};
```

4. **Detección multiformato de servidores MCP (`getMcpServersImpl`)**:
Permite descubrir tanto `.mcp.json` (raíz o subcarpetas) como `mcp-adapter.json`:
```typescript
function readMcpServersFromFile(filePath: string, scope: 'global' | 'project'): any[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const sMap = data.mcpServers || data.servers || {};
    return Object.entries<any>(sMap).map(([name, cfg]) => ({
      name,
      command: cfg.command || '',
      args: cfg.args || [],
      url: cfg.url || undefined,
      serverType: cfg.url ? 'sse' : 'stdio',
      envKeys: cfg.env ? Object.keys(cfg.env) : [],
      disabled: Boolean(cfg.disabled),
      enabled: !cfg.disabled,
      scope,
      configPath: filePath,
      env: cfg.env || {},
      headers: cfg.headers || {},
    }));
  } catch {
    return [];
  }
}
```

---

## 3. ¿Cómo exportar o aplicar estos cambios en la otra copia?

Si tienes la otra copia como otro clon de git o carpeta, la forma más rápida y limpia de portar el código es mediante un **parche de git que solo incluya estos archivos**:

```bash
# En este proyecto, generar el parche con las features y mejoras:
git diff 8b6f58f -- \
  src/infra/preferences.ts \
  src/features/chat/chat.css \
  src/features/settings/ \
  src/app/App.tsx \
  src/shared/locales/ \
  tests/infra/preferences.test.ts \
  > feature-working-and-preferences.patch

# En la copia de destino:
git apply feature-working-and-preferences.patch
```

De esta forma, la otra copia recibirá **100% de la lógica, componentes y estilos** sin heredar ninguna ruta o configuración particular de esta estación de trabajo.
