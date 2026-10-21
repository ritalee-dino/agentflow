# Glossary

Paths are relative to `skills/aglite/`.

## Roles

- **Owner** — the human who gives instructions and holds authority. Owner-only decisions cannot be made by workers or hosts.
- **Host** — the owner-facing coding assistant session that loaded aglite. Owns notebook, claims, decisions, integration and delivery.
- **Worker / delegate** — a bounded subagent or CLI session given one assignment (`references/review.md#give-one-bounded-assignment`). Never activates aglite itself unless it is a looper task host.
- **Native** — a worker launched through the host's own subagent tools. In the looper, native work goes through the inbox handoff.
- **External / CLI** — a worker launched as a separate CLI process (`codex exec`, `claude -p`, `copilot`).
- **Counterpart** — the other provider used for independent review (Claude host → Codex, Codex host → Claude). `scripts/looper.js:counterpart`.
- **Advisor** — optional reasoning role prompt in `references/advisors/` (requirements, codewalk, explore, spike, spec, security-scan, acceptance, final-audit, learn, product-docs).

## Records

- **ag-dir** — configured record directory, default `.agentflow`. `.agentflow/` in prompts means the configured ag-dir.
- **ag.json** — project configuration at `<checkout>/<ag-dir>/ag.json`, schema 12.
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

## Commands and modes

- **godev / gdd / devlog** — activate/resume.
- **fast-lane** — one task executed directly by the host, skipping advisors, delegation, separate review, new design/tracker, routine RUN/WIP.
- **skip-review** — one task with host review only.
- **grill-me** — requirements interview.
- **3ways** — Claude plans, Codex challenges, host resolves.
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
- **Retire** — mark a feature merged/dropped; optional Trash-based removal.

## Looper

- **Looper / coordinator** — `scripts/looper.js:run`; the only writer of `queue.json`.
- **agf** — CLI binary (`scripts/agf.js`), commands `loop run` and `loop status`.
- **Run-root** — the `planned/` directory under `<ag-dir>/artifacts/A-NNN-<name>/` containing `queue.json`.
- **Queue** — `queue.json` schema 2: run_id, repo, target_branch, base_commit, request + sha256, authorization, checks, integration_checks, groups.
- **Group** — ordered tasks run sequentially in one worktree (`.wts/aglite-<run_id>-<group>`); optional `depends_on` earlier groups.
- **Task** — `## T01` section in `group-NNN.md` with `allowed_paths` and `checks`.
- **Attempt** — one dispatch (UUID) with immutable `selection` and evidence under `attempts/<uuid>/`.
- **Selection** — `{kind, provider, model, effort, executable?, source}` from `scripts/looper.js:select`.
- **Route** — `looper-routes.task|repair|acceptance` `{kind, provider, model-family}`; review uses the acceptance route.
- **Candidate** — group branch commit ready for integration.
- **Ready list / lane** — FIFO of ready groups; one serial integration lane.
- **expected_head** — latest checked target commit; target movement outside the lane sets `lane_error`.
- **Repair** — fix attempt in the integration worktree after conflicts or failed checks; bounded by `max-repairs`.
- **Handoff (native)** — `attempts/<uuid>/assignment.md` read by host; result returned in `inbox/<uuid>.json` with `writer_stopped: true`.
- **Question** — blocker saved in `queue.json` `questions`; answered through `inbox/answers.json`.
- **commit_intent** — saved before a task commit so a crash can finish or verify it.
- **.aglite-records** — per-worktree isolated task notebook directory; git-excluded, never integrated.
- **Writer stopped / process identity** — proof via PID + start time (`scripts/looper-state.js:process_identity`, `writer_stopped`).
