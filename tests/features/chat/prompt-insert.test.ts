import assert from 'node:assert/strict';
import test from 'node:test';

// Helper mimicking insertCodeIntoPrompt logic for testing formatting rules
function formatCodeForPrompt(
  currentPrompt: string,
  code: string,
  fileName?: string,
  lang?: string
): string {
  let textToInsert = '';
  const cleanLang = (lang || '').toLowerCase();
  if (cleanLang === 'bash' || cleanLang === 'sh' || cleanLang === 'zsh') {
    textToInsert = code;
  } else {
    const header = fileName && lang ? `${lang}:${fileName}` : (fileName || lang || '');
    textToInsert = header ? `\`\`\`${header}\n${code}\n\`\`\`` : `\`\`\`\n${code}\n\`\`\``;
  }

  const trimmed = currentPrompt.trim();
  if (!trimmed) {
    return textToInsert;
  }
  return `${trimmed}\n\n${textToInsert}`;
}

test('prompt-insert: inserts shell scripts raw without code block fences', () => {
  const result = formatCodeForPrompt('', 'npm run build', undefined, 'bash');
  assert.equal(result, 'npm run build');

  const resultZsh = formatCodeForPrompt('Existing prompt', 'cargo check', undefined, 'zsh');
  assert.equal(resultZsh, 'Existing prompt\n\ncargo check');
});

test('prompt-insert: formats programming languages as fenced blocks with language and filename', () => {
  const result = formatCodeForPrompt(
    '',
    'const x = 10;',
    'src/main.ts',
    'typescript'
  );
  assert.equal(result, '```typescript:src/main.ts\nconst x = 10;\n```');
});

test('prompt-insert: appends to existing prompt draft with double newline separation', () => {
  const existing = 'Please refactor this function:';
  const result = formatCodeForPrompt(existing, 'function test() {}', undefined, 'javascript');
  assert.equal(result, 'Please refactor this function:\n\n```javascript\nfunction test() {}\n```');
});
