# Codebase overview

## Purpose

Agentflow 9 (skill/plugin/package name `agentflow`, version `9.0.0`; the 9.0.0-beta.1 prerelease was named aglite) is an **AI-agent skill**: a set of Markdown instructions that a coding assistant (Claude Code, Codex, Copilot, other hosts that support skills) loads to keep development work resumable. It gives a project a persistent "notebook" (devlog) where owner requests, decisions, answers and recovery pointers are saved, plus proportionate planning, review routing, Git delivery and isolated feature worktrees.

A small optional Node.js runtime (the **looper**, CLI `agf`) executes a prepared queue of task groups in parallel Git worktrees, each task in a fresh agent session, and serially integrates results.

Users: a human "owner" talking to a coding assistant ("host"). The host is the actual executor of almost all behavior; the repository mostly contains instructions for it.

## Major use cases

- Start/resume work with `godev` (records saved in `<ag-dir>/<notebook-name>`).
- Task modes: `fast-lane`, `skip-review`, `grill-me`, `3ways`, `advisors:`, `browfield`.
- Stage later batches with `append-rounds` / `append-tasks`.
- Feature worktrees: `new-feature`, `merge-feature`, `drop-feature`.
- Grouped parallel execution: `prepare-tasks`, `run-tasks`, `handle-tasks` → `agf loop run|status`.
- Configuration migration from older Agentflow 8 / earlier agentflow schemas (9–12, `aglite-5`) to schema 13.

## Technology stack

- Markdown prompt files (the main "code").
- Node.js ≥ 20 (`skills/agentflow/package.json` `engines`), CommonJS, **zero npm dependencies**; only `node:` built-ins.
- Tests: built-in `node:test` runner.
- Git (worktrees, merge, plumbing) is required for features and the looper.
- External agent CLIs launched by the looper: `codex`, `claude`, `copilot`.
- Distribution: Claude Code plugin manifest (`.claude-plugin/`) and Vercel Skills CLI (`npx skills add agfnow/agentflow --skill agentflow`). Agentflow 8 stays at `agfnow/agentflow-v8`.

## Repository layout

```
.claude-plugin/          plugin.json, marketplace.json (Claude Code plugin metadata; version must match)
README.md, README.zh-tw.md   public install/usage guide (EN / zh-TW)
CHANGELOG.md             release notes
skills/agentflow/           the shipped skill
  SKILL.md               entrypoint prompt: routing order + which reference to load
  references/            demand-loaded procedures (machine-facing prompts)
    advisors/            optional advisor prompts (requirements, codewalk, explore, spike, spec,
                         security-scan, acceptance, final-audit, learn, product-docs)
  assets/.agentflow/     templates: ag.json, devlog.md, backlog.md, sys-invariants.md, .gitkeep dirs
  assets/looper-groups.example.json   queue.json schema 2 example
  docs/                  human guides: AG-GUIDE.md, AG-GUIDE.tw.md, CHEATSHEET.md, CHEATSHEET.tw.md,
                         agv8-aglite-comparison.md (Agentflow 8 → 9 differences)
  package.json           @agfnow/agentflow, bin agf, test script
  scripts/               Node looper runtime + tests
docs/agent/              this knowledge base (not shipped as part of the skill)
```

## Important directories and files

| Path | Role |
| --- | --- |
| `skills/agentflow/SKILL.md` | Entry prompt. "Route before records" ordering and "Load only the applicable procedure" map. |
| `skills/agentflow/references/configuration.md` | `ag.json` discovery, validation, switches, release check. |
| `skills/agentflow/references/session.md` | Notebook claim (ownership), recovery, owner-input capture, round evidence. |
| `skills/agentflow/references/delivery.md` | STATUS/Ask/Reply format, receipt, archive, Git delivery, notebook rename. |
| `skills/agentflow/references/work.md` | Task modes, execution, RUN/WIP checkpoints, diff handling. |
| `skills/agentflow/references/planning.md` | Design/tracker criteria, `plan-mode`, gates. |
| `skills/agentflow/references/review.md` | Worker settings, bounded assignment, planning routes, result review, `3ways`. |
| `skills/agentflow/references/features.md` | `new-feature`/`merge-feature`/`drop-feature`. |
| `skills/agentflow/references/looper.md` | Looper contract (owns execution behavior). |
| `skills/agentflow/scripts/looper.js` | Coordinator: `run`, `status`, queue validation, settings selection. |
| `skills/agentflow/scripts/looper-agent.js` | Process launching, CLI argument building, result parsing, checks. |
| `skills/agentflow/scripts/looper-state.js` | Safe paths, atomic JSON, claims, process identity. |
| `skills/agentflow/scripts/looper-integration.js` | Git operations: group worktrees, task commits, integration, landing. |
| `skills/agentflow/scripts/agf.js` | CLI entry `agf loop run|status`. |

## Entry points

- **Prompt entry**: `skills/agentflow/SKILL.md` (frontmatter `name: agentflow`, trigger words in `description`). Hosts load it on trigger words like `godev`.
- **CLI entry**: `skills/agentflow/scripts/agf.js` → `looper.js:run` / `looper.js:status`. Registered as `agf` via `npm install -g <resolved-skill>`.
- **Library exports**: `looper.js` exports `run, status, load, validate, task_text, ordinary_closeout, read_settings, select, counterpart` (used by tests).

## Commands

Run from `skills/agentflow/`:

```sh
npm test                      # node --test scripts/looper.test.js scripts/looper-copilot.test.js
node scripts/agf.js loop status <run-root>
node scripts/agf.js loop run <run-root>
```

There is no build step, linter config or CI configuration in this repository.

Tests create real temporary Git repositories and spawn processes; many have 30 s timeouts. One POSIX-only test is skipped on Windows; symlink tests also skip (via `symlink_or_skip`) when Windows symlink privilege is unavailable.

## Configuration

- Consumer-project config: `<checkout>/<ag-dir>/ag.json`, schema 13 (the target schema is whatever `schema-version` the bundled template holds; `looper.js` reads it as `current_schema`). Template: `skills/agentflow/assets/.agentflow/ag.json`. Keys: `switches` (on/off switches, `plan-mode`, `plan-order`, `review-order`, `use-lang`, `ag-dir`, `notebook-name`), `pipeline-roles`, `model-family`, `external-workers`, optional `native-workers`, `looper-routes`, `looper-limits`, `next_update_date`. `switches.saving-mode` (`on|off`) is required since schema 13: hosts add `off` only when absent; the looper refuses missing/invalid values.
- Defaults are defined in prose in `references/configuration.md#discovery-and-validation`. Note: the template sets `omit-wip: off` while the documented default when the key is absent is `on` (the cheatsheet states both).
- Looper queue: `<run-root>/queue.json`, schema 2 (`references/looper.md#schema-and-inputs`).
- Environment variables read by code: `CODEX_SANDBOX_NETWORK_DISABLED` (`looper-agent.js:launch_agent`), `SystemRoot`/`WINDIR` (`looper-state.js:powershell`), `PATH`/`PATHEXT` (`looper-agent.js:resolve_command`), Copilot credential/provider variables allow-listed in `looper-agent.js:copilot_environment`.

## Testing structure

- `skills/agentflow/scripts/looper.test.js` — coordinator, Git integration, recovery, settings, Windows path/process handling.
- `skills/agentflow/scripts/looper-copilot.test.js` — CLI argument construction and Copilot/Claude result parsing.
- Prompt behavior (SKILL.md/references) has **no automated tests** in this repo.

### Known Windows test failures (9.0.0)

Observed on native Windows (2026-10-27: 102 tests, 95 pass, 3 fail, 4 skipped). Both causes are test-side; the runtime behaves as designed. CHANGELOG 9.0.0 states release evidence covers macOS only, with native Windows a separately stated limit.

| Test in `looper.test.js` | Cause |
| --- | --- |
| `invalid request files fail before claims or worktrees` → subtest `inline` (fails the parent too) | The inline request text ends with `.`; on Windows `looper-state.js:inspect_path` (`windows_component`) rejects trailing-dot components with `Unsafe Windows path component` before the stat that would yield the expected `ENOENT`. |
| `process enumeration failure makes execution unsettled and preserves recorded process evidence` | Race: the child lives 150 ms, but on Windows `looper-state.js:process_identity` spawns PowerShell (`Get-CimInstance Win32_Process`), measured at ~440–1190 ms, so the child has exited and `started_at` is `null`. Real agent CLIs outlive the query. |

Do not treat these as regressions when they appear on Windows. Fixes belong in the tests (upstream, see [DECISIONS.md](DECISIONS.md) D20).

## Release shape

Commits are titled `release: aglite @ <sha>` (up to 9.0.0-beta.1) and `release: agentflow @ <sha>` (9.0.0 onward), and CHANGELOG 0.3.0 says the project lives in "a separate private source repository". This repo appears to be a published release mirror (inferred). Version strings appear in `.claude-plugin/plugin.json`, `skills/agentflow/package.json`, `SKILL.md` metadata, README title and CHANGELOG.

The 9.0.0 rename did not change looper runtime identifiers: worktrees/branches `aglite-*`, the `.aglite-records/` task-notebook directory, the `aglite-target-*.owner` claim and the `aglite runner` commit author remain (CHANGELOG 9.0.0: the looper "retains its bounded runtime and stored identifiers").

## Major domain concepts

Owner, host, notebook/devlog, Ask/Reply round, STATUS, claim (`.owner` marker), ag-dir, tracker/design, round evidence, system invariants, backlog, task modes, advisors, feature worktree, looper queue/group/task/attempt, integration lane. See [GLOSSARY.md](GLOSSARY.md).
