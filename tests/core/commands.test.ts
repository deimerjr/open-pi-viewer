import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findCommand,
  isCommandInput,
  matchCommands,
  parseCommandInput,
  COMMAND_REGISTRY,
} from '@core/commands/registry';

test('commands: isCommandInput identifies slash commands', () => {
  assert.equal(isCommandInput('/sdd-init'), true);
  assert.equal(isCommandInput('  /cc all'), true);
  assert.equal(isCommandInput('/help'), true);
  assert.equal(isCommandInput('regular message'), false);
  assert.equal(isCommandInput(''), false);
});

test('commands: findCommand finds commands by exact name and aliases', () => {
  const sddInit = findCommand('/sdd-init');
  assert.ok(sddInit);
  assert.equal(sddInit.id, 'sdd-init');
  assert.equal(sddInit.source, 'gentle-pi');

  // Alias
  const copyCode = findCommand('/copy-code');
  assert.ok(copyCode);
  assert.equal(copyCode.id, 'cc');
  assert.equal(copyCode.source, 'gentle-shell');

  const juzgar = findCommand('/juzgar');
  assert.ok(juzgar);
  assert.equal(juzgar.id, 'judgment-day');

  const resetCmd = findCommand('/reset');
  assert.ok(resetCmd);
  assert.equal(resetCmd.id, 'new');
  assert.equal(resetCmd.source, 'pi');
});

test('commands: parseCommandInput parses command and arguments cleanly', () => {
  const parsed1 = parseCommandInput('/sdd-init my-new-feature');
  assert.ok(parsed1);
  assert.equal(parsed1.rawCommand, '/sdd-init');
  assert.equal(parsed1.args, 'my-new-feature');
  assert.equal(parsed1.command?.id, 'sdd-init');

  const parsed2 = parseCommandInput('/cc all');
  assert.ok(parsed2);
  assert.equal(parsed2.rawCommand, '/cc');
  assert.equal(parsed2.args, 'all');
  assert.equal(parsed2.command?.id, 'cc');

  const parsed3 = parseCommandInput('not a command');
  assert.equal(parsed3, null);
});

test('commands: recognizes GUI interaction commands (/open, /diff, /files, /sidebar, /rename, /project, /top, /bottom, /export, /zen, /detach)', () => {
  const openCmd = findCommand('/open');
  assert.ok(openCmd);
  assert.equal(openCmd.id, 'open');
  assert.equal(openCmd.isClientAction, true);

  const viewCmd = findCommand('/view');
  assert.ok(viewCmd);
  assert.equal(viewCmd.id, 'open');

  const diffCmd = findCommand('/diff');
  assert.ok(diffCmd);
  assert.equal(diffCmd.id, 'diff');

  const filesCmd = findCommand('/files');
  assert.ok(filesCmd);
  assert.equal(filesCmd.id, 'files');

  const treeCmd = findCommand('/tree');
  assert.ok(treeCmd);
  assert.equal(treeCmd.id, 'files');

  const sidebarCmd = findCommand('/sidebar');
  assert.ok(sidebarCmd);
  assert.equal(sidebarCmd.id, 'sidebar');

  const renameCmd = findCommand('/rename');
  assert.ok(renameCmd);
  assert.equal(renameCmd.id, 'rename');

  const projectCmd = findCommand('/project');
  assert.ok(projectCmd);
  assert.equal(projectCmd.id, 'project');

  const topCmd = findCommand('/top');
  assert.ok(topCmd);
  assert.equal(topCmd.id, 'top');

  const bottomCmd = findCommand('/bottom');
  assert.ok(bottomCmd);
  assert.equal(bottomCmd.id, 'bottom');

  const exportCmd = findCommand('/export');
  assert.ok(exportCmd);
  assert.equal(exportCmd.id, 'export');

  const zenCmd = findCommand('/zen');
  assert.ok(zenCmd);
  assert.equal(zenCmd.id, 'zen');

  const focusCmd = findCommand('/focus');
  assert.ok(focusCmd);
  assert.equal(focusCmd.id, 'zen');

  const detachCmd = findCommand('/detach');
  assert.ok(detachCmd);
  assert.equal(detachCmd.id, 'detach');
});

test('commands: matchCommands fuzzy matches typed queries and groups by relevance', () => {
  assert.ok(COMMAND_REGISTRY.length > 0);
  const matchesSdd = matchCommands('/sdd');
  assert.ok(matchesSdd.length >= 8);
  assert.ok(matchesSdd.some((c) => c.id === 'sdd-init'));
  assert.ok(matchesSdd.some((c) => c.id === 'sdd-proposal'));
  assert.ok(matchesSdd.every((c) => c.source === 'gentle-pi'));

  const matchesCc = matchCommands('/c');
  assert.ok(matchesCc.some((c) => c.id === 'cc'));
  assert.ok(matchesCc.some((c) => c.id === 'clear'));
  assert.ok(matchesCc.some((c) => c.id === 'compact'));

  const allCmds = matchCommands('/');
  assert.ok(allCmds.length > 10);
});
