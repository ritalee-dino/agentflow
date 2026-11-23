# Glossary

Paths are relative to `skills/agentflow/`.

## Roles

- **Owner** — the human who gives instructions and holds authority. Owner-only decisions cannot be made by workers or hosts.
- **Host** — the owner-facing coding assistant session that loaded agentflow. Owns notebook, claims, decisions, integration and delivery.
- **Worker / delegate** — a bounded subagent or CLI session given one assignment (`references/review.md#give-one-bounded-assignment`). Never activates agentflow itself unless it is a looper task host.
- **Native** — a worker launched through the host's own subagent tools. In the looper, native work goes through the inbox handoff.
- **External / CLI** — a worker launched as a separate CLI process (`codex exec`, `claude -p`, `copilot`).
- **Counterpart** — the other provider used for independent result review (Claude host → Codex, Codex host → Claude); prompt-level rule in `references/review.md#result-review-routes`. The looper no longer enforces a different provider for repaired-result review (the former `looper.js:counterpart` was removed in 9.1.0).
- **Advisor** — optional reasoning role prompt in `references/advisors/` (requirements, codewalk, explore, spike, spec, security-scan, acceptance, final-audit, learn, product-docs).

## Records

- **ag-dir** — configured record directory, default `.agentflow`. `.agentflow/` in prompts means the configured ag-dir.
- **ag.json** — project configuration at `<checkout>/<ag-dir>/ag.json`, schema 14 since 9.1.12 (target = bundled template's `schema-version`); `switches.saving-mode` and `switches.save-evidence` required.
- **Notebook / devlog** — the Markdown log at `<ag-dir>/<notebook-name>` (default `<dirname>.devlog.md`). Starts with STATUS, then rounds.
- **STATUS** — top section of the notebook: Project, Notebook, Checkout, Branch, Current, Proven, Next, Archived eras (+ Stream, Cleanup, Session for features). Labels are localized by `use-lang`.
- **Ask / Reply / round** — `# → Ask / A-NNN` heading with captured owner input, then `# → Reply / A-NNN`, then the next Ask. A-NNN is the round ID.
- **RUN / WIP** — optional milestone (`[RUN-NNN]`) and ten-minute checkpoint (`[WIP-NNN]`) entries; controlled by `omit-run`, `omit-wip`.
- **Open questions** — localized `## Open questions` section appended before Reply in an open round to hold new owner questions and current-round resolutions; each question has a unique Q-NNN-n, a suggested-default paragraph and one `- ans:` field (`references/delivery.md#questions-during-work`, 9.1.10). Used while work continues; see Question closeout for pauses.
- **Question closeout** — what the host does before yielding for owner answers: save pending scope/gate, question links and resume action, write Reply plus next Ask, settle workers and release its own claim. Closes the round, not the task; grants no completion or approval (`references/delivery.md#questions-during-work`, 9.1.11).
- **Receipt** — chat line `→ Updated: A-NNN | <notebook>` plus working directory, shown instead of the answer when `inline-reply: off`.
- **Claim / owner marker** — `.<notebook-basename>.owner` JSON `{session, ask, claimed_at}` created exclusively; coordinates sessions. Held only while a round is actually unfinished; waiting for owner answers does not retain it (9.1.11).
- **Capture** — copying each owner chat message into the active Ask with `+ ` paragraph prefixes.
- **Off-record** — exchange marked with `nolog:`/`noop:`/`off:`/`skip:`; executed but not recorded.
- **Idle shortcut** — bare activation with no unfinished work: ask for next request without claiming.
- **Round evidence** — workflow proof stored in `<ag-dir>/.tmp/A-NNN.md` or the artifact root's `A-NNN/`, linked from Current, kept out of the devlog body. Since 9.1.4 new evidence uses the compact selective fields Scope → Checks → Findings → Resume, omitting empty fields and routine output (`references/session.md#round-evidence`). Since 9.1.11 written only when evidence storage is on or explicitly requested.
- **Evidence storage / `save-evidence`** — `ag.json` switch (`on|off`, default `off`; optional at schema 13 in 9.1.11, required at schema 14 since 9.1.12, migration adds `off` when absent) deciding whether separate round evidence is created and read during ordinary recovery. Off changes persistence only: checks, review, gates and dedicated operational records (looper queue/attempts, feature lifecycle retry records, migration identities) remain (`references/session.md#evidence-storage`, 9.1.11).
- **Artifact root (selected)** — where round artifacts, prepared looper runs and ignored-proof fallbacks go: `<ag-dir>/features/<name>/artifacts/` in a managed feature (9.1.8), otherwise `<ag-dir>/artifacts/` (`references/session.md#round-evidence`).
- **Tracker** — task-state record (`## Tasks` with `T-n`, `## Recovery`); statuses TODO/DOING/BLOCKED/DONE.
- **Design** — contract record with `## Invariants` (INV-n), `## Acceptance criteria` (AC-n), `## Validation`, `## Minimality check`.
- **System invariants / registry** — accepted durable guarantees `SYS-INV-n` in `<ag-dir>/sys-invariants.md`.
- **Review lessons / `sys-review.md`** — verified reusable review failure mechanisms in checkout-root `<ag-dir>/sys-review.md`, written only by the owner-facing host; advisory, grant no authority (`references/deep-review.md#review-lessons`, 9.1.10).
- **Backlog** — future work items `B-NNN` in `<ag-dir>/backlog.md`; proposed or deferred, never auto-scheduled.
- **Project rules** — shared baseline `references/project-rules.md` plus optional local `<ag-dir>/rules.md`.
- **Archive** — `<notebook-stem>.archive.md`, receives old rounds when the notebook exceeds 750 lines.
- **Pending batches** — tracker/evidence section holding staged `append-rounds` input.
- **Empty bootstrap** — the single `chore: initialize repository` empty commit made for eligible first setup or main-rooted `new-feature` when the repo has no HEAD (`references/setup.md#empty-bootstrap`).
- **Init reservation / `.init-pending.owner`** — `.agentflow/.init-pending.owner` JSON `{session, ask, invocation, claimed_at}` created exclusively by `agf init`; retained on any failure and must be reconciled by the host before setup/idle/claims; on success renamed to the private receipt `.git/agf-init-completed-<uuid>.json` (`scripts/init.js:initialize`).
- **Program A-001** — the initializer-written first round recording the canonical `agf init` arguments as captured input; owner work starts in A-002.

## Commands and modes

- **godev / gdd / devlog** — activate/resume.
- **fast-lane** — one task executed directly by the host, skipping advisors, delegation, separate review, new design/tracker, routine RUN/WIP.
- **skip-review** — one task with host review only.
- **go-hunt** — `go-hunt [topic]`: requirements interview through the host using `references/advisors/requirements.md`; replaced `grill-me` in 9.1.11 (the old word no longer triggers).
- **Interview handoff** — where `go-hunt` findings persist: one evolving DRAFT `design.md` for feature discovery, or an existing requirements contract / `probe-report.md` for requirements-only discovery (`references/advisors/requirements.md#interview-handoff`, 9.1.11).
- **spec-out** — `spec-out [request]`: explicit staged specification command that develops one `design.md` (bundled template) and linked `tracker.md` through interview, Tech/Art investigation and optional prototype; adds no implementation or publication authority (`references/spec-out.md`, 9.1.11).
- **Readiness (specification)** — judgment of an existing design against accepted mandatory scope at final delivery/handoff; material gaps keep the scope DRAFT. Neither approval nor execution authority (`references/planning.md#specification-readiness-and-handoff`, 9.1.11).
- **DECIDED / OBSERVED / ASSUMPTION / PROPOSED / OPEN** — status labels separating statements in a `spec-out` design; OPEN choices link their devlog question.
- **UX prototype** — disposable, isolated interaction model on synthetic data with a matching UX report and optional review tour; lo-fi or hi-fi as confirmed by the owner (`references/ux-prototype.md`, 9.1.11).
- **simple-check** — `simple-check [target]`: fresh independent read-only review of an existing plan returning PASS/REVISE/BLOCKED; no host fallback or implementation authority (`references/simple-check.md`, 9.1.2).
- **eli5:** — `eli5: <topic-or-command>`: an interactive animated HTML lesson, preferably one self-contained file; everything after the marker is inert explanation data (`references/eli5.md`, 9.1.4; reworked 9.1.6).
- **Check (canonical)** — the adequacy → scope → subtraction → trace work → execution cost → total burden → proof checklist (trace/cost steps added in 9.1.4) in `references/simple-check.md#check`, applied by planning and review at their existing checkpoints without adding stages.
- **agf init** — standalone initializer for a fresh Git root (`scripts/init.js`, `references/setup.md#standalone-initialization`).
- **3ways** — Claude and Codex draft blind, exchange and debate, then Codex writes the final synthesis with dispositions; the host verifies and relays but does not rewrite it (`references/review.md#3ways-compare-before-implementation`, 9.1.0).
- **brownfield** — optional eight-gate brownfield procedure (`references/brownfield.md`); spelled `browfield` (`browfield.md`) before 9.1.10, and the old spelling no longer triggers.
- **deep-review** — `deep-review [target]`: forces deep review at any risk; also automatic for mid/high (`references/deep-review.md`, 9.1.10).
- **Risk triage / risk level** — `low | mid | high` rating of a reviewed candidate by behavior, blast radius, reversibility and uncertainty, reported separately from defects/verdict (`references/review.md#risk-triage`, 9.1.10); since 9.1.12 every implementation-result review answer states the level and a short reason.
- **Adaptive verification** — shared failure-driven method for choosing the cheapest discriminating check per named plausible violation, scoping state/formal-method claims, checking model-to-implementation correspondence and bounding repairs; adds no stage (`references/verification.md`, 9.1.12).
- **Machine-facing vs user-facing text** — since 9.1.12 agent directives, worker assignments and looper prompts are written in English; `use-lang` governs only user-facing text (`references/configuration.md#discovery-and-validation`, `references/writing.md`).
- **Human handoff** — owner-facing output of deep review; since 9.1.11 only blockers, decision-affecting uncertainty, sensitive actions needing human attention and actual approval requests, with routine risk/route accounting kept in enabled evidence; not an approval (`references/deep-review.md#human-handoff`).
- **append-rounds / append-tasks** — stage a later batch.
- **show-diff** — present a verified diff with reasons.
- **plan-order / review-order** — route selection for planning and result review: `3ways|external|native|host` and `external|native|host`.
- **Planner diversity** — preference that the reviewer comes from a different model family than the planner.
- **gate-design / gate-tracker** — approval pauses before implementation / before the task-completion Reply and delivery; a gate-tracker pause closes the round via question closeout (9.1.11).
- **pipeline-roles / model-family / tier** — role → tier (`best|better|basic|cheap`); catalog → `model/effort` string, split at final `/`.

## Feature worktrees

- **Managed feature** — worktree `<main>/.wts/ft-<name>` on `feature/<name>`.
- **Stream / Cleanup / Session** — feature-only STATUS fields: `open|merged|dropped`, `N/A|pending|failed|complete`, `active|retired`.
- **Handoff** — numbered instructions telling the owner to `/cd <path>` and send `godev`.
- **Terminal feature CLI** — `agf new-feature|merge-feature|drop-feature` (aliases `newft`/`mergeft`/`dropft`), code in `scripts/feature*.js`; distinct from the host chat commands of the same name.
- **Shell binding / `agf` function** — shell function printed by `agf shell <zsh|bash|powershell>` (`scripts/feature-shell.js:binding`) and added by first-time setup; forwards to `node <skill>/scripts/agf.js` and switches cwd only for successful feature commands.
- **AGF_CD_FILE / AGF_CD_HINT** — private destination file through which the feature CLI tells the shell function where to `cd`; `AGF_CD_HINT=1` opts in to a second hint line.
- **default-editor** — optional top-level `ag.json` key (default `vscode` → `code`) used by `agf new-feature --open`.
- **merge-state.json** — feature CLI merge recovery journal under `<ag-dir>/features/<name>/`, with phases `prepared … complete`.
- **Retire** — mark a feature merged/dropped; optional Trash-based removal.
- **Name reservation** — retained records under `<ag-dir>/features/<name>/` (local or committed in main) block creating a new feature with that name; choose a fresh name (9.1.8).

## Looper

- **Looper / coordinator** — `scripts/looper.js:run`; the only writer of `queue.json`.
- **agf** — CLI launcher (`scripts/agf.js:main`): `init`, `looper run|status|cleanup`, the terminal feature commands and `shell`. The pre-9.1.0 spelling `agf loop …` no longer parses.
- **Run-root** — the `planned/` directory under `<artifact-root>/A-NNN-<name>/` containing `queue.json`.
- **Queue** — `queue.json` schema 2: run_id, repo, target_branch, base_commit, request + sha256, authorization, checks, integration_checks, groups.
- **Group** — ordered tasks run sequentially in one worktree (`.wts/aglite-<run_id>-<group>`); optional `depends_on` earlier groups.
- **Task** — `## T01` section in `group-NNN.md` with `allowed_paths` and `checks`.
- **Attempt** — one dispatch (UUID) with immutable `selection` and evidence under `attempts/<uuid>/`.
- **Selection** — `{kind, provider, model, effort, executable?, source}` from `scripts/looper.js:select`.
- **Route** — `looper-routes.task|repair|acceptance` `{kind, provider, model-family}`; review uses the acceptance route.
- **Candidate** — group branch commit ready for integration.
- **Ready list / lane** — FIFO of ready groups; one serial integration lane.
- **expected_head** — latest checked or adopted target commit.
- **Target adoption** — recording a same-branch forward target advance made outside the lane (`looper-integration.js:adopt_target`, `queue.target_adoptions[]`); branch change, rewrite or foreign Git operation sets `lane_error` instead.
- **Carry forward** — re-merging an already checked integration result onto a newer adopted head, keeping the superseded attempt in `group.integration_history`.
- **Ordinary review relay** — a CLI task's own separate review, requested via `.aglite-records/ordinary-review/<attempt>/request.json` and run by the coordinator as a fresh read-only sibling (`attempt.ordinary_reviews`).
- **Explicit cleanup** — `agf looper cleanup` / `run --cleanup`: moves a completed run's worktrees and run-root extras to macOS Trash, keeping queue/request/plans and branches (`scripts/looper-cleanup.js`, `queue.cleanup`).
- **Run report** — derived output: `results.md` in the run-root and `evidence/run-<time>-<uuid>.txt` per invocation (`scripts/looper-report.js:save_report`); never resume input.
- **failure.json** — structured launch/execution/result failure evidence in `attempts/<uuid>/`.
- **Repair** — fix attempt in the integration worktree after conflicts or failed checks; bounded by `max-repairs`. Outside the looper, prompt-defined repairs honor existing budgets, else stop after two unsuccessful repairs of the same failure (`references/verification.md#repair-and-stopping`, 9.1.12).
- **Handoff (native)** — `attempts/<uuid>/assignment.md` read by host; result returned in `inbox/<uuid>.json` with `writer_stopped: true`.
- **Question** — blocker saved in `queue.json` `questions`; answered through `inbox/answers.json`.
- **commit_intent** — saved before a task commit so a crash can finish or verify it.
- **.aglite-records** — per-worktree isolated task notebook directory; git-excluded, never integrated. The `aglite` prefix (also in `aglite-*` branches/worktrees and claims) is a retained runtime identifier from the beta name.
- **aglite** — former beta name (9.0.0-beta.1) of Agentflow 9; now only a legacy identifier, a migratable schema string `aglite-5`, and an installation the release check treats as eligible for Agentflow 9+.
- **Writer stopped / process identity** — proof via PID + start time (`scripts/looper-state.js:process_identity`, `writer_stopped`).
