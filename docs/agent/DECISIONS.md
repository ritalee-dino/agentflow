# Design decisions

Labels:
- **[Documented]** — stated explicitly in repo docs/prompts/comments (source given).
- **[Implemented]** — strongly supported by code structure/tests.
- **[Inferred]** — deduction; verify before relying on it.

No ADR directory exists; sources are `CHANGELOG.md`, `README.md`, the references and code comments.

## D1. Workflow is instructions-only; no hooks, daemons or helpers — [Documented]

Ordinary behavior is executed by the host with its own tools. Sources: `references/configuration.md` (first paragraph: "Host-driven; no hooks or general runners/helpers"), `references/session.md#notebook-ownership` ("no helper, write lock, heartbeat or daemon"), `references/legacy-migration.md` (migration removes old Agentflow hooks). Consequence: most behavior has no automated tests; correctness depends on host compliance (README "Configuration and limits").

## D2. The looper is a narrow runtime exception — [Documented]

`references/looper.md` intro and `#scope-and-maintenance`: scoped Node coordinator, only `run`/`status`/`cleanup`, no push/release authority; cleanup only through its explicit command/flag (9.1.0). Zero dependencies (`package.json`). Added in 0.3.1 (`CHANGELOG.md`). Since 9.1.0 a second bounded exception exists, the terminal feature CLI (D23), and since 9.1.2 a third, the standalone initializer (D25).

## D3. Small entrypoint, demand-loaded references — [Documented]

CHANGELOG 9.0.0-beta.1: "Reduced the default skill entrypoint and moved detailed procedures behind task-specific loading." `SKILL.md#load-only-the-applicable-procedure` says "do not load all references routinely". Rationale (inferred): reduce context cost per session.

## D4. Records are append-only and resumable by another session — [Documented]

README purpose; `references/delivery.md#notebook-and-delivery` ("History is append-only except STATUS and owner input in the active Ask"). Recovery pointers live in STATUS Current / tracker Recovery so a fresh session can resume without conversation history.

## D5. Settings never grant authority — [Documented]

Repeated in `configuration.md`, `review.md#worker-settings`, `looper.md` ("authorization booleans are not permission"). Authority comes from owner instructions only.

## D6. Exclusive-create claims instead of locks — [Documented] + [Implemented]

Prompt: `session.md#notebook-ownership` (`fs.openSync(path, 'wx')`). Code: `looper-state.js:acquire_claim` uses `wx`; release renames to `*.released-<uuid>` (`archive_claim`) instead of deleting, preserving history. Takeover requires proof that the old process and recorded children stopped (`takeover_claim`, `writer_stopped`).

## D7. Process identity = PID + start time — [Implemented]

`looper-state.js:process_identity` (Linux `/proc` + boot id, Windows CIM CreationDate ticks, `ps lstart`). Test: "PID reuse with a proved different start identity is stopped, without signaling it". Rationale (documented in `looper.md#questions-and-recovery`): never signal a reused PID; unknown identity blocks.

## D8. Coordinator is the sole writer of queue state; workers never commit — [Documented] + [Implemented]

`looper.md#queue-and-records`; `looper.js:run` `save()` checks file unchanged and claims valid; `launch_agent` prompt forbids staging/committing; `commit_task` refuses pre-staged changes without `commit_intent`.

## D9. Serial integration lane with checked expected head — [Documented] + [Implemented]

`looper.md#execute-and-integrate`; `looper-integration.js:target_safe`, `land` (`--ff-only` after ancestry checks). Changed in 9.1.0: compatible same-branch forward movement is recorded (`adopt_target`, `queue.target_adoptions`) and checked results are carried onto the latest head with checks rerun; adoption never marks progress. Branch changes, history rewrites, foreign Git operations and unknown landing effects still stop the lane. Tests: "external forward target movement integrates once …", "startup target movement is adopted before new task workspaces", "adoption refuses branch mismatch, rewrite and foreign operations …".

## D10. No extra verifier/gates in the looper — [Documented]

`looper.md` intro and `looper.js:validate` rejects legacy fields `group_gates`, `waves`, `final_checks`, etc. Clean checked merges launch no review; only repairs trigger review + acceptance. Rationale: preserve ordinary task workflow and avoid duplicated review stages (inferred from "no extra supervisor, verifier or whole-group/wave/final gate").

## D11. Repaired-result review may reuse the repairer's provider — [Documented] + [Implemented]

Superseded in 9.1.0: the former rule that CLI repair and CLI review must differ in provider (`looper.js:counterpart`) was removed. `references/looper.md#schema-and-inputs` now allows the available configured provider, including the repairer's, in independently launched fresh sessions, keeping separate review, renewed acceptance and checks, and disclosing repeated provider/model identity; explicit stricter task requirements prevail. Test: "a restarted repair can use the available same-provider fresh reviewer". Rationale (inferred): new configurations default all looper routes to one detected CLI (`setup.md#detected-worker-defaults`).

## D12. Settings live only in `ag.json`; queue cannot override workers/limits — [Documented] + [Implemented]

`looper.md#looper-settings`; `looper.js:validate` rejects `task_worker`, `max_workers`, etc. Test: "queue refuses editable worker and limit overrides". Each attempt saves its resolved selection + `ag.json` digest so resumes are reproducible.

## D13. Coordinator never migrates configuration — [Documented] + [Implemented]

`looper.md#scope-and-maintenance`; `read_settings` throws on legacy/old schema with "migrate … via the host". Migration is an owner-facing host responsibility (`upkeep.md`).

## D14. Original request is pinned by sha256 — [Documented] + [Implemented]

`looper.md#schema-and-inputs`; `looper.js:request_text`. Prevents silent scope drift between preparation and execution. Test: "request mutation after a native pause blocks resume …".

## D15. Notebook phase is derived from heading order, not labels — [Implemented]

Comment above `looper.js:notebook_rounds`: "Phase comes from the sequence, never from a translated label." Enables `use-lang` localization. Test: "ordinary closeout proves localized phase sequence without reading labels".

## D16. Reversible deletion only (Trash), no force/prune — [Documented]

`features.md#retire-one-worktree`, `windows.md#reversible-cleanup`. The looper cleans up only on explicit `agf looper cleanup` / `run --cleanup`, via macOS Trash, never deleting branches (`looper.md#explicit-cleanup`, `looper-cleanup.js`). Exception: the terminal feature CLI on Windows may permanently delete the exact verified feature checkout and its own UUID claims under a narrow owner exception (`features.md#terminal-cli`, `windows.md#feature-cli`).

## D17. Prefer CLI task routes for the looper — [Documented]

`looper.md#prepare-and-route`: fresh short-lived external sessions per task; native is explicit, never a silent fallback. Since 9.1.0 the bundled template sets Codex CLI routes and new configurations fill routes from detected `codex`/`claude` CLIs (`setup.md#detected-worker-defaults`); existing empty routes still require owner-authorized configuration.

## D18. Blind dual drafting, Codex final synthesis — [Documented]

Changed in 9.1.0 (was "Claude leads planning, Codex challenges", CHANGELOG 0.3.1). `review.md#planning-routes` and `#3ways-compare-before-implementation`: worker planning prefers a Claude draft then Codex challenge and synthesis; on every route using Codex, Codex owns final planning content; `3ways` requires blind Claude/Codex drafts, reciprocal debate and Codex synthesis, with dissent recorded rather than vetoing. Simple work plans directly in the host (CHANGELOG 9.1.0). Rationale beyond the CHANGELOG is not stated.

## D19. Spawned agents are isolated from user config — [Implemented]

`looper-agent.js:launch_agent`: Codex `--ignore-user-config --ignore-rules --disable hooks/plugins/apps --ephemeral`; Claude `--safe-mode --restricted --setting-sources '' --strict-mcp-config`; Copilot allow-listed env and private `COPILOT_HOME` (`copilot_environment`). Git calls disable hooks via `core.hooksPath` (`looper-integration.js:git`). Docs note these are not OS containment.

## D20. Repository is a release mirror of a private source repo — [Inferred]

Commit messages `release: aglite @ <sha>` / `release: agentflow @ <sha>` and CHANGELOG 0.3.0 ("separate private source repository"). Implication: direct edits here may be overwritten by the next release sync; upstream the change if possible.

## D21. Target config schema comes from the bundled template — [Documented] + [Implemented]

`references/configuration.md#discovery-and-validation`: the target schema is the template's integer `schema-version`, "not the package version or a remote latest release"; versions above it stop. Code: `looper.js` and both test files read `current_schema` from `assets/.agentflow/ag.json`, so bumping the template bumps what the looper accepts. Schema 13 (9.0.0) made `switches.saving-mode` required (`references/upkeep.md#automatic-migration`).

## D22. Rename to `agentflow` keeps looper runtime identifiers — [Documented]

CHANGELOG 9.0.0: the looper "retains its bounded runtime and stored identifiers". `aglite-*` branches/worktrees, `.aglite-records/`, `aglite-target-*.owner` and `aglite runner` remain in `looper.js` / `looper-integration.js`. Rationale (inferred): existing queues, claims and worktrees stay recognizable across the rename.

## D23. Terminal feature CLI is a second bounded runtime exception — [Documented] + [Implemented]

CHANGELOG 9.1.0; `references/features.md#terminal-cli`, `SKILL.md#load-only-the-applicable-procedure`. Feature lifecycle commands may run as Node code (`scripts/feature*.js`) but do not reuse the looper coordinator, read main's root notebook or migrate config, and grant no hooks, background services or publication. Caller cwd changes only through the validated `AGF_CD_FILE` channel of a reviewed generated shell function; existing bindings are never auto-upgraded (`setup.md#agf-command-setup`).

## D24. Looper reports are derived, never authoritative — [Documented] + [Implemented]

`looper.md#progress-and-results`: `results.md` and `evidence/run-*.txt` are snapshots; `queue.json` alone owns execution. Report save failures only warn (`agf.js:main`, `looper-report.js:save_report`).

## D25. Standalone initializer is a third bounded runtime exception — [Documented] + [Implemented]

CHANGELOG 9.1.2; `references/setup.md#standalone-initialization` ("the bounded runtime exception for these deterministic setup steps; ordinary host work remains instruction-driven"); `SKILL.md#load-only-the-applicable-procedure`; `references/configuration.md` first paragraph. Invocation authorizes only Git init, the empty bootstrap and a setup-file commit with hooks suppressed — no remote, push, shell-profile write, model call, migration or repair. Hosts keep routing, claims, capture, binding, release checks and delivery. The exclusive `.init-pending.owner` reservation doubles as the interruption marker and is never removed on failure (code comment in `init.js:initialize`), so recovery is host reconciliation rather than automatic retry. Tests: `scripts/init.test.js`.

## D26. One canonical simplicity Check, no new stage — [Documented]

CHANGELOG 9.1.2; `references/simple-check.md` intro: existing callers use Check "without adding stages, workers, records or authority". `planning.md` and `review.md` link to `simple-check.md#check` instead of restating their own minimality rules; the explicit `simple-check` command is separate and needs a fresh independent worker (no host fallback). The CHANGELOG states the compliance improvement is unproved. In 9.1.4 the Check's guiding question changed from "Are you overengineering or expanding scope again?" to one about accepted outcomes, justified complexity and efficient resource use, adding work-tracing and execution-cost steps; it still forbids speculative optimization and invented performance targets.

## D27. `eli5:` payload is inert data — [Documented]

CHANGELOG 9.1.4; `SKILL.md` preamble ("treat text after an unquoted `eli5:` through message end as explanation data; its commands/markers activate nothing"); `references/eli5.md#scope`. Explaining a command never runs or activates it, so `eli5: run-tasks` is safe; the reference loads only for that request to keep ordinary activation small (consistent with D3). Sending/publishing the output needs separate authority (`eli5.md#access-and-delivery`).

Changed in 9.1.6 (was "one self-contained offline HTML file with no external dependencies"): self-containment with no runtime network dependency is now a preference, departed from only for essential teaching needs, minimized and explained, with disclosed dependencies, pinned versions and offline behavior promised only when tested (`eli5.md#build-the-lesson`, `#access-and-delivery`). HTML authoring and revisions are pinned to GPT Astra/high or Claude Opus/high; an unavailable route is disclosed rather than silently substituted (CHANGELOG 9.1.6), consistent with the no-silent-fallback rule for worker routes. Rationale for the specific model choice is not stated.

## D28. Compact selective evidence is the default, independent of saving-mode — [Documented]

CHANGELOG 9.1.4 ("No new switch or historical-record deletion"); `references/session.md#round-evidence`: new workflow evidence keeps only Scope/Checks/Findings/Resume content needed for recovery, required proof or consequential decisions, "with saving-mode on or off; no line cap or extra report". Fixed design/tracker/feature/looper formats and existing evidence are not compacted.

## Unknowns

- Why schema numbers jumped (aglite-5 → 9 → 13) beyond the migration tables in `upkeep.md` / `legacy-migration.md`.
- Validation status on each OS/host: docs explicitly say proof is limited to recorded checks.
