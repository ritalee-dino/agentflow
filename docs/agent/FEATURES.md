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
- **Persistence**: `<ag-dir>/<notebook-name>`, `.<notebook>.owner`, `<ag-dir>/.tmp/A-NNN.md`, `<ag-dir>/artifacts/A-NNN/` (managed features: `<ag-dir>/features/<name>/artifacts/A-NNN/` since 9.1.8; established locations and explicit destinations are kept). Template `assets/.agentflow/devlog.md`.
- **Rules worth knowing**: claim via exclusive create (`wx`); late conflicts retry after 60/120/180 s; owner messages captured with `+ ` prefix; receipt `→ Updated: A-NNN | <notebook>`; archive above 750 lines. New workflow evidence (9.1.4, `session.md#round-evidence`) is compact and selective by default, with saving-mode on or off: ordered fields Scope, Checks, Findings, Resume, empty fields omitted, no file when nothing needs retaining; routine output/transcripts are omitted, fixed design/tracker/feature/looper formats and old evidence are untouched.
- **Evidence storage (9.1.11)**: optional `switches.save-evidence` (`on|off`, default `off`; `session.md#evidence-storage`) decides whether that separate round evidence exists at all. Off: no separate evidence, raw proof, captures or review briefs are created, nothing is redirected into the devlog/tracker/artifacts, existing evidence links (including legacy ones) are skipped during ordinary recovery, and missing proof means rechecking; only essential unfinished state, blockers, operation identities and the next safe action stay in Current/tracker. On: the compact fields above apply. Checks, review, gates, claims, devlog answers and dedicated operational records (feature lifecycle retry records, looper queue/attempt records, migration/release identities) are unaffected either way; enabling is prospective, never backfilled.
- **Owner questions (9.1.10)**: new owner questions — including brownfield gates, `go-hunt` interviews and `gate-design`/`gate-tracker` approval requests — are saved directly in the selected devlog (`references/delivery.md#questions-during-work`). While a round is open they go in one localized `## Open questions` section before Reply (an allowed mid-round write that does not close the round); each has a unique Q-NNN-n, suggested-default paragraph and one empty `- ans:`. Current/tracker Recovery link the question ID with the blocked gate; trackers, designs and reports never hold new questions or answer fields (historical fields are preserved for recovery). Owner-message capture inserts before the first Open questions/RUN/WIP/Reply heading (`session.md#activate-and-recover` step 4).
- **Question closeout (9.1.11)**: the `## Open questions` section is used only while work continues. When the host yields for owner answers it finishes independent authorized work, saves pending scope/gate, question links and the resume action, writes Reply plus the next Ask, settles workers and releases its own claim — waiting alone never keeps a round or claim open. The answer is handled in the next round: claim the receiving Ask, recover pending questions through Current/tracker, read the original `- ans:` fields and record the resolution there. A question pause grants no completion, approval, gated commit/push or lifecycle cleanup (`delivery.md#questions-during-work`, `session.md#notebook-ownership`).
- **Code dependency**: the looper parses the same Ask/Reply heading shape in `scripts/looper.js:notebook_rounds` / `ordinary_closeout` (tests: "ordinary closeout …", "CRLF task and closeout readers …"). It matches only top-level `# ` headings, so the level-2 `## Open questions` section does not affect closeout detection (confirmed from the regex; no test covers it).

## F3. Configuration (`ag.json`) and migration

- **Purpose**: per-project settings, schema 13. Target schema = `schema-version` of the bundled template (`references/configuration.md#discovery-and-validation`); `switches.saving-mode` is required (`on|off`); migration adds `off` only when absent.
- **Definition**: `references/configuration.md` (discovery, switches, worker settings), `references/upkeep.md#automatic-migration`, `references/legacy-migration.md` (Agentflow 8; proven v8 input also materializes absent `pipeline-roles.threeways: better`).
- **Template**: `assets/.agentflow/ag.json` (9.1.0 adds top-level `default-editor: vscode` and Codex CLI `looper-routes`; neither needs a schema bump; 9.1.11 adds `save-evidence: off` and changes `omit-wip` to `on`).
- **save-evidence (9.1.11)**: optional tenth Boolean switch, default `off`, schema stays 13; a missing key means off with no migration write or key insertion (`configuration.md#switch-effects`, `upkeep.md#automatic-migration`). Effects are in F2.
- **Code**: the feature CLI has its own canonical discovery without migration (`scripts/feature-common.js:discover`). Looper's independent discovery `scripts/looper.js:read_settings` (refuses legacy/colliding/symlinked configs; requires schema equal to the bundled template's `current_schema` or absent; requires `switches.saving-mode` `on|off`; accepts `switches.save-evidence` only when absent or `on|off`; integer schemas 9..current−1 and `aglite-5` at `.agentflow/ag.json` are treated as legacy; never rewrites). Tests: "configuration discovery selects deeply nested ag-dir …", "configuration collisions and legacy locations fail …", "current config requires the bundled schema and safe ag-dir …", "saving-mode accepts exact on/off and refuses missing or invalid values before claims", "optional save-evidence accepts missing/on/off and rejects invalid values before claims", "coordinator requires host migration …"; feature CLI: "invalid recognized switches stop before branch/worktree mutation" (`feature.test.js`).
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
- **Discovery stop (9.1.4)**: ambiguous or unresolved configuration discovery (`feature-common.js:discover` with `diagnosticLocale: locale(lang)`) fails before any write with a bounded en/zh-TW warning naming the checked directory, counts, ≤ 3 examples, and the "cd into the target project / ask your AI host; do not delete files" next steps. Without `--lang` the OS locale decides the message language.
- **Behavior**: runs at the physical Git root only (or `git init`s a non-Git cwd); refuses nested folders, linked worktrees, bare repos, `feature/*` branches, Git locks or in-progress operations, unborn repos with refs, existing records/claims, staged/modified/untracked AGENTS changes, ignored generated paths and missing commit identity. A complete existing setup (incl. custom ag-dir/notebook-name) is a byte-for-byte no-op. Locale: `en*`, `zh`, `zh-tw`, `zh-hant*` kept; other `zh-*` → `zh-tw`; other valid tags → `en-us`; malformed tags stop (`init.js:locale`). Routes: first of `codex`/`claude` answering `--version`, else empty; always empty on Windows (`init.js:detect`).
- **Persistence**: `.agentflow/ag.json`, notebook (program A-001 recording the invocation + empty A-002), `backlog.md`, empty `sys-invariants.md`, `.gitkeep` in `artifacts/`, `features/`, `.tmp/`, root `AGENTS.md` directives; marker `.agentflow/.init-pending.owner` retired to `.git/agf-init-completed-<uuid>.json`.
- **Side effects**: optional empty bootstrap `chore: initialize repository`; with `auto-commit: on` one `chore: initialize agentflow` commit of generated paths only (`git commit --only`), hooks disabled; no push.
- **Output (9.1.11)**: successful terminal output is only `Initialized Agentflow: <notebook>` plus the next action (add the request under Ask / A-002, then run `godev` in the coding agent), in en/zh-TW. Setup duties, the no-remote/no-push statement, the empty-registry notice (under `System invariant changes`) and the "no Codex/Claude CLI found" / "unverified on Windows" looper notice are saved in the A-001 Reply instead (`init.js:initialize`, `setup.md#standalone-initialization`).
- **Tests**: `scripts/init.test.js` (incl. "completed ownership is recoverably retained outside records and never committed" for the exact message, "Traditional Chinese initialization shows only the notebook and next action", "discovery warning explains parent-directory risk with bounded examples in both languages", "discovery warning retains ambiguity and malformed-config stops without exposing contents").

## F5. Task modes and execution

- **Commands**: `fast-lane`, `skip-review`, `go-hunt` (F8), `spec-out` (F17), `brownfield`, `deep-review` (F7c), `show-diff`. `brownfield` was spelled `browfield` before 9.1.10 and `go-hunt` was `grill-me` before 9.1.11; the old spellings are no longer trigger words.
- **Definition**: `references/work.md#optional-brownfield-path`, `#task-modes`, `#execute-and-checkpoint`, `#diff-handling`; `references/brownfield.md`.
- **Records**: RUN/WIP entries controlled by `omit-run` / `omit-wip`.
- **Test-first (9.1.9)**: executable behavior changes start with a focused failing test, then the smallest passing change, then refactoring while green; red/green evidence is recorded. Documentation-only, mechanical and test-only edits use relevant checks instead; an infeasible pre-change test needs a recorded reason, alternative proof and remaining gap (`references/work.md#execute-and-checkpoint`).
- **Journey checks (9.1.11)**: changed executable journeys are exercised from the supported default entry through the affected path and retained result/reload; isolated modules or injected-only setup do not prove entry wiring, fixture/simulated effects are distinguished from real integrations, and unavailable required journey checks stay unproved (`references/work.md#execute-and-checkpoint`).
- **Goal inference (9.1.10)**: the host infers outcome/scope as hypotheses, anticipates the next consequential need, and proceeds on reasonable assumptions for low-impact ambiguity (naming those that affect the result). Inferred intent never overrides explicit requirements, and advice, inferred intent or agreement with an idea grant no new authority; authorized normal substeps finish without repeated approval (`SKILL.md` intro, `references/session.md#activate-and-recover` step 5).
- **Browser checks**: affected web journeys/requested end-to-end checks read `references/browser-testing.md` before tool selection (routed from `SKILL.md#load-only-the-applicable-procedure` and `references/project-rules.md`). Since 9.1.4 Stagehand/`browse` routes are kept regardless of browser plugin presence, and their help, dependencies and startup must be inspected before reporting browser access unavailable.

## F6. Planning, designs, trackers and gates

- **Definition**: `references/planning.md` (creation criteria, design sections `## Invariants`, `## Acceptance criteria`, `## Validation`, `## Minimality check`; tracker statuses TODO/DOING/BLOCKED/DONE), `#planning-modes-and-gates` (`plan-mode`, `gate-design`, `gate-tracker`).
- **Check (9.1.2)**: designs start with the plain-language overview from `references/writing.md`; adequacy/scope/minimality checks before edits, at closeout and before implementation apply `references/simple-check.md#check` (no extra stage or worker).
- **Gate questions (9.1.10)**: `gate-design` / `gate-tracker` approval questions are saved in the devlog and linked from Current/tracker (`planning.md#planning-modes-and-gates`, F2 owner questions). Since 9.1.11 a `gate-tracker` pause uses question closeout (F2): the round closes and its settled claim is released with task/delivery still awaiting approval; approval of the same checked result resumes pending delivery in the next round, reusing checks only with retained matching proof.
- **Readiness and handoff (9.1.11)**: at final specification delivery or implementation handoff an existing design is judged against accepted mandatory scope — any material specification gap keeps that scope DRAFT, a ready subset needs an explicitly accepted boundary, and remaining work is classified as specification gap, unbuilt implementation or NOT RUN checks. Readiness is neither owner approval nor execution authority (`planning.md#specification-readiness-and-handoff`). Overall completion also now states that document completion, answered questions and partial milestones do not complete a larger accepted outcome.
- **Routing**: `plan-order` in `references/review.md#planning-routes` (3ways → external → native → host). Since 9.1.0, simple understood low-risk planning (including simple task grouping) stays in the host; complex planning uses the configured route.

## F7. Delegation and result review

- **Commands**: `3ways`, `skip-review`; switch `review-order`.
- **Definition**: `references/review.md` (`#worker-settings`, `#choose-a-worker`, `#give-one-bounded-assignment`, `#planning-routes`, `#result-review-routes`, `#inspect-the-finished-result`, `#3ways-compare-before-implementation`); `references/copilot.md` for Copilot.
- **3ways (9.1.0)**: Claude and Codex draft blind, then exchange and debate; Codex writes the final synthesis with dispositions (dissent recorded, consensus only on identical accepted content). On any route using Codex, Codex owns final planning content.
- **External integrations**: `codex exec`, `claude -p` example command shapes in `review.md`.
- **Check reuse (9.1.2)**: blind drafts and result review's Outcome/Minimality items apply `references/simple-check.md#check`.
- **Risk triage (9.1.10)**: result review of changed code, operational prompts, product artifacts or implementation-ready contracts — including host-only, fast-lane and skip-review review — returns a `low | mid | high` risk separately from defects/verdict (`review.md#inspect-the-finished-result` Risk item, `#risk-triage`, `work.md#records-and-review`). High covers auth/permissions, money, destructive/migrated data, secrets, deployment/external-action authority, public contracts, core invariants or system boundaries; file type or passing checks alone cannot justify low. The host keeps the higher plausible rating under uncertainty and routes mid/high to deep review (F7c) before closeout/gates. Ordinary Q&A, explanations and examples skip triage. Since 9.1.11 risk/reason is assessed internally and retained only in enabled evidence (F2); owner answers carry risk details only when decision-changing, needing sensitive human action/approval or explicitly requested — no routine footer.

## F7c. Deep review (`deep-review`, 9.1.10)

- **Command**: unquoted `deep-review [target]` (also a `SKILL.md` trigger word); also triggered automatically for mid/high risk after ordinary review (F7). Without a target it uses an unambiguous active or just-finished result, otherwise asks.
- **Definition**: `references/deep-review.md` (`#fresh-context-inspection`, `#select-and-prove`, `#human-handoff`, `#review-lessons`); command rule in `references/work.md#task-modes`; load rule in `SKILL.md#load-only-the-applicable-procedure`.
- **Behavior**: substantial inspection prefers a fresh-context read-only worker on the existing result-review routes (Codex spawns with `fork_turns: "none"`), folded into an already-needed separate review when possible; only missing checks are added. Checks are chosen per remaining failure mechanism (API/version verification, duplication, over-mocking, complexity/coverage incl. CRAP as diagnostic signals, properties, targeted mutation, ordering/restart, browser journeys) with no global thresholds. Host-only routes, fast-lane and skip-review keep direct host checks and handoff without restoring waived workers. Probes write only disposable scratch/copies; persistent tests/fixes need existing implementation authority.
- **Output**: since 9.1.11 the human handoff at the existing answer destination surfaces only blockers, uncertainty affecting the owner's decision, sensitive actions needing human attention, actual approval requests and explicitly requested review detail, each with affected location, consequence and needed action; high risk identifies sensitive failure/recovery, downstream effects and specialist decisions. Routine candidate identity, risk/reason, route, acceptance/invariant results and approval-status accounting live only in enabled evidence (F2), with no "no approval pending" footer and no substitute record when storage is off (`deep-review.md#human-handoff`, `session.md#round-evidence`). (9.1.10 put the full candidate/risk/ranked-location summary in the answer.)
- **Persistence**: optional review lessons in `<ag-dir>/sys-review.md` (or an established review-knowledge record), written only by the owner-facing host (`project-rules.md` Shared records); delegates and looper tasks return lesson candidates.
- **Looper**: inside a looper task the deep inspection is folded into the relayed fresh ordinary reviewer; the owner-facing host surfaces mid/high actions and reconciles lesson candidates when reporting a completed run (`review.md#looper-task-review`, `looper.md#scope-and-maintenance`). No coordinator code change.
- **Authority**: grants inspection and safe verification only — no implementation, provider selection, new approval gate or advisor.
- **Tests**: none (prompt).

## F7b. Simplicity check (`simple-check`, 9.1.2)

- **Command**: unquoted `simple-check [target]` (also a `SKILL.md` trigger word).
- **Definition**: `references/simple-check.md` (`#command`, `#check`, `#result`).
- **Behavior**: reviews a named or unambiguous active existing plan with a fresh independent read-only worker on the `acceptance` route; no host fallback (→ BLOCKED), no plan creation, no implementation authority. Returns PASS, REVISE or BLOCKED for the exact revision, saved in existing review evidence/answer locations. Since 9.1.4 the Check also traces representative work and challenges execution cost (duplicated context, recomputation, repeated I/O, serial independent steps), and PASS requires supported material inefficiencies to be addressed.
- **Tests**: none (prompt).

## F8. Advisors

- **Command**: `advisors: <names>`, `go-hunt [topic]` (requirements interview; replaced `grill-me` in 9.1.11; its owner rounds use devlog questions, F2).
- **Definition**: `references/ag.md` (selection), `references/advisors/*.md` (one prompt each), `references/work.md#task-modes` (`go-hunt` rule). `final-audit` reuses `acceptance` settings.
- **Interview handoff (9.1.11)**: for feature discovery expected to continue into specification, `go-hunt` persists findings in one evolving DRAFT `design.md` (existing contract, else under the producing Ask's artifact root) with a distinct Source request section; requirements-only discovery or prohibited design creation falls back to an existing requirements contract or `probe-report.md`. No interview log or duplicate handoff file; off-record/no-file instructions defer persistence. A completed, still-valid on-record interview satisfies `spec-out`'s initial interview (F17). `go-hunt` triggers no automatic `spec-out`, setting change or implementation authority (`advisors/requirements.md#interview-handoff`).

## F9. Append rounds (batches)

- **Command**: `append-rounds <work>` / alias `append-tasks <work>`.
- **Definition**: `references/batches.md`. Pending entries live in a Current-linked `Pending batches` section, not in STATUS.

## F10. Looper — grouped parallel execution (only executable feature)

- **Commands**: chat `prepare-tasks`, `run-tasks`, `handle-tasks`; shell `agf looper run [run-root] [--cleanup]`, `agf looper status [run-root]`, `agf looper cleanup <run-root>`. `prepare-tasks` must show both terminal (`agf looper status/run`) and chat (`run-tasks`) execution choices, even with `inline-reply: off`.
- **Contract**: `references/looper.md` (authoritative), settings in `#looper-settings`.
- **Entry**: `scripts/agf.js:main` → `scripts/looper.js:run` / `status`; `scripts/looper-cleanup.js:cleanup`; presentation via `scripts/looper-report.js`.
- **Core path**: `looper.js:run` → `load`/`validate` → `request_text` → `read_settings` → `select` → claims (`looper-state.js:acquire_claim`) → per-group `task_job` (`looper-integration.js:prepare_group` → `invoke` → `looper-agent.js:launch_agent` → `ordinary_closeout` → `commit_task` → `checks`) → `integrate` (`adopt_target` → `prepare_integration` → checks → optional repair/review/acceptance → `land`). CLI tasks may request ordinary review through the relay (`.aglite-records/ordinary-review/<attempt>/request.json`).
- **Run-root location (9.1.8)**: `A-NNN-<name>/planned/` under the selected artifact root — `<ag-dir>/features/<feature>/artifacts/` in a managed feature, otherwise `<ag-dir>/artifacts/` (`looper.md#prepare-and-route`).
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
- **Layout**: `<main>/.wts/ft-<name>` on `feature/<name>`; notebook `<ag-dir>/features/<name>/<name>.devlog.md`; round artifacts `<ag-dir>/features/<name>/artifacts/A-NNN/` (9.1.8), so main and feature Asks with the same A-NNN never collide.
- **Name reservation (9.1.8)**: before creation, all target-feature records (including artifacts) are checked at the target and in main's local files and committed tree. Retained records reserve the name: only an exact existing open managed pair resumes; otherwise choose a fresh name (e.g. `foobar-v2`). No permanent tombstone — once every old object is gone, the name may be reused (`features.md` new-feature step 2).
- **Side effects**: `git worktree add`, scoped merges (`git merge-tree --write-tree` / `commit-tree` / `update-ref` CAS when root notebook paths differ), Trash-based removal, `git branch -d/-D`.
- **Tests**: none for the host chat path (prompt). Note the looper reuses `.wts/` for its own `aglite-*` worktrees and rejects `.wts` in task `allowed_paths`.

## F11b. Terminal feature CLI (9.1.0)

- **Purpose**: run the feature lifecycle from a terminal, with caller-shell directory switching.
- **Commands**: `agf new-feature <name> [--open]` (`newft`), `agf merge-feature [name] [--cleanup] [--include <path>]… [--check '<JSON argv>']…` (`mergeft`), `agf drop-feature [name] [--abandon]` (`dropft`), `agf shell <zsh|bash|powershell>`. Merge/drop infer the name only inside their own feature checkout.
- **Contract**: `references/features.md#terminal-cli`, `#terminal-directory-transition`; shell function setup `references/setup.md#agf-command-setup`; Windows `references/windows.md#feature-cli`; `default-editor` in `references/configuration.md#discovery-and-validation`.
- **Entry**: `scripts/agf.js:main` (argv validation, SIGINT/SIGTERM → `AbortController`) → `scripts/feature.js:create` / `drop`, `scripts/feature-merge.js:merge`.
- **Behavior**: never reads main's root notebook/archive/claim; claims are random-UUID markers, not PID-owned; requires Node ≥ 20 and Git (merge: ≥ 2.38). Merge checks: explicit `--check`, else the candidate `package.json` test, else none (reported as such); each check/resolver has a 10-minute limit. Conflicts go to `codex exec` in the candidate checkout, restricted to conflict paths. Honors `auto-commit` / `auto-push`; `gate-design` / `gate-tracker` on → stop for host continuation. Without an existing registration, `create` refuses a non-empty local `<ag-dir>/features/<name>/` ("Retained feature records reserve this name …") or any committed main path under it ("Historical feature records exist in committed main …; choose a fresh name") before `git worktree add` (9.1.8, `feature.js:create`, `history`); the ignore preflight (`assertTrackable`) checks the feature-namespace artifact path. Ambiguous config discovery stops with the same bounded warning as `agf init`, always in English here (test: "configuration refuses ambiguity, unsafe routing …" in `feature.test.js`).
- **Persistence**: feature notebook; `merge-state.json` / `snapshot-state.json` / `intake-state.json` and a `.merge-*` workspace under `<ag-dir>/features/<name>/`.
- **Directory switch**: only via the generated shell function's private `AGF_CD_FILE` (destination line + optional hint with `AGF_CD_HINT=1`); direct Node runs print a `cd` / `Set-Location` continuation.
- **Platforms**: macOS Trash; Windows direct deletion of the exact checkout/claims (best effort, untested natively); Linux refused (`scripts/feature-common.js:preflightClaimDisposal`).
- **Tests**: `scripts/feature.test.js` (incl. "retained local or committed feature artifacts reserve names before Git creation", "feature artifact ignore preflight uses feature namespace rather than main artifacts"), `scripts/feature-merge.test.js` (incl. "same Ask artifact paths remain isolated across main and two independent features"), `scripts/feature-shell.test.js` (several are macOS-only and skip elsewhere).

## F12. Git delivery

- **Switches**: `auto-commit`, `auto-push` (both default on).
- **Definition**: `references/delivery.md#git-delivery`. Task commit first, owner edits in a separate commit, then push; the empty bootstrap (F4) is the only commit allowed with `auto-commit: off`; never `git add .`/`-A`, force, pull, rebase, stash.

## F13. Shared records: project rules, backlog, system invariants

- **Definition**: `references/project-rules.md`, `references/session.md#project-rules-and-backlog`, `references/invariants.md`. Since 9.1.10 the owner-facing host is also the only writer of review lessons (`<ag-dir>/sys-review.md`, F7c).
- **Templates**: `assets/.agentflow/backlog.md` (B-NNN), `assets/.agentflow/sys-invariants.md` (SYS-INV-n).
- **Looper link**: `looper.js:project_context` injects `project-rules.md`, `invariants.md`, `writing.md`, the project `AGENTS.md` and queue `contracts` into every task/repair/review prompt.

## F14. Language and writing

- **Switch**: `use-lang` (locale for all new human text; machine tokens unchanged).
- **Definition**: `references/configuration.md#discovery-and-validation` (use-lang bullet), `references/writing.md` (since 9.1.2 every design/report opens with a mental-model overview), `references/saving-mode.md`.
- **Writing rules added in 9.1.7–9.1.9** (`references/writing.md`): *Guide reading* — open with what readers learn and why; long or multi-audience documents add a compact linked contents list and purpose-based reading paths. *CJK spacing* — one space between CJK characters and adjacent English words/numbers in new prose (quotes, code, identifiers, paths, historical content untouched). *Question context in external answers* (9.1.9) — directly below each answer heading in a report/file outside the devlog, quote at least the first 50 Unicode code points of each answered question (whole if shorter), redacting credentials. *Lead with the answer* (9.1.10) — recommendations give the best-supported direction, its decisive reason and a concrete next step when useful, scaled to the request with no obligatory insight, goal restatement or closing question. The pre-delivery check covers these. Because `looper.js:project_context` injects `writing.md`, looper task prompts receive them too.
- **Code link**: `notebook_rounds` deliberately ignores heading labels so localized `# → <label> / A-NNN` headings validate.

## F15. Release check and installation upkeep

- **Definition**: `references/configuration.md#session-release-check` (checks `agfnow/agentflow` stable releases, writes `next_update_date` = today + 2 days), `references/upkeep.md#approved-installation-replacement`. Eligibility: installed aglite beta or Agentflow 9+ only upgrades to Agentflow 9+ stable releases, never to 8.x.
- **Distribution metadata**: `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `skills/agentflow/package.json`.

## F16. Visual explanations (`eli5:`, 9.1.4; reworked 9.1.6)

- **Command**: unquoted `eli5: <topic-or-command>` (also a `SKILL.md` trigger word); quoted examples do not activate it.
- **Definition**: `references/eli5.md` (`#scope`, `#build-the-lesson`, `#motion-and-controls`, `#access-and-delivery`, `#inspect-correct-deliver`); pre-routing rule in the `SKILL.md` preamble; load rule in `SKILL.md#load-only-the-applicable-procedure`.
- **Behavior**: everything after `eli5:` is explanation data — embedded commands, modes and markers (incl. `nolog:`) activate nothing; an off-record marker must come before `eli5:`. Since 9.1.6 the output is an interactive animated HTML lesson: a faithful subject-specific visual model and art direction settled before coding, learner actions that change the represented relationship, learner-controlled replayable progression (Play/Pause, Back/Next, Reset), keyboard/reduced-motion/static/no-script fallbacks, optional user-started media. One self-contained HTML file with embedded assets and no runtime network dependency is preferred; exceptions only for essential teaching needs, minimized and explained, with disclosed dependencies, pinned versions and tested opening instructions. Three.js is optional for spatial subjects; no mandated stack.
- **Authoring route (9.1.6)**: HTML authoring and revisions use GPT Astra/high or Claude Opus/high through supported model/effort controls; if neither is available the host reports it and does not substitute a model without owner authorization (`eli5.md#build-the-lesson`).
- **Persistence**: explicit destination, else the ordinary artifact location on-record (`<ag-dir>/artifacts/A-NNN/`, or the feature artifact root in a managed feature), or a unique OS-temporary location when off-record (no notebook access). Delivery includes the HTML plus required local assets/package and opening instructions.
- **Review**: ordinary Q&A host review; in an available browser, desktop and narrow layouts, transitions, controls, accessibility fallbacks and the delivered opening mode are inspected and defects repaired in batches; unperformed checks are reported (`eli5.md#inspect-correct-deliver`).
- **Tests**: none (prompt).

## F17. Staged specification (`spec-out`, 9.1.11)

- **Command**: explicit unquoted `spec-out [request]` (also a `SKILL.md` trigger word). Never selected by task size, ordinary planning, `spec` advice, quoted examples or `eli5:` payloads; bare invocation uses an unambiguous active target or asks without creating one. The selection is retained for the same unfinished specification on resume.
- **Definition**: `references/spec-out.md` (`#boundaries`, `#start-or-resume`, `#intake-and-investigation`, `#write-and-reconcile`); design template `references/spec-out-template.md`; `references/spec-out-github.md` only when GitHub is the selected collaboration hub; load rule in `SKILL.md#load-only-the-applicable-procedure`.
- **Behavior**: takes raw PM input through an adaptive owner interview (the `requirements` advisor method shared with `go-hunt`, F8; at least one round for a new specification, no question cap), Tech investigation (code, tests, interfaces, data, failure paths at identified revisions), Art investigation (design files, running product, components) and, when useful and separately authorized, a prototype (F18), then consolidates into the same `design.md`. Statements are separated as DECIDED / OBSERVED / ASSUMPTION / PROPOSED / OPEN; each rule has one home; every retained requirement maps to a section and AC/INV IDs. Repeated calls continue the same contract and reuse still-valid interviews, decisions and checks.
- **Persistence**: one `design.md` (template sections: Authority and decisions, Source request, Product, Tech, Art, Measurement if affected, Invariants, Acceptance criteria, Validation, Changes and open work, Minimality check) and one linked `tracker.md` under the planning tracker contract; owner questions and answer fields stay in the devlog (F2). No second spec, duplicate tracker or interview log.
- **Readiness**: before final delivery or handoff applies `planning.md#specification-readiness-and-handoff` (F6) and the canonical `simple-check.md#check`; no added stage or worker.
- **GitHub collaboration**: one repository path owns the contract, branches propose, a PR carries review. The host uses `gh` for authorized intake (PR body, comments, reviews, inline threads; paginated, pinned to base/head SHAs, refetched before dispositions). Textual or semantic conflicts stop dependent integration for human resolution even on a clean Git merge; resolved comments and approval counts do not prove role sign-off.
- **Authority**: none for production implementation, executable prototypes, deployment, push, PR creation/comment, review submission, merge or messaging; `plan-mode off`, fast-lane, stage limits and gates prevail.
- **Tests**: none (prompt).

## F18. UX prototypes (9.1.11)

- **Trigger**: authorized prototype planning, creation or revision, inside or outside `spec-out` (`SKILL.md#load-only-the-applicable-procedure`). No command of its own; a specification or planning request alone grants no executable prototype authority.
- **Definition**: `references/ux-prototype.md` (`#entry-and-authority`, `#establish-the-brief`, `#isolate-all-executable-prototypes`, `#build-the-interaction`, `#ux-report-and-review-tour`, `#verify-iterate-and-hand-off`).
- **Behavior**: the owner confirms whether a prototype is needed, its fidelity (lo-fi for structure/order, hi-fi for hierarchy/density/copy/feel) and depth before executable work. Tasks, screens, scenarios and findings get stable IDs (TASK-/SCREEN-/SCENE-/UX-) shared by prototype, report and tour. Default medium is local browser HTML/CSS/JS with one shared mock state/action model, deterministic scenarios and reset.
- **Isolation**: synthetic fixtures and simulated outcomes only; separate directory, entry, configuration and local origin; in-memory state (no database, localStorage, IndexedDB, product-file writes); no remote assets, analytics, production environment, secrets or services; unhandled requests fail closed; visible demo indicator.
- **Output**: one concise UX report per reviewable revision, free-trial and opt-in design-review modes, optional step-targeting tour. Agent delivery is "review-ready", never user-validated; human acceptance applies only to the identified revision/scenarios. Hands off to `spec-out.md#write-and-reconcile` (Art).
- **Related**: `references/browser-testing.md` before browser-tool selection.
- **Tests**: none (prompt).

---

## "What should I inspect first?" quick list

| Question about… | Start at |
| --- | --- |
| Why a host did X at activation | `SKILL.md#route-before-records` |
| Notebook format / receipt | `references/delivery.md#notebook-and-delivery`, `assets/.agentflow/devlog.md` |
| A setting's meaning/default | `references/configuration.md#switch-effects`, `docs/CHEATSHEET.md` (zh-TW: `docs/CHEATSHEET.tw.md`) |
| Fresh project initialization | `references/setup.md#standalone-initialization`, `scripts/init.js:initialize` |
| Plan simplicity review | `references/simple-check.md` |
| Risk levels, deep review, human handoff | `references/review.md#risk-triage`, `references/deep-review.md` |
| Where owner questions are saved, what happens while awaiting an answer | `references/delivery.md#questions-during-work` |
| Whether proof/evidence files are written or read | `references/session.md#evidence-storage` (`save-evidence`) |
| `spec-out` / `go-hunt` / design readiness | `references/spec-out.md`, `references/advisors/requirements.md`, `references/planning.md#specification-readiness-and-handoff` |
| UX prototype rules | `references/ux-prototype.md` |
| `eli5:` visual lessons | `references/eli5.md`, `SKILL.md` preamble |
| Config-discovery stop messages | `scripts/feature-common.js:discover` |
| Differences from Agentflow 8 | `docs/agv8-agv9-comparison.md`, `references/legacy-migration.md` |
| Which model/provider a worker uses | `references/review.md#worker-settings`, `scripts/looper.js:select` |
| Looper scheduling/integration bug | `scripts/looper.js:run` (`task_job`, `integrate`, main `while` loop), `scripts/looper-integration.js` |
| Agent CLI flags | `scripts/looper-agent.js:launch_agent` |
| Looper terminal output / reports | `scripts/looper-report.js`, `scripts/agf.js:main` |
| Looper cleanup | `references/looper.md#explicit-cleanup`, `scripts/looper-cleanup.js:cleanup` |
| Terminal feature commands | `references/features.md#terminal-cli`, `scripts/feature*.js` |
| Process/claim safety | `scripts/looper-state.js` |
| Windows behavior | `references/windows.md`, `looper-agent.js:resolve_command`, `looper-state.js:process_identity` |
