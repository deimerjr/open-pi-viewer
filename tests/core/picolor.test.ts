import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectLanguageFromPath,
  escapeHtml,
  highlightCode,
} from '@core/picolor';

// ============================================================================
// PiColor Syntax Highlighting Tests
// ============================================================================

test('picolor: escapes HTML entities safely to prevent XSS injection', () => {
  const unsafe = '<script>alert("xss")</script> & "quotes" \'single\'';
  const escaped = escapeHtml(unsafe);
  assert.equal(escaped.includes('<script>'), false);
  assert.equal(escaped.includes('&lt;script&gt;'), true);
  assert.equal(escaped.includes('&amp;'), true);
  assert.equal(escaped.includes('&quot;'), true);
  assert.equal(escaped.includes('&#39;'), true);
});

test('picolor: plaintext and logs render as escaped plain text without syntax tokens', () => {
  const logSnippet = '2025-01-01 [INFO] Server started on port 8080: <running>';
  const highlighted = highlightCode(logSnippet, 'log');
  assert.equal(highlighted.includes('hljs-'), false);
  assert.equal(highlighted.includes('&lt;running&gt;'), true);

  const textSnippet = 'Plain unformatted text with PascalCase word and function()';
  const highlightedText = highlightCode(textSnippet, 'text');
  assert.equal(highlightedText.includes('hljs-'), false);
});

test('picolor: highlights TypeScript / JavaScript keywords and strings', () => {
  const code = 'const greeting: string = "Hello World";';
  const highlighted = highlightCode(code, 'typescript');
  assert.equal(highlighted.includes('hljs-keyword'), true);
  assert.equal(highlighted.includes('hljs-string'), true);
});

test('picolor: enriches function calls, PascalCase types, and universal operators', () => {
  const goCode = `
func handleUser(service *UserService) error {
  user := service.GetUser("123")
  if user == nil || user.IsActive() != true {
    return ErrNotFound
  }
  return nil
}
`;
  const enriched = highlightCode(goCode, 'go', 'picolor');

  // Method / function calls
  assert.equal(enriched.includes('hljs-title'), true);

  // PascalCase types/structs: UserService, ErrNotFound
  assert.equal(enriched.includes('hljs-type'), true);

  // Universal operators: :=, ==, !=
  assert.equal(enriched.includes('hljs-operator'), true);
});

test('picolor: vanilla mode skips semantic AST token enrichment', () => {
  const code = 'x := CalcValue(10);';
  const vanilla = highlightCode(code, 'go', 'vanilla');
  const picolor = highlightCode(code, 'go', 'picolor');

  // In vanilla highlight.js, := is not wrapped in hljs-operator
  assert.equal(vanilla.includes('hljs-operator'), false);
  assert.equal(picolor.includes('hljs-operator'), true);
});

test('picolor: highlights Git diffs with line-level classes and excludes from code execution', () => {
  const diff = `--- a/file.ts\n+++ b/file.ts\n@@ -1,3 +1,3 @@\n-const oldVal = 1;\n+const newVal = 2;\n const keep = true;`;
  const highlighted = highlightCode(diff, 'diff');

  assert.equal(highlighted.includes('diff-line-info'), true);
  assert.equal(highlighted.includes('diff-line-delete'), true);
  assert.equal(highlighted.includes('diff-line-add'), true);
  assert.equal(highlighted.includes('const keep = true;'), true);
});

test('picolor: detectLanguageFromPath detects languages from file extensions and special filenames', () => {
  assert.equal(detectLanguageFromPath('src/core/process-grouping.ts'), 'typescript');
  assert.equal(detectLanguageFromPath('main.rs'), 'rust');
  assert.equal(detectLanguageFromPath('server.go'), 'go');
  assert.equal(detectLanguageFromPath('script.py'), 'python');
  assert.equal(detectLanguageFromPath('config.json'), 'json');
  assert.equal(detectLanguageFromPath('Dockerfile'), 'dockerfile');
  assert.equal(detectLanguageFromPath('Makefile'), 'makefile');
  assert.equal(detectLanguageFromPath('styles.css'), 'css');
  assert.equal(detectLanguageFromPath(''), '');
  assert.equal(detectLanguageFromPath(undefined), '');
});
