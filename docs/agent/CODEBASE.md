# Codebase overview

## Purpose

Agentflow is an **AI-agent skill** (prompt instructions + zero-dependency Node.js helper scripts) that gives a coding assistant a persistent, file-based "project notebook" (the devlog). The notebook records each owner request (Ask), progress (RUN/WIP), and the final answer (Reply), so a later session can resume work. Around that core it adds optional machinery: feature-branch worktrees ("streams"), worker delegation, independent review, a multi-stage "AG" pipeline, and a sequential plan runner ("looper").

Users: a human "owner" talking to a host agent (verified: Codex CLI and Claude Code; generic hookless hosts supported manually). The scripts are invoked by the host agent, by host hooks, or by the owner through the `agf` / `agf-looper` shell shortcuts.

This repository is the **public release mirror** (current version 8.4.4). Commits are titled `release: agentflow @ <private-sha>`; development happens in a separate private checkout (inferred from commit titles and `SKILL.md` release guidance).

## Major use cases

- Start or resume a task with `godev` → `agf.js start`.
- Per-Ask route controls: `fast-lane`, `skip-ag` (skip only the development pipeline/advisors), `no-ag`.
- Capture every owner message into the current Ask (hook or manual).
- Close a round: validate, write Reply + STATUS, commit, optionally push → `agf close`.
- Referee a finished turn via host Stop hook → `stop-hook.js`.
- Open / deliver / clean up feature streams → `agf new|finish|cleanup|ditch`.
- Delegate work to external CLIs (`codex exec`, `claude -p`) in isolated clones.
- Run a frozen queue of `plan-NNN.md` files → `agf-looper` (`looper.js`).
- Inspect or change project settings in `ag.json` → `agf settings`.

## Technology stack

- Node.js ≥ 18, CommonJS, **no npm dependencies** (no `package.json`). Only `node:` built-ins.
- Tests: built-in `node:test` + `node:assert`.
- Git CLI via `child_process.spawnSync` (optional for plain notebook use).
- Markdown for all model-facing instructions and the notebook format.
- Two small Python journey scripts (`reply-identity-journey.py`, `skills-audit-journey.py`) and Expect-based PTY journeys for terminal checks.

## Repository layout

```text
.claude-plugin/          Claude Code plugin + marketplace manifests (version field)
CHANGELOG.md             Release history at repo root since 8.4.3 (`release.test.js` reads it)
docs/agent/              This knowledge base
README.md, README.zh-tw.md  Install/usage (tests assert content)
copy_skills.sh           Local maintainer helper: copies skill to ~/.agents/skills (not part of product)
skills/agentflow/
  SKILL.md               Always-loaded model instructions (version in frontmatter + heading)
  references/            Trigger-loaded rulebooks (closeout, progress, writing, streams, ag, delegation, looper, fast-lane, skip-ag, skill-conflicts)
  references/advisors/   Pipeline advisor role prompts (requirements, codewalk, explore, spike, spec, security-scan, acceptance, learn)
  docs/                  Owner guides (EN/zh-TW), incidents-log.md, skill-editing guide
  scripts/               All executable logic + colocated *.test.js
  scripts/fixtures/      Test fixtures (fake external worker, notebook owner helpers, temp dirs)
```

Ignored/runtime (not tracked): `.agentflow/` (notebook, `.tmp/` receipts, ownership, completion records), `.worktrees/`, `.codex/`, `.claude/` host settings.

## Entry points

| Entry | File | Invoked by |
| --- | --- | --- |
| `agf <subcommand>` | `skills/agentflow/scripts/agf.js:main` (dispatch table `COMMANDS`) | Host agent, owner shell shortcut |
| Stop / UserPromptSubmit hook | `skills/agentflow/scripts/stop-hook.js:main` | Codex / Claude hook config |
| `agf-looper` | `skills/agentflow/scripts/looper.js:main` | Owner / host (`run-looper`, `run-plans`) |
| Notebook writer CLI (internal) | `skills/agentflow/scripts/notebook-write.js:run` | Host for `append-input`, `append-run`, `append-wip`, `append-reply`, `close-round` |
| Pre-commit guard | `skills/agentflow/scripts/devlog-guard.js:main` | Git `pre-commit` hook |
| Setup / shortcuts | `skills/agentflow/scripts/setup.js:main` | `agf setup [--fix]` or direct node |
| Settings CLI | `skills/agentflow/scripts/ag-settings.js` (also via `agf settings`) | Host / owner |
| Delegation CLI | `skills/agentflow/scripts/delegation-route.js:main` | Host when dispatching workers |
| Manual preflight | `skills/agentflow/scripts/terminal-preflight.js:run`, `round-linter.js` | Recovery closeouts |

## Commands

There is no build step.

```sh
# Unit/integration tests (from skills/agentflow/scripts)
cd skills/agentflow/scripts && node --test *.test.js

# Single file
node --test skills/agentflow/scripts/notebook-write.test.js

# CLI help
node skills/agentflow/scripts/agf.js --help
```

Opt-in / special checks (see `skills/agentflow/scripts/README.md`):
- `*-journey.js` scripts: real PTY/terminal journeys (some need Expect/macOS; `codex-live-journey.js` and `claude-live-journey.js` make paid model calls).
- `looper-live-gate.js --report <path>`: mandatory final gate for any looper behavior change (real provider calls).

Platform notes: Unix-only tests skip on native Windows; the looper is not supported on native Windows (per README and CHANGELOG 8.3.4). CHANGELOG 8.3.4 and 8.4.0 record two known pre-existing failing assertions in `prompt-compression.test.js`; at v8.4.4 only the 32 KiB budget assertion was observed failing (see [DECISIONS.md](DECISIONS.md) "Open / uncertain") — do not assume a fully green suite.

Host environment leakage: running tests from inside a Claude Code or Codex session leaks runtime markers listed in `ag-settings.js:host_markers` (e.g. `CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_SSE_PORT`, `CODEX_THREAD_ID`). Fixtures that set the other host then fail with `AG_HOST_AMBIGUOUS` ("active host is ambiguous"). Unset those variables before running the suite. On native Windows without symlink privilege, symlink-based tests (e.g. in `completion-record.test.js`) fail with `EPERM`.

## Configuration

- `ag.json` (project root, or adjacent to a stream notebook): schema version 8. Root keys `schema-version`, `switches`, `pipeline-roles`, `external-workers`. Owned by `skills/agentflow/scripts/ag-settings.js` (`validate_config`, `load_config`, `migrate_config`, `change_configuration`, `host_template_values`).
- Important switches: `target-doc` (notebook path, default `.agentflow/devlog.md`), `workspace-dir` (default `.agentflow`), `allowed-worker`, `review-policy`, `allow-ag`, `streams`, `lang`, `log-verbosity`, `inline-reply`, `notebook-ownership` (default `off`), `git-timeout-ms`.
- Environment variables (read, not required): `AGF_GIT_TIMEOUT_MS`, `CODEX_THREAD_ID`/`CODEX_SESSION_ID`, `CLAUDE_CODE_SESSION_ID`/`CLAUDE_SESSION_ID`, `CLAUDE_PROJECT_DIR`, `AGENTFLOW_SESSION_ID`, `AGENTFLOW_EXTERNAL_DELEGATE`, `CODEX_HOME`, `CLAUDE_CONFIG_DIR`, `AGF_OPEN`.
- Version must stay aligned in `SKILL.md` (frontmatter + heading), `.claude-plugin/plugin.json`, `README*.md` heading, and root `CHANGELOG.md`.

## Testing structure

- Colocated `scripts/<module>.test.js` per module (largest: `round-linter.test.js`, `agf.test.js`, `looper.test.js`, `ag-settings.test.js`).
- **Contract tests over Markdown**: `alignment.test.js`, `prompt-compression.test.js`, `language-contract.test.js`, `release.test.js` (and others) assert wording/size in `SKILL.md`, `references/*.md`, guides, README, CHANGELOG. Editing prose there can break tests (e.g. `SKILL.md` has a 32 KiB budget test).
- Journey tests (`*-journey.test.js`, `start-journey.test.js`, `transport-journey.test.js`) exercise end-to-end flows in temp repos.

## Major domain concepts

Notebook/devlog, Ask/RUN/WIP/Reply rounds, STATUS projection, ownership (host + session), stream (branch + worktree + stream notebook), worker kinds (external/internal/host), tiers (best/better/basic/cheap), review records, fast-lane, AG pipeline and advisors, frozen queue and looper, incidents (`I-NNN`). See [GLOSSARY.md](GLOSSARY.md).
