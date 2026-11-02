# Feature map

Most features are **prompt-defined**: the "implementation" is a Markdown section that the host follows. Only the standalone initializer (F4b), the looper (F10) and the terminal feature CLI (F11b) have executable code and tests. For each feature, read the listed reference section first.

Paths below are relative to `skills/agentflow/` unless they start with `.claude-plugin/`, `README` or `CHANGELOG`.

---

## F1. Activation, routing and idle shortcut

- **Purpose**: decide what to do with an owner message before touching records.
- **Trigger**: trigger words in `SKILL.md` frontmatter `description` (`godev`, `gdd`, `devlog`, commands below); root `AGENTS.md` activation directive in consumer projects.
- **Definition**: `SKILL.md#route-before-records` (ordering), `SKILL.md#load-only-the-applicable-procedure` (reference map).
- **Related**: `references/configuration.md#discovery-and-validation`, `references/session.md#activate-and-recover`.
- **Side effects**: none on idle except release-check date write (`configuration.md#session-release-check`).
- **Tests**: none (prompt).

## F2. Notebook (devlog), claim and recovery

- **Purpose**: one append-only notebook per checkout so another session can resume.
- **Trigger**: any on-record work.
- **Definition**: `references/session.md#activate-and-recover`, `#notebook-ownership`, `#round-evidence`; rendering in `references/delivery.md#notebook-and-delivery`.
- **Persistence**: `<ag-dir>/<notebook-name>`, `.<notebook>.owner`, `<ag-dir>/.tmp/A-NNN.md`, `<ag-dir>/artifacts/A-NNN/`. Template `assets/.agentflow/devlog.md`.
- **Rules worth knowing**: claim via exclusive create (`wx`); late conflicts retry after 60/120/180 s; owner messages captured with `+ ` prefix; receipt `→ Updated: A-NNN | <notebook>`; archive above 750 lines.
- **Code dependency**: the looper parses the same Ask/Reply heading shape in `scripts/looper.js:notebook_rounds` / `ordinary_closeout` (tests: "ordinary closeout …", "CRLF task and closeout readers …").

## F3. Configuration (`ag.json`) and migration

- **Purpose**: per-project settings, schema 13. Target schema = `schema-version` of the bundled template (`references/configuration.md#discovery-and-validation`); `switches.saving-mode` is required (`on|off`); migration adds `off` only when absent.
- **Definition**: `references/configuration.md` (discovery, switches, worker settings), `references/upkeep.md#automatic-migration`, `references/legacy-migration.md` (Agentflow 8; proven v8 input also materializes absent `pipeline-roles.threeways: better`).
- **Template**: `assets/.agentflow/ag.json` (9.1.0 adds top-level `default-editor: vscode` and Codex CLI `looper-routes`; neither needs a schema bump).
- **Code**: the feature CLI has its own canonical discovery without migration (`scripts/feature-common.js:discover`). Looper's independent discovery `scripts/looper.js:read_settings` (refuses legacy/colliding/symlinked configs; requires schema equal to the bundled template's `current_schema` or absent; requires `switches.saving-mode` `on|off`; integer schemas 9..current−1 and `aglite-5` at `.agentflow/ag.json` are treated as legacy; never rewrites). Tests: "configuration discovery selects deeply nested ag-dir …", "configuration collisions and legacy locations fail …", "current config requires the bundled schema and safe ag-dir …", "saving-mode accepts exact on/off and refuses missing or invalid values before claims", "coordinator requires host migration …".
- **Side effects**: host-only migration writes (atomic rename); `next_update_date` scheduling.

## F4. First-time setup and AGENTS.md adoption

- **Purpose**: create config, notebook, backlog, registry, dirs; add activation directive to consumer `AGENTS.md`.
- **Definition**: `references/setup.md#first-time-setup`, `#agents-adoption`, `#empty-bootstrap`.
- **Also**: `#agf-command-setup` — during eligible first-time setup the host generates the `agf` shell function (`node <skill>/scripts/agf.js shell <zsh|bash|powershell>`) and appends it to the login shell's startup files if absent; existing bindings are never auto-upgraded. `#detected-worker-defaults` — new configs set all three `looper-routes` to a detected `codex` (preferred) or `claude` CLI, else native routes or empty.
- **Command path (9.1.2)**: for eligible fresh Git setup (no explicit owner target language outside English/Traditional Chinese) the host runs the verified `agf init --lang <use-lang>` (F4b) instead of hand-writing scaffolds, then claims A-002; direct host setup remains for non-Git decline, commit prohibition, config-only recovery, dirty AGENTS adoption, unsupported platforms, etc. (`setup.md#first-time-setup`). New AGENTS directives are rendered in the configured locale (English canonical).
- **Side effects**: may ask to `git init`; for an approved `git init` or an existing repository without commits, creates one empty bootstrap commit (`git commit --allow-empty --only -m "chore: initialize repository"`) even with `auto-commit: off`, unless commits are explicitly forbidden. Pre-existing staged/untracked contents are excluded from the first delivery (`references/delivery.md#git-delivery`). No push authority.

## F4b. Standalone initializer `agf init` (9.1.2)

- **Purpose**: deterministic fresh-root setup from a shell (or by the host during F4) without model calls.
- **Command**: `agf init [--lang <locale>]`, or `node <skill>/scripts/agf.js init …` without a binding.
- **Contract**: `references/setup.md#standalone-initialization`; locale fallback in `references/configuration.md#discovery-and-validation` (use-lang bullet); recovery gate in `SKILL.md#route-before-records` step 5.
- **Entry**: `scripts/agf.js:main` (validates `init` argv before any write) → `scripts/init.js:initialize`.
- **Behavior**: runs at the physical Git root only (or `git init`s a non-Git cwd); refuses nested folders, linked worktrees, bare repos, `feature/*` branches, Git locks or in-progress operations, unborn repos with refs, existing records/claims, staged/modified/untracked AGENTS changes, ignored generated paths and missing commit identity. A complete existing setup (incl. custom ag-dir/notebook-name) is a byte-for-byte no-op. Locale: `en*`, `zh`, `zh-tw`, `zh-hant*` kept; other `zh-*` → `zh-tw`; other valid tags → `en-us`; malformed tags stop (`init.js:locale`). Routes: first of `codex`/`claude` answering `--version`, else empty; always empty on Windows (`init.js:detect`).
- **Persistence**: `.agentflow/ag.json`, notebook (program A-001 recording the invocation + empty A-002), `backlog.md`, empty `sys-invariants.md`, `.gitkeep` in `artifacts/`, `features/`, `.tmp/`, root `AGENTS.md` directives; marker `.agentflow/.init-pending.owner` retired to `.git/agf-init-completed-<uuid>.json`.
- **Side effects**: optional empty bootstrap `chore: initialize repository`; with `auto-commit: on` one `chore: initialize agentflow` commit of generated paths only (`git commit --only`), hooks disabled; no push.
- **Tests**: `scripts/init.test.js`.

## F5. Task modes and execution

- **Commands**: `fast-lane`, `skip-review`, `grill-me`, `browfield`, `show-diff`.
- **Definition**: `references/work.md#task-modes`, `#execute-and-checkpoint`, `#diff-handling`; `references/browfield.md`.
- **Records**: RUN/WIP entries controlled by `omit-run` / `omit-wip`.

## F6. Planning, designs, trackers and gates

- **Definition**: `references/planning.md` (creation criteria, design sections `## Invariants`, `## Acceptance criteria`, `## Validation`, `## Minimality check`; tracker statuses TODO/DOING/BLOCKED/DONE), `#planning-modes-and-gates` (`plan-mode`, `gate-design`, `gate-tracker`).
- **Check (9.1.2)**: designs start with the plain-language overview from `references/writing.md`; adequacy/scope/minimality checks before edits, at closeout and before implementation apply `references/simple-check.md#check` (no extra stage or worker).
- **Routing**: `plan-order` in `references/review.md#planning-routes` (3ways → external → native → host). Since 9.1.0, simple understood low-risk planning (including simple task grouping) stays in the host; complex planning uses the configured route.

## F7. Delegation and result review

- **Commands**: `3ways`, `skip-review`; switch `review-order`.
- **Definition**: `references/review.md` (`#worker-settings`, `#choose-a-worker`, `#give-one-bounded-assignment`, `#planning-routes`, `#result-review-routes`, `#inspect-the-finished-result`, `#3ways-compare-before-implementation`); `references/copilot.md` for Copilot.
- **3ways (9.1.0)**: Claude and Codex draft blind, then exchange and debate; Codex writes the final synthesis with dispositions (dissent recorded, consensus only on identical accepted content). On any route using Codex, Codex owns final planning content.
- **External integrations**: `codex exec`, `claude -p` example command shapes in `review.md`.
- **Check reuse (9.1.2)**: blind drafts and result review's Outcome/Minimality items apply `references/simple-check.md#check`.

## F7b. Simplicity check (`simple-check`, 9.1.2)

- **Command**: unquoted `simple-check [target]` (also a `SKILL.md` trigger word).
- **Definition**: `references/simple-check.md` (`#command`, `#check`, `#result`).
- **Behavior**: reviews a named or unambiguous active existing plan with a fresh independent read-only worker on the `acceptance` route; no host fallback (→ BLOCKED), no plan creation, no implementation authority. Returns PASS, REVISE or BLOCKED for the exact revision, saved in existing review evidence/answer locations.
- **Tests**: none (prompt).

## F8. Advisors

- **Command**: `advisors: <names>`, `grill-me` (requirements interview).
- **Definition**: `references/ag.md` (selection), `references/advisors/*.md` (one prompt each). `final-audit` reuses `acceptance` settings.

## F9. Append rounds (batches)

- **Command**: `append-rounds <work>` / alias `append-tasks <work>`.
- **Definition**: `references/batches.md`. Pending entries live in a Current-linked `Pending batches` section, not in STATUS.

## F10. Looper — grouped parallel execution (only executable feature)

- **Commands**: chat `prepare-tasks`, `run-tasks`, `handle-tasks`; shell `agf looper run [run-root] [--cleanup]`, `agf looper status [run-root]`, `agf looper cleanup <run-root>`. `prepare-tasks` must show both terminal (`agf looper status/run`) and chat (`run-tasks`) execution choices, even with `inline-reply: off`.
- **Contract**: `references/looper.md` (authoritative), settings in `#looper-settings`.
- **Entry**: `scripts/agf.js:main` → `scripts/looper.js:run` / `status`; `scripts/looper-cleanup.js:cleanup`; presentation via `scripts/looper-report.js`.
- **Core path**: `looper.js:run` → `load`/`validate` → `request_text` → `read_settings` → `select` → claims (`looper-state.js:acquire_claim`) → per-group `task_job` (`looper-integration.js:prepare_group` → `invoke` → `looper-agent.js:launch_agent` → `ordinary_closeout` → `commit_task` → `checks`) → `integrate` (`adopt_target` → `prepare_integration` → checks → optional repair/review/acceptance → `land`). CLI tasks may request ordinary review through the relay (`.aglite-records/ordinary-review/<attempt>/request.json`).
- **Persistence**: run-root files (`queue.json`, `attempts/`, `inbox/`, `evidence/` incl. `run-*.txt` reports, `inputs/`, `results.md`), `.wts/aglite-*` worktrees, `.aglite-records/` notebooks, claims.
- **Cleanup (9.1.0)**: explicit only; requires a complete, settled, checked run; macOS Trash only (other platforms refuse); keeps branches and only queue/request/group plans; journaled in `queue.cleanup`. A cleaned queue makes a later `run` return 0 without workers.
- **Reports (9.1.0)**: stderr progress + 30 s heartbeat; stdout summary; `results.md` + `evidence/run-*.txt`; English/zh-TW via `use-lang`. Report failures never change scheduling or exit codes.
- **External**: `codex`, `claude`, `copilot` CLIs; Git.
- **Exit codes**: `run` 0 complete, 2 blocked/stopped, 1 error; `cleanup` 0 complete, else 1; `run --cleanup` with task success but cleanup failure → 1 (`agf.js:main`, `looper.md#explicit-cleanup`).
- **Tests**: `scripts/looper.test.js` (≈100 tests: concurrency, FIFO integration, repair, ordinary-review relay, target adoption/landing recovery, changed contracts, native handoff, questions, crash recovery, dependencies, config, Windows), `scripts/looper-copilot.test.js` (CLI args and result parsing), `scripts/looper-agent.test.js` (failure evidence), `scripts/looper-report.test.js`, `scripts/looper-cleanup.test.js`.
- **Example queue**: `assets/looper-groups.example.json`.
- Details in [FLOWS.md](FLOWS.md#6-looper-run).

## F11. Feature worktrees

- **Commands**: `new-feature <name>`, `merge-feature <name> [and cleanup]`, `drop-feature <name>`.
- **Definition**: `references/features.md` (identity, STATUS fields `Stream/Cleanup/Session`, each command's numbered steps, `#retire-one-worktree`, `#directory-transition`, `#required-handoff`).
- **Bootstrap**: if main has no HEAD, `new-feature` applies only `setup.md#empty-bootstrap` (no main notebook access) before adding the worktree.
- **Layout**: `<main>/.wts/ft-<name>` on `feature/<name>`; notebook `<ag-dir>/features/<name>/<name>.devlog.md`.
- **Side effects**: `git worktree add`, scoped merges (`git merge-tree --write-tree` / `commit-tree` / `update-ref` CAS when root notebook paths differ), Trash-based removal, `git branch -d/-D`.
- **Tests**: none for the host chat path (prompt). Note the looper reuses `.wts/` for its own `aglite-*` worktrees and rejects `.wts` in task `allowed_paths`.

## F11b. Terminal feature CLI (9.1.0)

- **Purpose**: run the feature lifecycle from a terminal, with caller-shell directory switching.
- **Commands**: `agf new-feature <name> [--open]` (`newft`), `agf merge-feature [name] [--cleanup] [--include <path>]… [--check '<JSON argv>']…` (`mergeft`), `agf drop-feature [name] [--abandon]` (`dropft`), `agf shell <zsh|bash|powershell>`. Merge/drop infer the name only inside their own feature checkout.
- **Contract**: `references/features.md#terminal-cli`, `#terminal-directory-transition`; shell function setup `references/setup.md#agf-command-setup`; Windows `references/windows.md#feature-cli`; `default-editor` in `references/configuration.md#discovery-and-validation`.
- **Entry**: `scripts/agf.js:main` (argv validation, SIGINT/SIGTERM → `AbortController`) → `scripts/feature.js:create` / `drop`, `scripts/feature-merge.js:merge`.
- **Behavior**: never reads main's root notebook/archive/claim; claims are random-UUID markers, not PID-owned; requires Node ≥ 20 and Git (merge: ≥ 2.38). Merge checks: explicit `--check`, else the candidate `package.json` test, else none (reported as such); each check/resolver has a 10-minute limit. Conflicts go to `codex exec` in the candidate checkout, restricted to conflict paths. Honors `auto-commit` / `auto-push`; `gate-design` / `gate-tracker` on → stop for host continuation.
- **Persistence**: feature notebook; `merge-state.json` / `snapshot-state.json` / `intake-state.json` and a `.merge-*` workspace under `<ag-dir>/features/<name>/`.
- **Directory switch**: only via the generated shell function's private `AGF_CD_FILE` (destination line + optional hint with `AGF_CD_HINT=1`); direct Node runs print a `cd` / `Set-Location` continuation.
- **Platforms**: macOS Trash; Windows direct deletion of the exact checkout/claims (best effort, untested natively); Linux refused (`scripts/feature-common.js:preflightClaimDisposal`).
- **Tests**: `scripts/feature.test.js`, `scripts/feature-merge.test.js`, `scripts/feature-shell.test.js` (several are macOS-only and skip elsewhere).

## F12. Git delivery

- **Switches**: `auto-commit`, `auto-push` (both default on).
- **Definition**: `references/delivery.md#git-delivery`. Task commit first, owner edits in a separate commit, then push; the empty bootstrap (F4) is the only commit allowed with `auto-commit: off`; never `git add .`/`-A`, force, pull, rebase, stash.

## F13. Shared records: project rules, backlog, system invariants

- **Definition**: `references/project-rules.md`, `references/session.md#project-rules-and-backlog`, `references/invariants.md`.
- **Templates**: `assets/.agentflow/backlog.md` (B-NNN), `assets/.agentflow/sys-invariants.md` (SYS-INV-n).
- **Looper link**: `looper.js:project_context` injects `project-rules.md`, `invariants.md`, `writing.md`, the project `AGENTS.md` and queue `contracts` into every task/repair/review prompt.

## F14. Language and writing

- **Switch**: `use-lang` (locale for all new human text; machine tokens unchanged).
- **Definition**: `references/configuration.md#discovery-and-validation` (use-lang bullet), `references/writing.md` (since 9.1.2 every design/report opens with a mental-model overview), `references/saving-mode.md`.
- **Code link**: `notebook_rounds` deliberately ignores heading labels so localized `# → <label> / A-NNN` headings validate.

## F15. Release check and installation upkeep

- **Definition**: `references/configuration.md#session-release-check` (checks `agfnow/agentflow` stable releases, writes `next_update_date` = today + 2 days), `references/upkeep.md#approved-installation-replacement`. Eligibility: installed aglite beta or Agentflow 9+ only upgrades to Agentflow 9+ stable releases, never to 8.x.
- **Distribution metadata**: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `skills/agentflow/package.json`.

---

## "What should I inspect first?" quick list

| Question about… | Start at |
| --- | --- |
| Why a host did X at activation | `SKILL.md#route-before-records` |
| Notebook format / receipt | `references/delivery.md#notebook-and-delivery`, `assets/.agentflow/devlog.md` |
| A setting's meaning/default | `references/configuration.md#switch-effects`, `docs/CHEATSHEET.md` (zh-TW: `docs/CHEATSHEET.tw.md`) |
| Fresh project initialization | `references/setup.md#standalone-initialization`, `scripts/init.js:initialize` |
| Plan simplicity review | `references/simple-check.md` |
| Differences from Agentflow 8 | `docs/agv8-agv9-comparison.md`, `references/legacy-migration.md` |
| Which model/provider a worker uses | `references/review.md#worker-settings`, `scripts/looper.js:select` |
| Looper scheduling/integration bug | `scripts/looper.js:run` (`task_job`, `integrate`, main `while` loop), `scripts/looper-integration.js` |
| Agent CLI flags | `scripts/looper-agent.js:launch_agent` |
| Looper terminal output / reports | `scripts/looper-report.js`, `scripts/agf.js:main` |
| Looper cleanup | `references/looper.md#explicit-cleanup`, `scripts/looper-cleanup.js:cleanup` |
| Terminal feature commands | `references/features.md#terminal-cli`, `scripts/feature*.js` |
| Process/claim safety | `scripts/looper-state.js` |
| Windows behavior | `references/windows.md`, `looper-agent.js:resolve_command`, `looper-state.js:process_identity` |
