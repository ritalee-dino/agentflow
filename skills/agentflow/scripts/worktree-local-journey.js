'use strict';

// Run this script in a real terminal. Each owner message is piped to start,
// which deliberately rejects terminal stdin; no terminal package is needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const settings = require('./ag-settings');
const { format_local_timestamp } = require('./local-time');
const notebook = '.agentflow/devlog.md';
const session = 'worktree-local-journey';
const environment = () => ({ ...process.env, CODEX_THREAD_ID: session, CODEX_SESSION_ID: '', CLAUDE_CODE_SESSION_ID: '', CLAUDE_SESSION_ID: '', CLAUDE_PROJECT_DIR: '', AGENTFLOW_SESSION_ID: session, AGENTFLOW_EXTERNAL_DELEGATE: '' });
const command = (root, script, args, input) => spawnSync(process.execPath, [path.join(__dirname, script), ...args], { cwd: root, env: environment(), input, encoding: 'utf8' });
const git = (root, args) => { const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
const start = (root, message) => command(root, 'agf.js', ['start', '--repo', root, '--host', 'codex', '--message-stdin', '--json'], message);
const manifest = root => ({
  version: 1, notebook, ask: 'A-001',
  run_events: [`## [RUN-001] Event — ${format_local_timestamp(new Date(Date.now() - 120000))} (during round A-001)\n\n- Local notebook capture and routing checked.\n`],
  reply: '# ← Reply / A-001\n\n## [SUMMARY]\n\n- Local notebook routing works.\n\n## [FINAL REPORT]\n\n- Startup, second input, progress and compaction use this worktree notebook.\n\n```completion-metadata\nHost review: PASS — checked the local notebook and Git status.\n```\n\n## Questions (batched — each with a suggested default)\n\n- None.\n',
  status: { project: path.basename(root), notebook, notebook_kind: 'root', current_commit: git(root, ['rev-parse', 'HEAD']), tests_scenarios: 'worktree-local terminal journey', config_path: 'ag.json', host: 'codex', validation: 'validated', proven: 'local worktree notebook routing checked', open: 'none', next: 'await input', artifacts: 'none', archived_eras: 'none', streams: [] },
  allowed_paths: [notebook], commit_message: 'record local notebook journey', delivery: { mode: 'local' },
});

const close = root => {
  const result = command(root, 'agf.js', ['close', '--manifest-stdin'], JSON.stringify(manifest(root)));
  const output = JSON.parse(result.stdout);
  assert.equal(output.validation?.ok, true, result.stdout + result.stderr);
  assert.equal(output.phase, 'notebook_replaced', result.stdout);
  assert.match(fs.readFileSync(path.join(root, notebook), 'utf8'), /# ← Reply \/ A-001[\s\S]*# → Ask \/ A-002/u);
  return { result, output };
};

const journey = ({ require_terminal = true, say = console.log } = {}) => {
  if (require_terminal) {
    assert.equal(process.stdin.isTTY, true, 'journey requires terminal stdin');
    assert.equal(process.stdout.isTTY, true, 'journey requires terminal stdout');
    assert.equal(process.stderr.isTTY, true, 'journey requires terminal stderr');
    say(`terminal: ${process.platform}; stdin/stdout/stderr are TTY`);
  }
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'agf-local-journey-')));
  const root = path.join(directory, 'main'), worktree = path.join(directory, 'linked');
  try {
    fs.mkdirSync(root);
    git(root, ['init', '-q', '-b', 'main']);
    git(root, ['config', 'user.name', 'Notebook Journey']);
    git(root, ['config', 'user.email', 'notebook-journey@example.invalid']);
    fs.writeFileSync(path.join(root, 'baseline.txt'), 'baseline\n');
    git(root, ['add', '.']); git(root, ['commit', '-qm', 'baseline']);
    fs.appendFileSync(path.join(root, '.git/info/exclude'), '\n.agentflow/\nag.json\n');
    git(root, ['worktree', 'add', '-q', '-b', 'local-journey', worktree]);
    const before = git(worktree, ['status', '--porcelain']);
    const message = 'godev worktree-local-notebook: on';
    say(`owner: ${message}`);
    const first = start(worktree, message);
    assert.equal(first.status, 0, first.stderr);
    const output = JSON.parse(first.stdout);
    assert.equal(output.notebook, notebook);
    assert.equal(output.worktree_local.enabled, true);
    assert.equal(git(worktree, ['status', '--porcelain']), before);
    say(`startup: ${output.notebook}; enabled=true; Git status preserved`);
    say('owner: please capture the second message');
    const capture = command(worktree, 'stop-hook.js', ['--host', 'codex'], JSON.stringify({ cwd: worktree, hook_event_name: 'UserPromptSubmit', session_id: session, turn_id: 'second', prompt: 'please capture the second message' }));
    assert.equal(capture.status, 0, capture.stderr);
    assert.match(capture.stdout, /was saved/u);
    assert.match(fs.readFileSync(path.join(worktree, notebook), 'utf8'), /please capture the second message/u);
    const second = start(worktree, 'godev');
    assert.equal(second.status, 0, second.stderr);
    assert.equal(JSON.parse(second.stdout).notebook, notebook);
    const progress = command(worktree, 'notebook-write.js', ['append-wip', '--notebook', notebook, '--host', 'codex', '--ask', 'A-001', '--input-stdin'], `## [WIP-001] Checkpoint — ${format_local_timestamp()} (during round A-001)\n\n- Local notebook routing checked.\n`);
    assert.equal(progress.status, 0, progress.stderr);
    const compact = command(worktree, 'agf.js', ['compact', '--notebook', notebook, '--host', 'codex']);
    assert.equal(compact.status, 0, compact.stderr);
    const local_close = close(worktree);
    say(`close: validation PASS; Reply saved; commit ${local_close.output.error.code}`);
    // The existing commit behavior for an ignored notebook must be identical
    // in the main checkout. Committing excluded files is outside this feature.
    settings.initialize_project({ repo_root: root, active_host: 'codex' });
    require('./agf').update_ignore_file(root);
    git(root, ['add', '.gitignore']); git(root, ['commit', '-qm', 'main startup ignore rules']);
    const main_start = start(root, 'main comparison task');
    assert.equal(main_start.status, 0, main_start.stderr);
    const main_close = close(root);
    assert.equal(local_close.result.status, main_close.result.status);
    assert.equal(local_close.output.error.code, main_close.output.error.code);
    assert.equal(local_close.output.commit.state, main_close.output.commit.state);
    assert.equal(git(worktree, ['status', '--porcelain']), before);
    say('PASS: start → second message → progress → compact → close; excluded notebook commit matches main checkout');
    return { notebook, validation: 'PASS', commit_error: local_close.output.error.code, git_status_preserved: true };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
};

module.exports = { journey, manifest, close };
if (require.main === module) {
  try { journey(); } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
