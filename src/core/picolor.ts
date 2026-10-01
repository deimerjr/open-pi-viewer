/**
 * PiColor Syntax Highlighting Engine (Universal Semantic AST Enrichment)
 *
 * Combines highlight.js (over 190 languages) with the PiColor semantic contextual
 * analyzer from pi-messages (DarkKevo/pi-messages):
 * - Method and function call highlighting (.Method(), callFunc())
 * - Classes, structs, and types in PascalCase
 * - Universal operators (:=, !=, ==, ===, !==, <=, >=, &&, ||, ->, =>, etc.)
 * - Line-level Git diff / patch rendering
 * - Plaintext / log avoidance (no false positives)
 * - Safe HTML entity escaping preventing XSS
 */

import hljs from 'highlight.js';

export type SyntaxEngineMode = 'picolor' | 'vanilla';

const PLAIN_LANGUAGES = new Set([
  'text',
  'txt',
  'plain',
  'plaintext',
  'log',
  'logs',
  'output',
  'raw',
]);

const DIFF_LANGUAGES = new Set([
  'diff',
  'patch',
  'gitcommit',
  'gitrebase',
]);

export const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  rs: 'rust',
  go: 'go',
  py: 'python',
  rb: 'ruby',
  java: 'java',
  kt: 'kotlin',
  c: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  h: 'c',
  hpp: 'cpp',
  cs: 'csharp',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  json: 'json',
  jsonc: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  html: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'less',
  sql: 'sql',
  md: 'markdown',
  markdown: 'markdown',
  diff: 'diff',
  patch: 'diff',
  dockerfile: 'dockerfile',
  lua: 'lua',
  zig: 'zig',
  swift: 'swift',
};

/**
 * Detects programming language identifier from a file path or extension.
 */
export function detectLanguageFromPath(filePath?: string): string {
  if (!filePath || typeof filePath !== 'string') return '';
  const clean = filePath.split('?')[0].split('#')[0].trim();
  const fileName = clean.split(/[/\\]/).pop() || clean;

  const lowerName = fileName.toLowerCase();
  if (lowerName === 'dockerfile') return 'dockerfile';
  if (lowerName === 'makefile') return 'makefile';
  if (lowerName === 'cargo.toml' || lowerName === 'cargo.lock') return 'toml';

  const ext = lowerName.includes('.') ? lowerName.split('.').pop() || '' : '';
  return EXTENSION_LANGUAGE_MAP[ext] || ext;
}

/**
 * Escapes raw text safely into HTML entities.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Highlights Git unified diff or patch text with line-level badges.
 */
function highlightDiff(rawCode: string): string {
  const lines = rawCode.split('\n');
  const highlightedLines = lines.map((line) => {
    const escaped = escapeHtml(line);
    if (line.startsWith('+++') || line.startsWith('---')) {
      return `<span class="diff-line-info">${escaped}</span>`;
    }
    if (line.startsWith('+')) {
      return `<span class="diff-line-add">${escaped}</span>`;
    }
    if (line.startsWith('-')) {
      return `<span class="diff-line-delete">${escaped}</span>`;
    }
    if (line.startsWith('@@')) {
      return `<span class="diff-line-info">${escaped}</span>`;
    }
    return escaped;
  });
  return highlightedLines.join('\n');
}

/**
 * Applies universal semantic enrichment (PiColor) to uncolored spans in highlight.js output.
 */
function enrichSemanticTokens(html: string, isMarkdown: boolean): string {
  const tokens = html.split(/(<\/?span[^>]*>)/g);
  let enrichedHtml = '';
  let insideExcluded = false;

  for (const tok of tokens) {
    if (tok.startsWith('<span')) {
      if (
        tok.includes('hljs-string') ||
        tok.includes('hljs-comment') ||
        tok.includes('hljs-keyword') ||
        tok.includes('hljs-literal') ||
        tok.includes('hljs-section') ||
        tok.includes('hljs-quote') ||
        tok.includes('hljs-code')
      ) {
        insideExcluded = true;
      }
      enrichedHtml += tok;
    } else if (tok.startsWith('</span')) {
      insideExcluded = false;
      enrichedHtml += tok;
    } else {
      if (insideExcluded || isMarkdown) {
        enrichedHtml += tok;
      } else {
        let t = tok;
        // 1. Universal operators: :=, !=, ==, ===, !==, <=, >=, &&, ||, ->, =>, <-, +=, -=, etc.
        t = t.replace(
          /(:=|!==|===|!=|==|&amp;&amp;|\|\||-&gt;|=&gt;|&lt;-|\+=|-=|\*=|\/=|%=)/g,
          '<span class="hljs-operator">$1</span>'
        );
        // 2. Method and function calls: .Method() or function()
        t = t.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g, '<span class="hljs-title">$1</span>');
        // 3. Types, structs, and classes in PascalCase (e.g. UserService, Option, Result)
        t = t.replace(/(?<![a-zA-Z0-9_])([A-Z][a-zA-Z0-9_]+)\b/g, '<span class="hljs-type">$1</span>');
        enrichedHtml += t;
      }
    }
  }

  return enrichedHtml;
}

/**
 * Highlights a block of code into safe, styled HTML markup.
 *
 * @param rawCode Unescaped code string
 * @param language Optional language identifier (e.g. 'ts', 'go', 'python', 'diff')
 * @param mode 'picolor' (default enriched semantic) or 'vanilla' (pure highlight.js)
 */
export function highlightCode(
  rawCode: string,
  language?: string,
  mode: SyntaxEngineMode = 'picolor'
): string {
  if (!rawCode) return '';

  const lang = (language || '').trim().toLowerCase();

  // 1. Plaintext and logs: return safe escaped text without syntax coloring
  if (PLAIN_LANGUAGES.has(lang)) {
    return escapeHtml(rawCode);
  }

  // 2. Git diffs and patches
  if (DIFF_LANGUAGES.has(lang)) {
    return highlightDiff(rawCode);
  }

  // 3. Highlight with highlight.js
  let html = '';
  try {
    const validLang = lang && hljs.getLanguage(lang) ? lang : null;
    if (validLang) {
      html = hljs.highlight(rawCode, { language: validLang, ignoreIllegals: true }).value;
    } else if (lang) {
      // Auto-highlight fallback if language not recognized
      html = hljs.highlightAuto(rawCode).value;
    } else {
      html = escapeHtml(rawCode);
    }
  } catch {
    html = escapeHtml(rawCode);
  }

  // 4. Vanilla mode: return raw highlight.js output
  if (mode === 'vanilla' || !html) {
    return html;
  }

  // 5. PiColor mode: apply universal semantic enrichment
  const isMarkdown = lang === 'md' || lang === 'markdown' || lang === 'mdown' || lang === 'mkdn';
  return enrichSemanticTokens(html, isMarkdown);
}
