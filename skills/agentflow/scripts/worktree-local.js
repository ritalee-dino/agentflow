'use strict';

const fs = require('node:fs');
const path = require('node:path');
const settings = require('./ag-settings');
const owner = require('./notebook-owner');

const parse_worktree_local_request = (message = '') => {
  let fence = null;
  for (const raw of message.split(/\r?\n/u)) {
    const line = raw.trim().replace(/^\+ ?/u, '').trim();
    const marker = /^(`{3,}|~{3,})(.*)$/u.exec(line);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      continue;
    }
    if (marker) { fence = marker[1]; continue; }
    if (/^(?:\/?godev[ \t]+)?worktree-local-notebook[ \t]*:[ \t]*(?:on|true)$/iu.test(line)) return true;
  }
  return false;
};

// Prepare and validate the entire pair before startup writes either path.
const prepare_request = ({ root, message, branch, host, host_family }) => {
  if (!owner.linked_worktree(root) || !parse_worktree_local_request(message)) return null;
  if (require('./agf').stream_doc(root, branch)) throw Error('worktree-local-notebook cannot be enabled when a canonical stream notebook already exists; continue with the existing stream notebook');
  const file = owner.safe_path(root, 'ag.json');
  const exists = fs.existsSync(file);
  if (exists) settings.load_config(file, { repo_root: root, active_host: host, persist_migration: false, ...(host_family ? { host_family } : {}) });
  const config = exists ? JSON.parse(require('./notebook-write').read_regular_file(file, 'configuration').text) : settings.make_template(host);
  if (!exists) config.switches.lang = settings.detect_initial_language();
  config.switches['worktree-local-notebook'] = 'on';
  const notebook = owner.worktree_local_paths(root, config);
  return { config, notebook, created_config: !exists };
};

const initialize = ({ root, request, host }) => {
  // Same status and first-Ask format as initialize_project, with an existing
  // ignored configuration retained rather than replaced by the template.
  const file = owner.safe_path(root, request.notebook);
  if (!fs.existsSync(file)) {
    const status = settings.format_status({
      project: path.basename(root), notebook: request.notebook, notebook_kind: 'root',
      current_commit: 'none yet; the first Agentflow closeout will create it',
      tests_scenarios: 'none', config_path: 'ag.json', host, validation: 'validated',
      proven: 'the host template was initialized', open: 'none', next: 'await the first request',
      artifacts: 'none', archived_eras: 'none', streams: [],
    });
    owner.safe_path(root, request.notebook, true);
    settings.write_text_atomic(file, `${status}\n---\n\n${settings.format_ask_heading('A-001', { config: request.config, repo_root: root })}\n\n+ \n`);
  }
  // Do not canonicalize an existing configuration: activation changes only
  // this switch and preserves all other stored values.
  settings.write_text_atomic(path.join(root, 'ag.json'), `${JSON.stringify(request.config, null, 2)}\n`);
};

module.exports = { parse_worktree_local_request, prepare_request, initialize };
