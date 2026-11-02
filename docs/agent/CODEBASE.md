# Codebase overview

## Purpose

Agentflow 9 (skill/plugin/package name `agentflow`, version `9.1.4`; the 9.0.0-beta.1 prerelease was named aglite) is an **AI-agent skill**: a set of Markdown instructions that a coding assistant (Claude Code, Codex, Copilot, other hosts that support skills) loads to keep development work resumable. It gives a project a persistent "notebook" (devlog) where owner requests, decisions, answers and recovery pointers are saved, plus proportionate planning, review routing, Git delivery and isolated feature worktrees.

A small optional Node.js runtime behind one CLI, `agf`, has three bounded parts: the **looper** (`agf looper …`) executes a prepared queue of task groups in parallel Git worktrees, each task in a fresh agent session, and serially integrates results; the **terminal feature CLI** (`agf new-feature|merge-feature|drop-feature`, added in 9.1.0) runs the feature-worktree lifecycle from a shell; the **standalone initializer** (`agf init`, added in 9.1.2) creates Git plus the Agentflow scaffold in a fresh root without model calls.

Users: a human "owner" talking to a coding assistant ("host"). The host is the actual executor of almost all behavior; the repository mostly contains instructions for it.

## Major use cases

- Start/resume work with `godev` (records saved in `<ag-dir>/<notebook-name>`); fresh Git roots can also be initialized from a shell with `agf init [--lang <locale>]`.
- Task modes: `fast-lane`, `skip-review`, `grill-me`, `3ways`, `advisors:`, `browfield`; read-only plan review with `simple-check [target]` (9.1.2); offline HTML visual lesson with `eli5: <topic-or-command>` (9.1.4, explains without executing).
- Stage later batches with `append-rounds` / `append-tasks`.
- Feature worktrees: `new-feature`, `merge-feature`, `drop-feature` (host chat commands), or the terminal equivalents `agf new-feature|merge-feature|drop-feature` (aliases `newft`/`mergeft`/`dropft`).
- Grouped parallel execution: `prepare-tasks`, `run-tasks`, `handle-tasks` → `agf looper run|status`; explicit post-run cleanup via `agf looper cleanup` or `run --cleanup`.
- Configuration migration from older Agentflow 8 / earlier agentflow schemas (9–12, `aglite-5`) to schema 13.

## Technology stack

- Markdown prompt files (the main "code").
- Node.js ≥ 20 (`skills/agentflow/package.json` `engines`), CommonJS, **zero npm dependencies**; only `node:` built-ins.
- Tests: built-in `node:test` runner.
- Git (worktrees, merge, plumbing) is required for features and the looper; the feature CLI merge needs Git ≥ 2.38 (`merge-tree --write-tree`).
- External agent CLIs launched by the looper: `codex`, `claude`, `copilot`. The feature CLI launches `codex exec` only to resolve actual merge conflicts (`scripts/feature-merge.js:merge`).
- Recoverable deletion: macOS `/usr/bin/trash` + `~/.Trash` (looper cleanup, feature CLI cleanup/claim disposal); Windows feature cleanup deletes directly; Linux is refused.
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
                         agv8-agv9-comparison.md (Agentflow 8 → 9 differences)
  package.json           @agfnow/agentflow, bin agf, test script
  scripts/               Node runtime (looper + feature CLI + initializer) + tests
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
| `skills/agentflow/references/simple-check.md` | `simple-check` command and the canonical adequacy/scope/minimality `#check` reused by planning and review. |
| `skills/agentflow/references/features.md` | `new-feature`/`merge-feature`/`drop-feature`; `#terminal-cli` owns the `agf` feature commands. |
| `skills/agentflow/references/looper.md` | Looper contract (owns execution behavior). |
| `skills/agentflow/scripts/looper.js` | Coordinator: `run`, `status`, queue validation, settings selection. |
| `skills/agentflow/scripts/looper-agent.js` | Process launching, CLI argument building, result parsing, checks. |
| `skills/agentflow/scripts/looper-state.js` | Safe paths, atomic JSON, claims, process identity. |
| `skills/agentflow/scripts/looper-integration.js` | Git operations: group worktrees, task commits, integration, landing. |
| `skills/agentflow/scripts/looper-cleanup.js` | Explicit completed-run cleanup (Trash, compaction to queue/request/plans). |
| `skills/agentflow/scripts/looper-report.js` | Progress lines, heartbeat, terminal summary, `results.md` / `evidence/run-*.txt` reports, en/zh-TW dictionary. |
| `skills/agentflow/scripts/feature.js` | Feature CLI `create` (new-feature) and `drop`. |
| `skills/agentflow/scripts/feature-merge.js` | Feature CLI `merge` (scoped merge, checks, conflict resolver, retirement, delivery). |
| `skills/agentflow/scripts/feature-common.js` | Shared feature CLI helpers: context/identity, config discovery, claims, Trash, `retire`. |
| `skills/agentflow/scripts/feature-shell.js` | `agf shell` function generator and the `AGF_CD_FILE` destination channel. |
| `skills/agentflow/scripts/init.js` | Standalone initializer `agf init` (`initialize`, `locale`). |
| `skills/agentflow/scripts/agf.js` | CLI entry: `agf init`, `agf looper run|status|cleanup`, feature commands, `agf shell`. |

## Entry points

- **Prompt entry**: `skills/agentflow/SKILL.md` (frontmatter `name: agentflow`, trigger words in `description`). Hosts load it on trigger words like `godev`.
- **CLI entry**: `skills/agentflow/scripts/agf.js:main` → `init.js:initialize`, `looper.js:run` / `status`, `looper-cleanup.js:cleanup`, `feature.js:create` / `drop`, `feature-merge.js:merge`, `feature-shell.js:binding`. Made callable as `agf` either by the shell function that first-time setup generates (`references/setup.md#agf-command-setup`, from `agf shell <zsh|bash|powershell>`) or by `npm install -g <resolved-skill>`.
- **Library exports**: `looper.js` exports `run, status, load, validate, task_text, ordinary_closeout, read_settings, select`; `agf.js` exports `main(args, io)` with injectable IO for tests.

## Commands

Run from `skills/agentflow/`:

```sh
npm test                      # node --test over all 9 scripts/*.test.js files (list in package.json)
node scripts/agf.js init [--lang <locale>]
node scripts/agf.js looper status <run-root>
node scripts/agf.js looper run <run-root> [--cleanup]
node scripts/agf.js looper cleanup <run-root>
node scripts/agf.js new-feature <name> [--open]
node scripts/agf.js merge-feature [name] [--cleanup] [--include <path>] [--check '["cmd","arg"]']
node scripts/agf.js drop-feature [name] [--abandon]
node scripts/agf.js shell <zsh|bash|powershell>
```

There is no build step, linter config or CI configuration in this repository.

Tests create real temporary Git repositories and spawn processes; many have 30 s timeouts. On Windows, POSIX- and macOS-only tests skip, and tests using `symlink_or_skip` skip without symlink privilege; other symlink tests fail instead (see below). A full Windows run takes about 27 minutes.

## Configuration

- Consumer-project config: `<checkout>/<ag-dir>/ag.json`, schema 13 (the target schema is whatever `schema-version` the bundled template holds; `looper.js` reads it as `current_schema`). Template: `skills/agentflow/assets/.agentflow/ag.json`. Keys: `switches` (on/off switches, `plan-mode`, `plan-order`, `review-order`, `use-lang`, `ag-dir`, `notebook-name`), `pipeline-roles`, `model-family`, `external-workers`, optional `native-workers`, `looper-routes`, `looper-limits`, `next_update_date`, optional top-level `default-editor` (default `vscode` → runs `code`; used by `agf new-feature --open`). `switches.saving-mode` (`on|off`) is required since schema 13: hosts add `off` only when absent; the looper refuses missing/invalid values.
- Defaults are defined in prose in `references/configuration.md#discovery-and-validation`. Note: the template sets `omit-wip: off` while the documented default when the key is absent is `on` (the cheatsheet states both).
- The bundled template's `looper-routes` now sets `task`/`repair`/`acceptance` to Codex CLI (`openai` catalog); new configurations replace these with detected defaults (`references/setup.md#detected-worker-defaults`), existing configs keep theirs.
- Looper queue: `<run-root>/queue.json`, schema 2 (`references/looper.md#schema-and-inputs`).
- Environment variables read by code: `CODEX_SANDBOX_NETWORK_DISABLED` (`looper-agent.js:launch_agent`), `SystemRoot`/`WINDIR` (`looper-state.js:powershell`), `PATH`/`PATHEXT` (`looper-agent.js:resolve_command`), Copilot credential/provider variables allow-listed in `looper-agent.js:copilot_environment`, `AGF_CD_FILE` / `AGF_CD_HINT` (`agf.js:main`, set by the generated shell function).

## Testing structure

- `skills/agentflow/scripts/looper.test.js` — coordinator, Git integration, recovery, settings, Windows path/process handling.
- `skills/agentflow/scripts/looper-copilot.test.js` — CLI argument construction and Copilot/Claude result parsing.
- `skills/agentflow/scripts/looper-agent.test.js` — provider launch failures: `failure.json` diagnostics and evidence identity, missing executables, result failures on exit 0.
- `skills/agentflow/scripts/looper-report.test.js` — progress/heartbeat formatting, summaries, saved reports, locale.
- `skills/agentflow/scripts/looper-cleanup.test.js` — explicit cleanup preconditions, Trash identity proofs, crash/retry.
- `skills/agentflow/scripts/feature.test.js`, `feature-merge.test.js`, `feature-shell.test.js` — feature CLI create/drop, merge/recovery, shell bindings and cd channel.
- `skills/agentflow/scripts/init.test.js` — `agf init`: bootstrap and generated-only commit, repeat no-op, refusals (nested/linked/detached/feature roots, partial records, staged/untracked AGENTS), configuration-discovery warnings (bounded examples, en/zh-TW, no writes; 9.1.4), retained reservation on failure, concurrency, locale fallback, CLI route detection (skipped on Windows).
- Prompt behavior (SKILL.md/references) has **no automated tests** in this repo.

### Known Windows test failures (9.1.0)

Observed on native Windows with a zh-TW OS locale (2026-10-29, full `npm test`: 305 tests, 207 pass, 65 fail, 8 cancelled, 25 skipped, ~27 min). This run predates 9.1.2, so `init.test.js` is not covered by this table. CHANGELOG 9.1.0 states recorded checks cover packaged tests and representative macOS host journeys; native Windows keeps its stated limits. Causes were grouped from the failure messages; only the locale cause was re-run to confirm.

| Cause | Affected tests (examples) | Status |
| --- | --- | --- |
| OS locale fallback: `looper-report.js:resolve_locale` uses `Intl` OS locale when `use-lang` is absent, so presentation is zh-TW while tests expect English | `looper-report.test.js` (e.g. "invocation error cannot be masked …"), CLI presentation tests in `looper.test.js` (e.g. "presentation observes a real checked integration …") | **Confirmed**: forcing an `en-US` `Intl` locale cut `looper-report.test.js` failures from 15 to 7 |
| POSIX path expectations (`/work/...`) vs backslash paths | remaining `looper-report.test.js` failures (e.g. "original six-task blocked example …") | Inferred from assertion text |
| No symlink privilege (`EPERM` from `fs.symlinkSync`; these tests do not use `symlink_or_skip`) | `feature-merge.test.js` "ordinary symlink, executable mode, rename …", `feature-shell.test.js` "destination channel rejects links …", `feature.test.js` "ignored-only data, locks and symlink target …" | Confirmed from error |
| Windows command resolution refuses `npm.CMD` and extensionless stubs (`looper-agent.js:resolve_command`, by design per `references/windows.md#javascript-looper`) | `feature-merge.test.js` npm fallback and conflict-resolver tests | Confirmed from error; runtime behaves as documented |
| `git worktree` registration comparison fails in cleanup (`Worktree registration missing, foreign or locked`, `looper-cleanup.js:cleanup`) | almost all of `looper-cleanup.test.js` | Inferred path-format mismatch; cleanup is macOS-only by contract, so this is an unsupported path rather than a shipped regression |
| Characters invalid in Windows filenames used as test data (`ENOENT` on `mkdir`) | `feature-merge.test.js` "literal multiline check arguments …" | Confirmed from error |
| 30 s test timeouts on slower Windows process/Git operations (children then cancelled) | "dependency graphs start from checked integrated files …", "dependent starts against latest forward target …", several "ordinary review …" native tests | Confirmed timeouts; root cause not investigated |
| Carried over from 9.0.0: trailing-dot inline request (`looper-state.js:inspect_path` rejects it before the expected `ENOENT`); 150 ms child vs ~0.4–1.2 s PowerShell `process_identity` race | "invalid request files fail before claims or worktrees" → `inline`; "process enumeration failure makes execution unsettled …" | Confirmed (9.0.0 analysis) |
| Others (Git Bash path in the bash wrapper test, missing-provider launch test) | `feature-shell.test.js` "bash preserves argv/output/status …", `looper-agent.test.js` "missing provider executable …" | Not investigated |

Do not treat these as regressions without checking the category. Test-side fixes belong upstream (see [DECISIONS.md](DECISIONS.md) D20). Run with an English OS locale to reduce presentation noise.

## Release shape

Commits are titled `release: aglite @ <sha>` (up to 9.0.0-beta.1) and `release: agentflow @ <sha>` (9.0.0 onward), and CHANGELOG 0.3.0 says the project lives in "a separate private source repository". This repo appears to be a published release mirror (inferred). Version strings appear in `.claude-plugin/plugin.json`, `skills/agentflow/package.json`, `SKILL.md` metadata, README title and CHANGELOG.

The 9.0.0 rename did not change looper runtime identifiers: worktrees/branches `aglite-*`, the `.aglite-records/` task-notebook directory, the `aglite-target-*.owner` claim and the `aglite runner` commit author remain (CHANGELOG 9.0.0: the looper "retains its bounded runtime and stored identifiers").

## Major domain concepts

Owner, host, notebook/devlog, Ask/Reply round, STATUS, claim (`.owner` marker), ag-dir, tracker/design, round evidence, system invariants, backlog, task modes, advisors, feature worktree, looper queue/group/task/attempt, integration lane. See [GLOSSARY.md](GLOSSARY.md).
