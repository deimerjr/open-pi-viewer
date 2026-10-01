import assert from 'node:assert/strict';
import test from 'node:test';
import { findCommand, parseCommandInput } from '@core/commands/registry';
import { exportToMarkdown, exportToJson, generateExportFilename } from '@core/export';

test('gui-commands: slash command palette recognizes all new GUI commands', () => {
  const commands = ['open', 'diff', 'files', 'sidebar', 'rename', 'project', 'top', 'bottom', 'export', 'zen', 'detach'];

  for (const cmdId of commands) {
    const cmd = findCommand(`/${cmdId}`);
    assert.ok(cmd, `Command /${cmdId} must be registered`);
    assert.equal(cmd.isClientAction, true);
    assert.equal(cmd.source, 'pi');
  }
});

test('gui-commands: command aliases map accurately', () => {
  assert.equal(findCommand('/view')?.id, 'open');
  assert.equal(findCommand('/git-diff')?.id, 'diff');
  assert.equal(findCommand('/tree')?.id, 'files');
  assert.equal(findCommand('/sessions')?.id, 'sidebar');
  assert.equal(findCommand('/projects')?.id, 'project');
  assert.equal(findCommand('/focus')?.id, 'zen');
});

test('gui-commands: parseCommandInput parses GUI commands with options', () => {
  const openParsed = parseCommandInput('/open src/app/App.tsx');
  assert.equal(openParsed?.command?.id, 'open');
  assert.equal(openParsed?.args, 'src/app/App.tsx');

  const renameParsed = parseCommandInput('/rename Nueva Sesion');
  assert.equal(renameParsed?.command?.id, 'rename');
  assert.equal(renameParsed?.args, 'Nueva Sesion');

  const exportParsed = parseCommandInput('/export json');
  assert.equal(exportParsed?.command?.id, 'export');
  assert.equal(exportParsed?.args, 'json');
});

test('gui-commands: export formatting handles markdown and json correctly', () => {
  const messages = [
    { id: '1', role: 'user' as const, content: 'test user', timestamp: '12:00' },
    { id: '2', role: 'assistant' as const, content: 'test assistant', timestamp: '12:01' },
  ];

  const md = exportToMarkdown(messages, 'Test Session');
  assert.ok(md.includes('# Test Session'));
  assert.ok(md.includes('test user'));
  assert.ok(md.includes('test assistant'));

  const jsonStr = exportToJson(messages, 'Test Session');
  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.title, 'Test Session');
  assert.equal(parsed.messages.length, 2);

  const filenameMd = generateExportFilename('Test Session', 'md');
  assert.ok(filenameMd.startsWith('test-session-'));
  assert.ok(filenameMd.endsWith('.md'));
});
