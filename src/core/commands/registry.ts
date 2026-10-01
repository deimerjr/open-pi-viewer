import type { CommandDefinition, CommandSource } from './types';
export type { CommandDefinition, CommandSource };

export const COMMAND_REGISTRY: readonly CommandDefinition[] = [
  // =========================================================================
  // 1. Gentle AI / SDD Commands (source: 'gentle-pi')
  // =========================================================================
  {
    id: 'sdd-init',
    name: '/sdd-init',
    description: 'Inicializa la especificación formal y estructura OpenSpec/SDD en el proyecto',
    descriptionEn: 'Initialize formal specification and OpenSpec/SDD structure in project',
    source: 'gentle-pi',
    usage: '/sdd-init [nombre-del-cambio]',
  },
  {
    id: 'sdd-explore',
    name: '/sdd-explore',
    description: 'Fase de exploración arquitectónica y mapeo de contexto existente',
    descriptionEn: 'Architectural exploration phase and existing context mapping',
    source: 'gentle-pi',
    usage: '/sdd-explore',
  },
  {
    id: 'sdd-proposal',
    name: '/sdd-proposal',
    description: 'Genera o revisa la propuesta formal SDD de cambios y alcance',
    descriptionEn: 'Generate or review formal SDD proposal of changes and scope',
    source: 'gentle-pi',
    usage: '/sdd-proposal',
  },
  {
    id: 'sdd-spec',
    name: '/sdd-spec',
    description: 'Genera o audita la especificación de requerimientos y criterios de aceptación',
    descriptionEn: 'Generate or audit requirements specification and acceptance criteria',
    source: 'gentle-pi',
    usage: '/sdd-spec',
  },
  {
    id: 'sdd-design',
    name: '/sdd-design',
    description: 'Genera el documento de diseño técnico y decisiones arquitectónicas',
    descriptionEn: 'Generate technical design document and architectural decisions',
    source: 'gentle-pi',
    usage: '/sdd-design',
  },
  {
    id: 'sdd-tasks',
    name: '/sdd-tasks',
    description: 'Desglosa las tareas de implementación en unidades de trabajo ejecutables',
    descriptionEn: 'Break down implementation tasks into executable work units',
    source: 'gentle-pi',
    usage: '/sdd-tasks',
  },
  {
    id: 'sdd-apply',
    name: '/sdd-apply',
    description: 'Ejecuta las tareas de implementación de la fase SDD actual',
    descriptionEn: 'Execute implementation tasks of the current SDD phase',
    source: 'gentle-pi',
    usage: '/sdd-apply',
  },
  {
    id: 'sdd-verify',
    name: '/sdd-verify',
    description: 'Ejecuta verificación estricta, suite de pruebas y validación de fase',
    descriptionEn: 'Execute strict verification, test suite and phase validation',
    source: 'gentle-pi',
    usage: '/sdd-verify',
  },
  {
    id: 'sdd-archive',
    name: '/sdd-archive',
    description: 'Archiva el cambio SDD verificado y aprobado formalmente',
    descriptionEn: 'Archive verified and formally approved SDD change',
    source: 'gentle-pi',
    usage: '/sdd-archive',
  },
  {
    id: 'sdd-profiles',
    name: '/sdd-profiles',
    aliases: ['/sdd-profile', '/sdd-profile-list'],
    description: 'Administra o lista perfiles de modelos para subagentes y fases SDD',
    descriptionEn: 'Manage or list model profiles for subagents and SDD phases',
    source: 'gentle-pi',
    usage: '/sdd-profiles',
  },
  {
    id: 'sdd-profile-switch',
    name: '/sdd-profile-switch',
    description: 'Cambia el perfil activo de subagentes y SDD sin perder contexto',
    descriptionEn: 'Switch active subagents and SDD profile without losing context',
    source: 'gentle-pi',
    usage: '/sdd-profile-switch <nombre>',
  },
  {
    id: 'judgment-day',
    name: '/judgment-day',
    aliases: ['/juzgar', '/judgement-day'],
    description: 'Ejecuta revisión ciega dual adversarial con veredictos independientes',
    descriptionEn: 'Execute blind dual adversarial review with independent verdicts',
    source: 'gentle-pi',
    usage: '/judgment-day',
  },
  {
    id: 'branch-pr',
    name: '/branch-pr',
    description: 'Crea o prepara Pull Request con verificación de issues y disciplina Gentle AI',
    descriptionEn: 'Create or prepare Pull Request with issue checks and Gentle AI discipline',
    source: 'gentle-pi',
    usage: '/branch-pr',
  },
  {
    id: 'chained-pr',
    name: '/chained-pr',
    description: 'Divide cambios extensos (>400 líneas) en una cadena de PRs revisables',
    descriptionEn: 'Split oversized changes (>400 lines) into chained reviewable PRs',
    source: 'gentle-pi',
    usage: '/chained-pr',
  },
  {
    id: 'work-unit-commits',
    name: '/work-unit-commits',
    description: 'Planifica commits atómicos por unidad de trabajo manteniendo tests y docs',
    descriptionEn: 'Plan atomic commits as reviewable work units keeping tests and docs',
    source: 'gentle-pi',
    usage: '/work-unit-commits',
  },
  {
    id: 'rdd-defect-workflow',
    name: '/rdd-defect-workflow',
    description: 'Gestiona el flujo de defectos por autoridad de revisión RDD y receipts',
    descriptionEn: 'Manage defect workflow via RDD review authority and receipts',
    source: 'gentle-pi',
    usage: '/rdd-defect-workflow',
  },
  {
    id: 'skill-creation',
    name: '/skill-creation',
    aliases: ['/create-skill'],
    description: 'Crea una nueva skill para agentes con validación estricta de frontmatter',
    descriptionEn: 'Create a new agent skill with strict frontmatter validation',
    source: 'gentle-pi',
    usage: '/skill-creation',
  },
  {
    id: 'skill-improver',
    name: '/skill-improver',
    aliases: ['/improve-skills'],
    description: 'Audita y refactoriza skills existentes elevando su calidad',
    descriptionEn: 'Audit and refactor existing skills upgrading their quality',
    source: 'gentle-pi',
    usage: '/skill-improver',
  },
  {
    id: 'skill-registry',
    name: '/skill-registry',
    description: 'Actualiza e indexa el registro de skills disponibles por trigger y ruta',
    descriptionEn: 'Update and index available skills registry by trigger and path',
    source: 'gentle-pi',
    usage: '/skill-registry',
  },
  {
    id: 'btw',
    name: '/btw',
    description: 'Abre o consulta hilo de conversación paralelo sin interrumpir el flujo principal',
    descriptionEn: 'Open or query side-conversation thread without interrupting main flow',
    source: 'gentle-pi',
    usage: '/btw <pregunta o consulta>',
  },

  // =========================================================================
  // 2. Gentle Shell / pi-messages Commands (source: 'gentle-shell')
  // =========================================================================
  {
    id: 'cc',
    name: '/cc',
    aliases: ['/copy-code'],
    description: 'Copia al portapapeles el código del último mensaje (/cc, /cc all, /cc <n>)',
    descriptionEn: 'Copy code to clipboard from last message (/cc, /cc all, /cc <n>)',
    source: 'gentle-shell',
    usage: '/cc [all|<n>]',
    isClientAction: true,
  },
  {
    id: 'ci',
    name: '/ci',
    aliases: ['/insert-code'],
    description: 'Inserta el código del último mensaje en el editor del prompt (/ci, /ci all)',
    descriptionEn: 'Insert code from last message into prompt editor (/ci, /ci all)',
    source: 'gentle-shell',
    usage: '/ci [all|<n>]',
    isClientAction: true,
  },
  {
    id: 'picolor',
    name: '/picolor',
    aliases: ['/pi-color'],
    description: 'Configura o alterna el motor de resaltado de código (PiColor vs Vanilla)',
    descriptionEn: 'Configure or toggle code syntax highlighting engine (PiColor vs Vanilla)',
    source: 'gentle-shell',
    usage: '/picolor',
    isClientAction: true,
  },

  // =========================================================================
  // 3. Pi Core / CLI Commands (source: 'pi')
  // =========================================================================
  {
    id: 'help',
    name: '/help',
    description: 'Muestra el catálogo y guía de comandos disponibles en Pi-Viewer y Gentle AI',
    descriptionEn: 'Show catalog and guide of available commands in Pi-Viewer and Gentle AI',
    source: 'pi',
    usage: '/help',
  },
  {
    id: 'new',
    name: '/new',
    aliases: ['/reset'],
    description: 'Inicia una nueva conversación reseteando el contexto actual',
    descriptionEn: 'Start a new conversation resetting current context',
    source: 'pi',
    usage: '/new',
    isClientAction: true,
  },
  {
    id: 'clear',
    name: '/clear',
    description: 'Limpia los mensajes visuales del chat en la pantalla',
    descriptionEn: 'Clear visual chat message history on screen',
    source: 'pi',
    usage: '/clear',
    isClientAction: true,
  },
  {
    id: 'model',
    name: '/model',
    aliases: ['/models'],
    description: 'Muestra o cambia el modelo de lenguaje activo',
    descriptionEn: 'Show or switch the active language model',
    source: 'pi',
    usage: '/model [id-modelo]',
    isClientAction: true,
  },
  {
    id: 'thinking',
    name: '/thinking',
    description: 'Configura el nivel de razonamiento / pensamiento (off, low, medium, high)',
    descriptionEn: 'Configure thinking / reasoning level (off, low, medium, high)',
    source: 'pi',
    usage: '/thinking [off|low|medium|high]',
    isClientAction: true,
  },
  {
    id: 'compact',
    name: '/compact',
    description: 'Alterna el modo de compactación de procesos y herramientas por categoría',
    descriptionEn: 'Toggle compacting mode for processes and tools by category',
    source: 'pi',
    usage: '/compact',
    isClientAction: true,
  },
  {
    id: 'reload',
    name: '/reload',
    description: 'Recarga y refresca el navegador y la sesión de Pi',
    descriptionEn: 'Reload and refresh the browser and Pi session',
    source: 'pi',
    usage: '/reload',
    isClientAction: true,
  },
  {
    id: 'stats',
    name: '/stats',
    aliases: ['/cost'],
    description: 'Muestra las estadísticas de contexto, tokens y consumo de la sesión',
    descriptionEn: 'Show context, tokens and cost statistics for current session',
    source: 'pi',
    usage: '/stats',
    isClientAction: true,
  },
  {
    id: 'theme',
    name: '/theme',
    description: 'Cambia o lista los temas visuales disponibles en Pi-Viewer',
    descriptionEn: 'Switch or list available visual themes in Pi-Viewer',
    source: 'pi',
    usage: '/theme [DjRomoro|dark|light|arch-electric|Gentleman-Sexy-Djr|Minimalist-Ninja]',
    isClientAction: true,
  },
  {
    id: 'settings',
    name: '/settings',
    description: 'Abre el panel de configuración de conexión y preferencias',
    descriptionEn: 'Open connection configuration and preferences panel',
    source: 'pi',
    usage: '/settings',
    isClientAction: true,
  },
  {
    id: 'mcp',
    name: '/mcp',
    description: 'Abre la administración de servidores Model Context Protocol (MCP)',
    descriptionEn: 'Open Model Context Protocol (MCP) server management',
    source: 'pi',
    usage: '/mcp',
    isClientAction: true,
  },
  {
    id: 'extensions',
    name: '/extensions',
    description: 'Abre la gestión de extensiones y herramientas de Pi',
    descriptionEn: 'Open Pi extensions and tools management',
    source: 'pi',
    usage: '/extensions',
    isClientAction: true,
  },
  {
    id: 'profiles',
    name: '/profiles',
    description: 'Abre la vista de gestión de perfiles de modelos y subagentes',
    descriptionEn: 'Open model and subagent profiles management view',
    source: 'pi',
    usage: '/profiles',
    isClientAction: true,
  },
  {
    id: 'open',
    name: '/open',
    aliases: ['/view'],
    description: 'Abre un archivo en el visor modal de código de Pi-Viewer',
    descriptionEn: 'Open a file in Pi-Viewer modal code viewer',
    source: 'pi',
    usage: '/open <ruta-archivo>',
    isClientAction: true,
  },
  {
    id: 'diff',
    name: '/diff',
    aliases: ['/git-diff'],
    description: 'Abre el visor de diferencias Git para un archivo o cambios pendientes',
    descriptionEn: 'Open Git diff viewer for a file or pending changes',
    source: 'pi',
    usage: '/diff [ruta-archivo]',
    isClientAction: true,
  },
  {
    id: 'files',
    name: '/files',
    aliases: ['/tree'],
    description: 'Abre y enfoca la pestaña del explorador de archivos en el panel lateral',
    descriptionEn: 'Open and focus the file tree explorer tab in the sidebar',
    source: 'pi',
    usage: '/files',
    isClientAction: true,
  },
  {
    id: 'sidebar',
    name: '/sidebar',
    aliases: ['/sessions'],
    description: 'Muestra u oculta la barra lateral de sesiones y archivos',
    descriptionEn: 'Toggle visibility of sessions and files sidebar',
    source: 'pi',
    usage: '/sidebar',
    isClientAction: true,
  },
  {
    id: 'rename',
    name: '/rename',
    description: 'Renombra el título de la conversación actual',
    descriptionEn: 'Rename the current conversation title',
    source: 'pi',
    usage: '/rename <nuevo-título>',
    isClientAction: true,
  },
  {
    id: 'project',
    name: '/project',
    aliases: ['/projects'],
    description: 'Cambia de proyecto activo o lista los proyectos registrados',
    descriptionEn: 'Switch active project or list registered projects',
    source: 'pi',
    usage: '/project [nombre-o-id]',
    isClientAction: true,
  },
  {
    id: 'top',
    name: '/top',
    description: 'Desplaza el chat suavemente hacia el mensaje inicial',
    descriptionEn: 'Scroll smoothly to the top of the chat',
    source: 'pi',
    usage: '/top',
    isClientAction: true,
  },
  {
    id: 'bottom',
    name: '/bottom',
    description: 'Desplaza el chat inmediatamente al último mensaje',
    descriptionEn: 'Scroll immediately to the bottom of the chat',
    source: 'pi',
    usage: '/bottom',
    isClientAction: true,
  },
  {
    id: 'export',
    name: '/export',
    description: 'Descarga la conversación activa en formato Markdown o JSON',
    descriptionEn: 'Download active conversation as Markdown or JSON',
    source: 'pi',
    usage: '/export [md|json]',
    isClientAction: true,
  },
  {
    id: 'zen',
    name: '/zen',
    aliases: ['/focus'],
    description: 'Activa o desactiva el modo de enfoque limpio sin barras laterales',
    descriptionEn: 'Toggle clean focus mode hiding sidebars and panels',
    source: 'pi',
    usage: '/zen',
    isClientAction: true,
  },
  {
    id: 'detach',
    name: '/detach',
    description: 'Quita todos los archivos o imágenes adjuntos en el prompt actual',
    descriptionEn: 'Remove all attached files or images from current prompt',
    source: 'pi',
    usage: '/detach',
    isClientAction: true,
  },
];

/**
 * Checks if a prompt input string begins with a slash command.
 */
export function isCommandInput(input: string): boolean {
  if (!input) return false;
  const trimmed = input.trimStart();
  return trimmed.startsWith('/');
}

/**
 * Parses user input to extract command and arguments.
 */
export function parseCommandInput(input: string): {
  command: CommandDefinition | null;
  rawCommand: string;
  args: string;
} | null {
  if (!isCommandInput(input)) return null;

  const trimmed = input.trimStart();
  const firstSpace = trimmed.indexOf(' ');
  const rawCommand = (firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace)).toLowerCase();
  const args = firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1).trim();

  const command = findCommand(rawCommand) || null;
  return { command, rawCommand, args };
}

/**
 * Finds a command definition by exact name or alias.
 */
export function findCommand(nameOrAlias: string): CommandDefinition | undefined {
  const query = nameOrAlias.trim().toLowerCase();
  const normalized = query.startsWith('/') ? query : `/${query}`;

  return COMMAND_REGISTRY.find((cmd) => {
    if (cmd.name.toLowerCase() === normalized) return true;
    if (cmd.aliases && cmd.aliases.some((a) => a.toLowerCase() === normalized)) return true;
    return false;
  });
}

/**
 * Matches and filters commands for real-time autocomplete suggestions as the user types.
 */
export function matchCommands(query: string, limit = 15): CommandDefinition[] {
  const trimmed = query.trim().toLowerCase();
  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  if (normalized === '/') {
    return COMMAND_REGISTRY.slice(0, limit);
  }

  const scored: Array<{ cmd: CommandDefinition; score: number }> = [];

  for (const cmd of COMMAND_REGISTRY) {
    const name = cmd.name.toLowerCase();
    const id = cmd.id.toLowerCase();
    const aliases = (cmd.aliases || []).map((a) => a.toLowerCase());

    if (name === normalized || aliases.includes(normalized)) {
      scored.push({ cmd, score: 100 });
      continue;
    }

    if (name.startsWith(normalized)) {
      scored.push({ cmd, score: 80 - (name.length - normalized.length) });
      continue;
    }

    const matchedAlias = aliases.find((a) => a.startsWith(normalized));
    if (matchedAlias) {
      scored.push({ cmd, score: 70 - (matchedAlias.length - normalized.length) });
      continue;
    }

    if (name.includes(normalized) || id.includes(normalized.slice(1))) {
      scored.push({ cmd, score: 40 });
      continue;
    }

    if (
      cmd.description.toLowerCase().includes(trimmed.slice(1)) ||
      cmd.descriptionEn.toLowerCase().includes(trimmed.slice(1))
    ) {
      scored.push({ cmd, score: 20 });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.cmd);
}

/**
 * Returns human-readable localized label for command sources.
 */
export function getCommandSourceLabel(source: CommandSource, locale: 'es' | 'en' = 'es'): string {
  switch (source) {
    case 'gentle-pi':
      return 'Gentle AI / SDD';
    case 'gentle-shell':
      return 'Gentle Shell';
    case 'pi':
      return locale === 'es' ? 'Pi Nativo' : 'Native Pi';
  }
}
