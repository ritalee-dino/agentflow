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
- **ag.json** — project configuration at `<checkout>/<ag-dir>/ag.json`, schema 13 (target = bundled template's `schema-version`); `switches.saving-mode` required.
- **Notebook / devlog** — the Markdown log at `<ag-dir>/<notebook-name>` (default `<dirname>.devlog.md`). Starts with STATUS, then rounds.
- **STATUS** — top section of the notebook: Project, Notebook, Checkout, Branch, Current, Proven, Next, Archived eras (+ Stream, Cleanup, Session for features). Labels are localized by `use-lang`.
- **Ask / Reply / round** — `# → Ask / A-NNN` heading with captured owner input, then `# → Reply / A-NNN`, then the next Ask. A-NNN is the round ID.
- **RUN / WIP** — optional milestone (`[RUN-NNN]`) and ten-minute checkpoint (`[WIP-NNN]`) entries; controlled by `omit-run`, `omit-wip`.
- **Receipt** — chat line `→ Updated: A-NNN | <notebook>` plus working directory, shown instead of the answer when `inline-reply: off`.
- **Claim / owner marker** — `.<notebook-basename>.owner` JSON `{session, ask, claimed_at}` created exclusively; coordinates sessions.
- **Capture** — copying each owner chat message into the active Ask with `+ ` paragraph prefixes.
- **Off-record** — exchange marked with `nolog:`/`noop:`/`off:`/`skip:`; executed but not recorded.
- **Idle shortcut** — bare activation with no unfinished work: ask for next request without claiming.
- **Round evidence** — workflow proof stored in `<ag-dir>/.tmp/A-NNN.md` or `<ag-dir>/artifacts/A-NNN/`, linked from Current, kept out of the devlog body.
- **Tracker** — task-state record (`## Tasks` with `T-n`, `## Recovery`); statuses TODO/DOING/BLOCKED/DONE.
- **Design** — contract record with `## Invariants` (INV-n), `## Acceptance criteria` (AC-n), `## Validation`, `## Minimality check`.
- **System invariants / registry** — accepted durable guarantees `SYS-INV-n` in `<ag-dir>/sys-invariants.md`.
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
- **grill-me** — requirements interview.
- **simple-check** — `simple-check [target]`: fresh independent read-only review of an existing plan returning PASS/REVISE/BLOCKED; no host fallback or implementation authority (`references/simple-check.md`, 9.1.2).
- **Check (canonical)** — the adequacy → scope → subtraction → total burden → proof checklist in `references/simple-check.md#check`, applied by planning and review at their existing checkpoints without adding stages.
- **agf init** — standalone initializer for a fresh Git root (`scripts/init.js`, `references/setup.md#standalone-initialization`).
- **3ways** — Claude and Codex draft blind, exchange and debate, then Codex writes the final synthesis with dispositions; the host verifies and relays but does not rewrite it (`references/review.md#3ways-compare-before-implementation`, 9.1.0).
- **browfield** — optional eight-gate brownfield procedure (spelling is intentional in this repo).
- **append-rounds / append-tasks** — stage a later batch.
- **show-diff** — present a verified diff with reasons.
- **plan-order / review-order** — route selection for planning and result review: `3ways|external|native|host` and `external|native|host`.
- **Planner diversity** — preference that the reviewer comes from a different model family than the planner.
- **gate-design / gate-tracker** — approval pauses before implementation / before final delivery.
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

## Looper

- **Looper / coordinator** — `scripts/looper.js:run`; the only writer of `queue.json`.
- **agf** — CLI launcher (`scripts/agf.js:main`): `init`, `looper run|status|cleanup`, the terminal feature commands and `shell`. The pre-9.1.0 spelling `agf loop …` no longer parses.
- **Run-root** — the `planned/` directory under `<ag-dir>/artifacts/A-NNN-<name>/` containing `queue.json`.
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
- **Repair** — fix attempt in the integration worktree after conflicts or failed checks; bounded by `max-repairs`.
- **Handoff (native)** — `attempts/<uuid>/assignment.md` read by host; result returned in `inbox/<uuid>.json` with `writer_stopped: true`.
- **Question** — blocker saved in `queue.json` `questions`; answered through `inbox/answers.json`.
- **commit_intent** — saved before a task commit so a crash can finish or verify it.
- **.aglite-records** — per-worktree isolated task notebook directory; git-excluded, never integrated. The `aglite` prefix (also in `aglite-*` branches/worktrees and claims) is a retained runtime identifier from the beta name.
- **aglite** — former beta name (9.0.0-beta.1) of Agentflow 9; now only a legacy identifier, a migratable schema string `aglite-5`, and an installation the release check treats as eligible for Agentflow 9+.
- **Writer stopped / process identity** — proof via PID + start time (`scripts/looper-state.js:process_identity`, `writer_stopped`).
