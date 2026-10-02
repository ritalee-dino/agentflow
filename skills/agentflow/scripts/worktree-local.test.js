'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const settings = require('./ag-settings');
const notebook = '.agentflow/devlog.md';
const env = { ...process.env, CODEX_THREAD_ID: 'local-notebook-test', CODEX_SESSION_ID: '', CLAUDE_SESSION_ID: '', CLAUDE_PROJECT_DIR: '', AGENTFLOW_SESSION_ID: 'local-notebook-test', AGENTFLOW_EXTERNAL_DELEGATE: '' };
const command = (root, script, args, input) => spawnSync(process.execPath, [path.join(__dirname, script), ...args], { cwd: root, env, input, encoding: 'utf8' });
const start = (root, input) => command(root, 'agf.js', ['start', '--repo', root, '--host', 'codex', '--message-stdin', '--json'], input);
const git = (root, args) => { const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
const fixture = (t, { ignore = '.agentflow/\nag.json\n', tracked_config = false } = {}) => {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'agf-local-notebook-')));
  const root = path.join(directory, 'main'), worktree = path.join(directory, 'linked');
  fs.mkdirSync(root);
  git(root, ['init', '-q', '-b', 'main']);
  git(root, ['config', 'user.name', 'Notebook Test']);
  git(root, ['config', 'user.email', 'notebook@example.invalid']);
  fs.writeFileSync(path.join(root, 'baseline.txt'), 'baseline\n');
  if (tracked_config) fs.writeFileSync(path.join(root, 'ag.json'), JSON.stringify(settings.make_template('codex')));
  git(root, ['add', '.']); git(root, ['commit', '-qm', 'baseline']);
  fs.appendFileSync(path.join(root, '.git/info/exclude'), '\n' + ignore);
  git(root, ['worktree', 'add', '-q', '-b', 'local-feature', worktree]);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { root, worktree };
};

test('request parser retains matching fence character and length', () => {
  const parse = require('./worktree-local').parse_worktree_local_request;
  for (const message of [
    'godev\n```text\n~~~\nworktree-local-notebook: on\n```',
    'godev\n````text\n```\nworktree-local-notebook: on\n````',
    'godev\n+ ~~~~text\n+ ~~~\n+ worktree-local-notebook: true\n+ ~~~~',
    'godev\n```text\n```example\nworktree-local-notebook: on\n```',
  ]) assert.equal(parse(message), false, message);
  assert.equal(parse('godev\n````text\nexample\n`````\nworktree-local-notebook: on'), true);
});

test('AC-1: a manual linked worktree retains the canonical-stream error without opt-in', t => {
  const { worktree } = fixture(t);
  const result = start(worktree, 'godev');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /stream notebook is missing for this worktree; restore its canonical notebook before intake/u);
  assert.equal(fs.existsSync(path.join(worktree, 'ag.json')), false);
  assert.equal(fs.existsSync(path.join(worktree, '.agentflow')), false);
});

test('AC-2: opt-in bootstraps the ignored local notebook without Git-visible changes', t => {
  const { worktree } = fixture(t);
  const before = git(worktree, ['status', '--porcelain']);
  const message = 'godev worktree-local-notebook: on';
  const result = start(worktree, message);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.notebook, notebook);
  assert.deepEqual(output.worktree_local, { enabled: true, created_config: true });
  assert.equal(JSON.parse(fs.readFileSync(path.join(worktree, 'ag.json'))).switches['worktree-local-notebook'], 'on');
  assert.match(fs.readFileSync(path.join(worktree, notebook), 'utf8'), /\+ godev worktree-local-notebook: on/u);
  assert.notEqual(output.stream_decision.reason, 'foreign_or_parallel_work');
  assert.equal(git(worktree, ['status', '--porcelain']), before);
  assert.deepEqual(output.setup_created_files.filter(relative => ['ag.json', notebook].includes(relative)), ['ag.json', notebook]);
});

for (const message of ['godev\nworktree-local-notebook: on', '/godev WORKTREE-LOCAL-NOTEBOOK : TRUE', '+ godev\n+ Worktree-Local-Notebook: on']) test(`AC-3/Q1: local bootstrap accepts ${JSON.stringify(message)}`, t => {
  const { worktree } = fixture(t);
  const result = start(worktree, message);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).notebook, notebook);
  assert.equal(JSON.parse(fs.readFileSync(path.join(worktree, 'ag.json'))).switches['worktree-local-notebook'], 'on');
});

for (const fence of ['```', '~~~']) test(`AC-4: ${fence} fenced instructions do not enable local mode`, t => {
  const { worktree } = fixture(t);
  const result = start(worktree, `godev\n${fence}text\nworktree-local-notebook: on\n${fence}`);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /stream notebook is missing/u);
  assert.equal(fs.existsSync(path.join(worktree, 'ag.json')), false);
});

test('AC-5/6/12: later startup, writer and hook share only the local notebook', t => {
  const { worktree } = fixture(t);
  const first = start(worktree, 'godev worktree-local-notebook: on');
  assert.equal(first.status, 0, first.stderr);
  const second = start(worktree, 'godev');
  assert.equal(second.status, 0, second.stderr);
  assert.equal(JSON.parse(second.stdout).notebook, notebook);
  const write = command(worktree, 'notebook-write.js', ['append-input', '--notebook', notebook, '--host', 'codex', '--input-stdin'], 'writer follow-up');
  assert.equal(write.status, 0, write.stderr);
  const capture = command(worktree, 'stop-hook.js', ['--host', 'codex'], JSON.stringify({ cwd: worktree, hook_event_name: 'UserPromptSubmit', session_id: env.AGENTFLOW_SESSION_ID, turn_id: 'two', prompt: 'hook follow-up' }));
  assert.equal(capture.status, 0, capture.stderr);
  assert.match(capture.stdout, /was saved in .agentflow\/devlog.md/u);
  assert.match(fs.readFileSync(path.join(worktree, notebook), 'utf8'), /writer follow-up[\s\S]*hook follow-up/u);
  fs.writeFileSync(path.join(worktree, '.agentflow/other.md'), '# → Ask / A-001\n\n+\n');
  const before = fs.readFileSync(path.join(worktree, '.agentflow/other.md'));
  const wrong = command(worktree, 'notebook-write.js', ['append-input', '--notebook', '.agentflow/other.md', '--host', 'codex', '--input-stdin'], 'wrong notebook');
  assert.notEqual(wrong.status, 0);
  assert.match(wrong.stderr, /canonical stream notebook/u);
  assert.deepEqual(fs.readFileSync(path.join(worktree, '.agentflow/other.md')), before);
  const compact = command(worktree, 'agf.js', ['compact', '--notebook', notebook, '--host', 'codex']);
  assert.equal(compact.status, 0, compact.stderr);
  assert.equal(JSON.parse(compact.stdout).notebook, notebook);
});

test('AC-9: tracked root configuration is never rewritten by activation', t => {
  const { worktree } = fixture(t, { tracked_config: true });
  const before = fs.readFileSync(path.join(worktree, 'ag.json'));
  const result = start(worktree, 'godev worktree-local-notebook: on');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires ag.json.*I-039/u);
  assert.deepEqual(fs.readFileSync(path.join(worktree, 'ag.json')), before);
  assert.equal(fs.existsSync(path.join(worktree, '.agentflow')), false);
});

test('AC-10: existing canonical stream refuses activation and retains ordinary startup', t => {
  const { root } = fixture(t, { tracked_config: true, ignore: '' });
  const created = command(root, 'agf.js', ['new', 'canonical-stream']);
  assert.equal(created.status, 0, created.stderr);
  const worktree = created.stdout.trim();
  const stream_notebook = '.agentflow/features/canonical-stream/canonical-stream.devlog.md';
  const before = fs.readFileSync(path.join(worktree, stream_notebook));
  const config_before = fs.readFileSync(path.join(worktree, 'ag.json'));
  const status_before = git(worktree, ['status', '--porcelain']);
  const result = start(worktree, 'godev worktree-local-notebook: on');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /canonical stream notebook already exists/u);
  assert.deepEqual(fs.readFileSync(path.join(worktree, stream_notebook)), before);
  assert.deepEqual(fs.readFileSync(path.join(worktree, 'ag.json')), config_before);
  assert.equal(git(worktree, ['status', '--porcelain']), status_before);
  const normal = start(worktree, 'godev');
  assert.equal(normal.status, 0, normal.stderr);
  assert.equal(JSON.parse(normal.stdout).notebook, stream_notebook);
});

test('AC-11: main checkout ignores activation requests and preserves root config bytes', t => {
  const { root } = fixture(t);
  const initial = start(root, 'seed task');
  assert.equal(initial.status, 0, initial.stderr);
  git(root, ['add', '.gitignore']); git(root, ['commit', '-qm', 'bootstrap ignore rules']);
  const first = start(root, 'godev');
  assert.equal(first.status, 0, first.stderr);
  const before = fs.readFileSync(path.join(root, 'ag.json'));
  const requested = start(root, 'godev worktree-local-notebook: on');
  assert.equal(requested.status, 0, requested.stderr);
  const ordinary = JSON.parse(first.stdout), output = JSON.parse(requested.stdout);
  assert.equal(output.notebook, ordinary.notebook);
  assert.deepEqual(output.stream_decision, ordinary.stream_decision);
  assert.equal(output.worktree_local, undefined);
  assert.deepEqual(fs.readFileSync(path.join(root, 'ag.json')), before);
});

test('AC-13: settings reject invalid local switch values and preserve valid optional values', () => {
  const config = settings.make_template('codex');
  config.switches['worktree-local-notebook'] = 'maybe';
  const validation = settings.validate_config(config, { active_host: 'codex', check_executables: false });
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some(error => /worktree-local-notebook/u.test(error)));
  config.switches['worktree-local-notebook'] = 'off';
  assert.equal(settings.canonical_config(config).switches['worktree-local-notebook'], 'off');
});

test('INV-5: a plain folder ignores requests and a saved local switch', t => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'agf-local-plain-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const first = start(root, 'godev worktree-local-notebook: true');
  assert.equal(first.status, 0, first.stderr);
  const config_file = path.join(root, 'ag.json');
  const config = JSON.parse(fs.readFileSync(config_file));
  assert.equal(config.switches['worktree-local-notebook'], undefined);
  assert.equal(JSON.parse(first.stdout).worktree_local, undefined);
  config.switches['worktree-local-notebook'] = 'on';
  fs.writeFileSync(config_file, JSON.stringify(config));
  const before = fs.readFileSync(config_file);
  const saved = start(root, 'godev');
  assert.equal(saved.status, 0, saved.stderr);
  assert.equal(JSON.parse(saved.stdout).notebook, notebook);
  assert.equal(JSON.parse(saved.stdout).worktree_local, undefined);
  assert.deepEqual(fs.readFileSync(config_file), before);
  assert.equal(require('./notebook-owner').worktree_local_notebook(root), null);
});

test('INV-5: a saved local switch on the main checkout retains ordinary routing', t => {
  const { root } = fixture(t);
  assert.equal(start(root, 'initial main task').status, 0);
  const config_file = path.join(root, 'ag.json');
  const config = JSON.parse(fs.readFileSync(config_file));
  config.switches['worktree-local-notebook'] = 'on';
  fs.writeFileSync(config_file, JSON.stringify(config));
  const before = fs.readFileSync(config_file);
  const result = start(root, 'godev');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).notebook, notebook);
  assert.equal(JSON.parse(result.stdout).worktree_local, undefined);
  assert.deepEqual(fs.readFileSync(config_file), before);
  assert.equal(require('./notebook-owner').worktree_local_notebook(root), null);
});

test('AC-7: complete local close passes validation and matches excluded main-notebook commit behavior', () => {
  const result = require('./worktree-local-journey').journey({ require_terminal: false, say: () => {} });
  assert.equal(result.validation, 'PASS');
  assert.equal(result.git_status_preserved, true);
});

test('activation preserves existing config values and uses its custom workspace/target', t => {
  const { worktree } = fixture(t, { ignore: '.agentflow/\nlocal-notes/\nag.json\n' });
  const config = settings.make_template('codex');
  config.switches['workspace-dir'] = 'local-notes';
  config.switches['target-doc'] = 'local-notes/current.md';
  config.switches['inline-reply'] = 'maybe'; // Safe runtime fallback must not replace the owner's stored value.
  config.switches.metrics = 'off'; // Loading legacy values must not persist unrelated migration during activation.
  fs.writeFileSync(path.join(worktree, 'ag.json'), JSON.stringify(config));
  const result = start(worktree, 'godev worktree-local-notebook: true');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).notebook, 'local-notes/current.md');
  const saved = JSON.parse(fs.readFileSync(path.join(worktree, 'ag.json')));
  assert.deepEqual(saved, { ...config, switches: { ...config.switches, 'worktree-local-notebook': 'on' } });
  assert.equal(JSON.parse(result.stdout).worktree_local.created_config, false);
  assert.equal(git(worktree, ['status', '--porcelain']), '');
});

test('local mode rechecks tracked/ignored safety on every later startup and writer', t => {
  const { root, worktree } = fixture(t);
  assert.equal(start(worktree, 'godev worktree-local-notebook: on').status, 0);
  const file = path.join(worktree, notebook), before = fs.readFileSync(file);
  fs.writeFileSync(path.join(root, '.git/info/exclude'), 'ag.json\n');
  const result = start(worktree, 'godev');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires .agentflow\/devlog.md.*I-039/u);
  const write = command(worktree, 'notebook-write.js', ['append-input', '--notebook', notebook, '--host', 'codex', '--input-stdin'], 'unsafe write');
  assert.notEqual(write.status, 0);
  assert.match(write.stderr, /I-039/u);
  assert.deepEqual(fs.readFileSync(file), before);
});

test('workspace features target is rejected before bootstrap writes either file', t => {
  const { worktree } = fixture(t);
  const config = settings.make_template('codex');
  config.switches['target-doc'] = '.agentflow/features/private.md';
  fs.writeFileSync(path.join(worktree, 'ag.json'), JSON.stringify(config));
  const before = fs.readFileSync(path.join(worktree, 'ag.json'));
  const result = start(worktree, 'godev worktree-local-notebook: on');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /workspace features directory/u);
  assert.deepEqual(fs.readFileSync(path.join(worktree, 'ag.json')), before);
  assert.equal(fs.existsSync(path.join(worktree, '.agentflow')), false);
});

test('AC-8: unsafe notebook ignore policy rejects bootstrap before any files are created', t => {
  const { worktree } = fixture(t, { ignore: 'ag.json\n' });
  const result = start(worktree, 'godev worktree-local-notebook: on');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /worktree-local-notebook requires .agentflow\/devlog.md.*I-039/u);
  assert.equal(fs.existsSync(path.join(worktree, 'ag.json')), false);
  assert.equal(fs.existsSync(path.join(worktree, '.agentflow')), false);
});
