# Feature map

Most features are **prompt-defined**: the "implementation" is a Markdown section that the host follows. Only the looper (F10) has executable code and tests. For each feature, read the listed reference section first.

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
- **Template**: `assets/.agentflow/ag.json`.
- **Code**: looper's independent discovery `scripts/looper.js:read_settings` (refuses legacy/colliding/symlinked configs; requires schema equal to the bundled template's `current_schema` or absent; requires `switches.saving-mode` `on|off`; integer schemas 9..current−1 and `aglite-5` at `.agentflow/ag.json` are treated as legacy; never rewrites). Tests: "configuration discovery selects deeply nested ag-dir …", "configuration collisions and legacy locations fail …", "current config requires the bundled schema and safe ag-dir …", "saving-mode accepts exact on/off and refuses missing or invalid values before claims", "coordinator requires host migration …".
- **Side effects**: host-only migration writes (atomic rename); `next_update_date` scheduling.

## F4. First-time setup and AGENTS.md adoption

- **Purpose**: create config, notebook, backlog, registry, dirs; add activation directive to consumer `AGENTS.md`.
- **Definition**: `references/setup.md#first-time-setup`, `#agents-adoption`, `#empty-bootstrap`.
- **Side effects**: may ask to `git init`; for an approved `git init` or an existing repository without commits, creates one empty bootstrap commit (`git commit --allow-empty --only -m "chore: initialize repository"`) even with `auto-commit: off`, unless commits are explicitly forbidden. Pre-existing staged/untracked contents are excluded from the first delivery (`references/delivery.md#git-delivery`). No push authority.

## F5. Task modes and execution

- **Commands**: `fast-lane`, `skip-review`, `grill-me`, `browfield`, `show-diff`.
- **Definition**: `references/work.md#task-modes`, `#execute-and-checkpoint`, `#diff-handling`; `references/browfield.md`.
- **Records**: RUN/WIP entries controlled by `omit-run` / `omit-wip`.

## F6. Planning, designs, trackers and gates

- **Definition**: `references/planning.md` (creation criteria, design sections `## Invariants`, `## Acceptance criteria`, `## Validation`, `## Minimality check`; tracker statuses TODO/DOING/BLOCKED/DONE), `#planning-modes-and-gates` (`plan-mode`, `gate-design`, `gate-tracker`).
- **Routing**: `plan-order` in `references/review.md#planning-routes` (3ways → external → native → host).

## F7. Delegation and result review

- **Commands**: `3ways`, `skip-review`; switch `review-order`.
- **Definition**: `references/review.md` (`#worker-settings`, `#choose-a-worker`, `#give-one-bounded-assignment`, `#inspect-the-finished-result`, `#3ways-compare-before-implementation`); `references/copilot.md` for Copilot.
- **External integrations**: `codex exec`, `claude -p` example command shapes in `review.md`.

## F8. Advisors

- **Command**: `advisors: <names>`, `grill-me` (requirements interview).
- **Definition**: `references/ag.md` (selection), `references/advisors/*.md` (one prompt each). `final-audit` reuses `acceptance` settings.

## F9. Append rounds (batches)

- **Command**: `append-rounds <work>` / alias `append-tasks <work>`.
- **Definition**: `references/batches.md`. Pending entries live in a Current-linked `Pending batches` section, not in STATUS.

## F10. Looper — grouped parallel execution (only executable feature)

- **Commands**: chat `prepare-tasks`, `run-tasks`, `handle-tasks`; shell `agf loop run [run-root]`, `agf loop status [run-root]`.
- **Contract**: `references/looper.md` (authoritative), settings in `#looper-settings`.
- **Entry**: `scripts/agf.js` → `scripts/looper.js:run` / `status`.
- **Core path**: `looper.js:run` → `load`/`validate` → `request_text` → `read_settings` → `select` → claims (`looper-state.js:acquire_claim`) → per-group `task_job` (`looper-integration.js:prepare_group` → `invoke` → `looper-agent.js:launch_agent` → `ordinary_closeout` → `commit_task` → `checks`) → `integrate` (`prepare_integration` → checks → optional repair/review/acceptance → `land`).
- **Persistence**: run-root files (`queue.json`, `attempts/`, `inbox/`, `evidence/`, `inputs/`), `.wts/aglite-*` worktrees, `.aglite-records/` notebooks, claims.
- **External**: `codex`, `claude`, `copilot` CLIs; Git.
- **Exit codes**: `run` 0 complete, 2 blocked/stopped, 1 error (`agf.js`, `looper.md#shell-entry--alphabetical`).
- **Tests**: `scripts/looper.test.js` (≈60 tests: concurrency, FIFO integration, repair, native handoff, questions, crash recovery, dependencies, config, Windows), `scripts/looper-copilot.test.js` (CLI args and result parsing).
- **Example queue**: `assets/looper-groups.example.json`.
- Details in [FLOWS.md](FLOWS.md#looper-run).

## F11. Feature worktrees

- **Commands**: `new-feature <name>`, `merge-feature <name> [and cleanup]`, `drop-feature <name>`.
- **Definition**: `references/features.md` (identity, STATUS fields `Stream/Cleanup/Session`, each command's numbered steps, `#retire-one-worktree`, `#directory-transition`, `#required-handoff`).
- **Bootstrap**: if main has no HEAD, `new-feature` applies only `setup.md#empty-bootstrap` (no main notebook access) before adding the worktree.
- **Layout**: `<main>/.wts/ft-<name>` on `feature/<name>`; notebook `<ag-dir>/features/<name>/<name>.devlog.md`.
- **Side effects**: `git worktree add`, scoped merges (`git merge-tree --write-tree` / `commit-tree` / `update-ref` CAS when root notebook paths differ), Trash-based removal, `git branch -d/-D`.
- **Tests**: none (prompt). Note the looper reuses `.wts/` for its own `aglite-*` worktrees and rejects `.wts` in task `allowed_paths`.

## F12. Git delivery

- **Switches**: `auto-commit`, `auto-push` (both default on).
- **Definition**: `references/delivery.md#git-delivery`. Task commit first, owner edits in a separate commit, then push; the empty bootstrap (F4) is the only commit allowed with `auto-commit: off`; never `git add .`/`-A`, force, pull, rebase, stash.

## F13. Shared records: project rules, backlog, system invariants

- **Definition**: `references/project-rules.md`, `references/session.md#project-rules-and-backlog`, `references/invariants.md`.
- **Templates**: `assets/.agentflow/backlog.md` (B-NNN), `assets/.agentflow/sys-invariants.md` (SYS-INV-n).
- **Looper link**: `looper.js:project_context` injects `project-rules.md`, `invariants.md`, `writing.md`, the project `AGENTS.md` and queue `contracts` into every task/repair/review prompt.

## F14. Language and writing

- **Switch**: `use-lang` (locale for all new human text; machine tokens unchanged).
- **Definition**: `references/configuration.md#discovery-and-validation` (use-lang bullet), `references/writing.md`, `references/saving-mode.md`.
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
| Differences from Agentflow 8 | `docs/agv8-aglite-comparison.md`, `references/legacy-migration.md` |
| Which model/provider a worker uses | `references/review.md#worker-settings`, `scripts/looper.js:select` |
| Looper scheduling/integration bug | `scripts/looper.js:run` (`task_job`, `integrate`, main `while` loop), `scripts/looper-integration.js` |
| Agent CLI flags | `scripts/looper-agent.js:launch_agent` |
| Process/claim safety | `scripts/looper-state.js` |
| Windows behavior | `references/windows.md`, `looper-agent.js:resolve_command`, `looper-state.js:process_identity` |
