import React from 'react';
import type { CopyStatus } from '@shared/clipboard';
import type { TranslationKey } from '@shared/i18n';
import {
  parseMarkdown,
  sanitizeLanguage,
  shouldRenderAsMarkdown,
  type BlockNode,
  type InlineNode,
  type ListItemNode,
} from '@core/markdown';
import { highlightCode } from '@core/picolor';
import {
  getLinkAriaLabel,
  getLinkModifierLabel,
  getLinkOpenLiveStatusText,
} from '@infra/opener';
import { useCopyFeedback } from '@features/chat/hooks/useCopyFeedback';
import { useLinkOpener } from '@features/chat/hooks/useLinkOpener';

export {
  getLinkAriaLabel,
  getLinkModifierLabel,
  getLinkOpenLiveStatusText,
  shouldRenderAsMarkdown,
};

export const LANG_ICONS: Record<string, string> = {
  ts: '', typescript: '', tsx: '', mts: '', cts: '',
  js: '', javascript: '', jsx: '', mjs: '', cjs: '',
  go: '', golang: '',
  rs: '', rust: '',
  py: '', python: '',
  rb: '', ruby: '',
  java: '', kt: '󱈙', kotlin: '󱈙', scala: '',
  c: '', h: '', cpp: '', cxx: '', hpp: '', cs: '󰌛', csharp: '󰌛',
  php: '',
  sh: '', bash: '', zsh: '', shell: '', fish: '', powershell: '󰨊',
  html: '', css: '', scss: '', sass: '', less: '',
  json: '󰘦', jsonc: '󰘦', yaml: '󰘦', yml: '󰘦', toml: '󰘦', xml: '󰗀',
  dockerfile: '󰡨', docker: '󰡨', makefile: '', make: '',
  diff: '', patch: '', git: '',
  sql: '',
  lua: '', zig: '', swift: '', dart: '', elixir: '',
  md: '', markdown: '',
  text: '󰈙', txt: '󰈙', plain: '󰈙', log: '󰈙',
};

export function getLanguageIcon(lang?: string): string {
  if (!lang) return '󰅪';
  const clean = lang.toLowerCase();
  return LANG_ICONS[clean] || '󰅪';
}

/**
 * Renders a crisp vector SVG icon for code block headers.
 * Avoids broken tofu/square glyphs on operating systems without patched Nerd Fonts.
 */
export const LanguageIcon: React.FC<{ lang?: string }> = ({ lang }) => {
  const clean = (lang || '').toLowerCase();

  // Terminal / Shell
  if (['sh', 'bash', 'zsh', 'shell', 'fish', 'powershell', 'ps1', 'terminal', 'console'].includes(clean)) {
    return (
      <svg className="code-lang-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    );
  }

  // Diffs / Git
  if (['diff', 'patch', 'git', 'gitcommit', 'gitrebase'].includes(clean)) {
    return (
      <svg className="code-lang-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="18" r="3" />
        <circle cx="6" cy="6" r="3" />
        <path d="M13 6h3a2 2 0 0 1 2 2v7" />
        <line x1="6" y1="9" x2="6" y2="21" />
      </svg>
    );
  }

  // Rust
  if (clean === 'rs' || clean === 'rust') {
    return (
      <svg className="code-lang-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    );
  }

  // JSON / Data / Config
  if (['json', 'jsonc', 'yaml', 'yml', 'toml', 'xml'].includes(clean)) {
    return (
      <svg className="code-lang-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1" />
        <path d="M16 21h1a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2 2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />
      </svg>
    );
  }

  // Database / SQL
  if (['sql', 'pgsql', 'mysql', 'sqlite'].includes(clean)) {
    return (
      <svg className="code-lang-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    );
  }

  // Markdown / Docs
  if (['md', 'markdown', 'mdown'].includes(clean)) {
    return (
      <svg className="code-lang-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <polyline points="9 15 12 18 15 15" />
        <line x1="12" y1="12" x2="12" y2="18" />
      </svg>
    );
  }

  // Code / General programming (TypeScript, JavaScript, Go, Python, C++, Java, etc.)
  if (['ts', 'typescript', 'tsx', 'js', 'javascript', 'jsx', 'go', 'golang', 'py', 'python', 'java', 'c', 'cpp', 'cs', 'php', 'rb', 'ruby', 'html', 'css'].includes(clean)) {
    return (
      <svg className="code-lang-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    );
  }

  // Default / Plaintext
  return (
    <svg className="code-lang-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
};

/**
 * Computes dynamic accessible aria-label for code block copy buttons.
 * Changes to "Copied..." or "Failed..." when active so screen readers announce the outcome.
 */
export function getCodeCopyAriaLabel(
  status: CopyStatus,
  displayLang: string,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): string {
  if (status === 'copied') {
    return t('markdown.copied_code_aria', { lang: displayLang });
  }
  if (status === 'failed') {
    return t('markdown.copy_failed_code_aria', { lang: displayLang });
  }
  return t('markdown.copy_code_aria', { lang: displayLang });
}

/**
 * Computes dynamic accessible aria-label for link copy buttons.
 * Announces copy success/failure dynamically to screen readers.
 */
export function getLinkCopyAriaLabel(
  status: CopyStatus,
  href: string,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): string {
  if (status === 'copied') {
    return t('markdown.copied_url_aria');
  }
  if (status === 'failed') {
    return t('markdown.copy_failed_url_aria');
  }
  return `${t('markdown.copy_url_aria')}: ${href}`;
}

/**
 * Returns accessible live region announcement text for copy status transitions.
 * Returns null on idle to prevent noisy repeated announcements when mounted or idle.
 */
export function getCopyLiveStatusText(
  status: CopyStatus,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): string | null {
  if (status === 'copied') {
    return t('markdown.copied');
  }
  if (status === 'failed') {
    return t('markdown.copy_failed');
  }
  return null;
}

export interface MarkdownContentProps {
  content: string;
  onInsertPrompt?: (code: string, fileName?: string, lang?: string) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

export interface CodeBlockProps {
  code: string;
  language?: string;
  fileName?: string;
  title?: string;
  isDiff?: boolean;
  onInsertPrompt?: (code: string, fileName?: string, lang?: string) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

/**
 * Fenced code block with header, language/file indicator, line count, PiColor
 * highlighting, and localized copy / insert-in-prompt actions.
 */
export const CodeBlock: React.FC<CodeBlockProps> = React.memo(({
  code,
  language,
  fileName,
  title,
  isDiff,
  onInsertPrompt,
  t,
}) => {
  const { status, triggerCopy } = useCopyFeedback();

  const sanitizedLang = sanitizeLanguage(language);
  const displayLang = sanitizedLang || t('markdown.code_plain');
  const displayTitle = fileName || title;

  const lineCount = React.useMemo(() => {
    return code ? code.split('\n').length : 0;
  }, [code]);

  const linesBadge =
    lineCount === 1
      ? t('markdown.lines_count_one')
      : t('markdown.lines_count', { count: lineCount });

  const copyLabel =
    status === 'copied'
      ? t('markdown.copied')
      : status === 'failed'
        ? t('markdown.copy_failed')
        : t('markdown.copy_code');

  const ariaLabel = getCodeCopyAriaLabel(status, displayTitle || displayLang, t);
  const liveStatus = getCopyLiveStatusText(status, t);

  const highlightedHtml = React.useMemo(() => {
    try {
      return highlightCode(code, sanitizedLang, 'picolor');
    } catch {
      return '';
    }
  }, [code, sanitizedLang]);

  return (
    <div className={`markdown-code-block${isDiff ? ' is-diff' : ''}`}>
      <div className="markdown-code-header">
        <div className="markdown-code-header-left">
          <span className="markdown-code-icon" aria-hidden="true">
            <LanguageIcon lang={sanitizedLang} />
          </span>
          {displayTitle ? (
            <span className="markdown-code-filename" title={displayTitle}>
              {displayTitle}
            </span>
          ) : (
            <span className="markdown-code-language">{displayLang}</span>
          )}
          {displayTitle && sanitizedLang && (
            <span className="markdown-code-lang-badge">{sanitizedLang}</span>
          )}
          <span className="markdown-code-lines">{linesBadge}</span>
        </div>
        <div className="markdown-code-header-actions">
          {onInsertPrompt && !isDiff && (
            <button
              type="button"
              className="markdown-code-action-btn markdown-code-insert-btn"
              onClick={() => onInsertPrompt(code, fileName, sanitizedLang)}
              aria-label={t('markdown.insert_prompt_aria', { lang: displayTitle || displayLang })}
              title={t('markdown.insert_prompt')}
            >
              <span className="action-btn-icon" aria-hidden="true">↵</span>
              <span>{t('markdown.insert_prompt')}</span>
            </button>
          )}
          <button
            type="button"
            className="markdown-code-action-btn markdown-code-copy-btn"
            onClick={() => void triggerCopy(code)}
            aria-label={ariaLabel}
            title={copyLabel}
          >
            {copyLabel}
          </button>
        </div>
        {liveStatus && (
          <span
            role="status"
            aria-live="polite"
            style={{
              position: 'absolute',
              width: '1px',
              height: '1px',
              padding: 0,
              margin: '-1px',
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          >
            {liveStatus}
          </span>
        )}
      </div>
      <pre className="markdown-code-pre">
        {highlightedHtml ? (
          <code
            className="markdown-code-text"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <code className="markdown-code-text">{code}</code>
        )}
      </pre>
    </div>
  );
});

/**
 * Safe link component:
 * - Never sets a navigable href that could navigate the Tauri WebView
 * - Prevents default on every user action
 * - Displays destination URL explicitly
 * - Provides an independent Copy URL button with localized feedback
 */
export const MarkdownLink: React.FC<{
  href: string;
  children: React.ReactNode;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}> = ({ href, children, t }) => {
  const errorId = React.useId();
  const { status: copyStatus, triggerCopy } = useCopyFeedback();
  const {
    status: openStatus,
    error: openError,
    handleClick,
    handleKeyDown,
  } = useLinkOpener(href, { requireModifier: false });

  const isAutolink = React.useMemo(() => {
    if (typeof children === 'string') {
      return children.trim() === href.trim();
    }
    if (Array.isArray(children) && children.length === 1 && typeof children[0] === 'string') {
      return children[0].trim() === href.trim();
    }
    return false;
  }, [children, href]);

  const copyLabel =
    copyStatus === 'copied'
      ? t('markdown.copied')
      : copyStatus === 'failed'
        ? t('markdown.copy_failed')
        : t('markdown.copy_url');

  const copyAriaLabel = getLinkCopyAriaLabel(copyStatus, href, t);
  const copyLiveStatus = getCopyLiveStatusText(copyStatus, t);

  const linkHint = getLinkModifierLabel(t);
  const linkAriaLabel = getLinkAriaLabel(openStatus, href, t);
  const openLiveStatus = getLinkOpenLiveStatusText(openStatus, t, openError);

  const linkClass = [
    'markdown-link',
    openStatus === 'opening' && 'markdown-link-opening',
    openStatus === 'failed' && 'markdown-link-failed',
  ]
    .filter(Boolean)
    .join(' ');

  const linkTitle =
    openStatus === 'failed' && openError
      ? `${href} — ${t('markdown.open_failed')}: ${openError}`
      : href;

  return (
    <span className="markdown-link-wrapper">
      <span
        role="link"
        tabIndex={0}
        className={linkClass}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        title={linkTitle}
        aria-label={linkAriaLabel}
        aria-describedby={openStatus === 'failed' && openError ? errorId : undefined}
        aria-busy={openStatus === 'opening'}
      >
        {children}
      </span>
      {!isAutolink && (
        <span
          className="markdown-link-destination"
          title={linkTitle}
          onClick={handleClick}
        >
          ({href})
        </span>
      )}
      {!isAutolink && (
        <span
          className="markdown-link-hint"
          title={linkTitle}
          onClick={handleClick}
        >
          [{linkHint}]
        </span>
      )}
      <button
        type="button"
        className="markdown-link-copy-btn"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void triggerCopy(href);
        }}
        aria-label={copyAriaLabel}
        title={copyLabel}
      >
        {copyLabel}
      </button>
      {openStatus === 'failed' && (
        <span id={errorId} className="markdown-link-error" role="none">
          {t('markdown.open_failed')}{openError ? `: ${openError}` : ''}
        </span>
      )}
      {(copyLiveStatus || openLiveStatus) && (
        <span
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          {openLiveStatus || copyLiveStatus}
        </span>
      )}
    </span>
  );
};

function renderInline(
  nodes: InlineNode[],
  keyPrefix: string,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): React.ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-in-${index}`;
    switch (node.type) {
      case 'text':
        return <React.Fragment key={key}>{node.value}</React.Fragment>;
      case 'code_inline':
        return (
          <code key={key} className="markdown-inline-code">
            {node.value}
          </code>
        );
      case 'strong':
        return (
          <strong key={key}>
            {renderInline(node.children, key, t)}
          </strong>
        );
      case 'emphasis':
        return (
          <em key={key}>
            {renderInline(node.children, key, t)}
          </em>
        );
      case 'link':
        return (
          <MarkdownLink key={key} href={node.href} t={t}>
            {renderInline(node.label, `${key}-lbl`, t)}
          </MarkdownLink>
        );
    }
  });
}

function renderListItem(
  item: ListItemNode,
  index: number,
  keyPrefix: string,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): React.ReactNode {
  const key = `${keyPrefix}-li-${index}`;
  return (
    <li key={key} className="markdown-li">
      {renderInline(item.children, key, t)}
      {item.subList && renderBlock(item.subList, 0, `${key}-sub`, t)}
    </li>
  );
}

function renderBlock(
  block: BlockNode,
  index: number,
  keyPrefix: string,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  onInsertPrompt?: (code: string, fileName?: string, lang?: string) => void
): React.ReactNode {
  const key = `${keyPrefix}-blk-${index}`;
  switch (block.type) {
    case 'heading': {
      const children = renderInline(block.children, key, t);
      switch (block.level) {
        case 1:
          return <h1 key={key} className="markdown-h markdown-h1">{children}</h1>;
        case 2:
          return <h2 key={key} className="markdown-h markdown-h2">{children}</h2>;
        case 3:
          return <h3 key={key} className="markdown-h markdown-h3">{children}</h3>;
        case 4:
          return <h4 key={key} className="markdown-h markdown-h4">{children}</h4>;
        case 5:
          return <h5 key={key} className="markdown-h markdown-h5">{children}</h5>;
        case 6:
          return <h6 key={key} className="markdown-h markdown-h6">{children}</h6>;
      }
      break;
    }
    case 'paragraph':
      return (
        <p key={key} className="markdown-p">
          {renderInline(block.children, key, t)}
        </p>
      );
    case 'code_block':
      return (
        <CodeBlock
          key={key}
          code={block.code}
          language={block.language}
          fileName={block.fileName}
          title={block.title}
          isDiff={block.isDiff}
          onInsertPrompt={onInsertPrompt}
          t={t}
        />
      );
    case 'list': {
      const items = block.items.map((item, itemIdx) =>
        renderListItem(item, itemIdx, key, t)
      );
      if (block.ordered) {
        return (
          <ol key={key} className="markdown-ol" start={block.start}>
            {items}
          </ol>
        );
      }
      return (
        <ul key={key} className="markdown-ul">
          {items}
        </ul>
      );
    }
    case 'table': {
      return (
        <div key={key} className="markdown-table-wrapper">
          <table className="markdown-table">
            <thead>
              <tr>
                {block.headers.map((h, hIdx) => (
                  <th
                    key={`${key}-th-${hIdx}`}
                    style={h.align ? { textAlign: h.align } : undefined}
                  >
                    {renderInline(h.children, `${key}-th-${hIdx}`, t)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rIdx) => (
                <tr key={`${key}-tr-${rIdx}`}>
                  {row.map((cell, cIdx) => (
                    <td
                      key={`${key}-td-${rIdx}-${cIdx}`}
                      style={cell.align ? { textAlign: cell.align } : undefined}
                    >
                      {renderInline(cell.children, `${key}-td-${rIdx}-${cIdx}`, t)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  }
}

/**
 * Pure React component rendering a safe Markdown subset.
 * Raw HTML is escaped automatically by React JSX; no dangerouslySetInnerHTML is ever used.
 */
export const MarkdownContent: React.FC<MarkdownContentProps> = React.memo(({
  content,
  onInsertPrompt,
  t,
}) => {
  const ast = React.useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className="markdown-body">
      {ast.children.map((block, idx) =>
        renderBlock(block, idx, 'md', t, onInsertPrompt)
      )}
    </div>
  );
});
