# Design decisions

Labels:
- **[Documented]** — stated explicitly in repo docs/prompts/comments (source given).
- **[Implemented]** — strongly supported by code structure/tests.
- **[Inferred]** — deduction; verify before relying on it.

No ADR directory exists; sources are `CHANGELOG.md`, `README.md`, the references and code comments.

## D1. Workflow is instructions-only; no hooks, daemons or helpers — [Documented]

Ordinary behavior is executed by the host with its own tools. Sources: `references/configuration.md` (first paragraph: "Host-driven; no hooks or general runners/helpers"), `references/session.md#notebook-ownership` ("no helper, write lock, heartbeat or daemon"), `references/legacy-migration.md` (migration removes old Agentflow hooks). Consequence: most behavior has no automated tests; correctness depends on host compliance (README "Configuration and limits").

## D2. The looper is a narrow runtime exception — [Documented]

`references/looper.md` intro and `#scope-and-maintenance`: scoped Node coordinator, only `run`/`status`, no cleanup/push/release authority. Zero dependencies (`package.json`). Added in 0.3.1 (`CHANGELOG.md`).

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

`looper.md#execute-and-integrate`; `looper-integration.js:target_safe`, `land` (`--ff-only` after ancestry checks). External target movement stops the lane rather than silently adopting it. Tests: "external target movement stops integration …", "startup target movement blocks only the lane …".

## D10. No extra verifier/gates in the looper — [Documented]

`looper.md` intro and `looper.js:validate` rejects legacy fields `group_gates`, `waves`, `final_checks`, etc. Clean checked merges launch no review; only repairs trigger review + acceptance. Rationale: preserve ordinary task workflow and avoid duplicated review stages (inferred from "no extra supervisor, verifier or whole-group/wave/final gate").

## D11. Repair needs a different reviewer provider — [Implemented]

`looper.js:counterpart` and its use in `invoke('repair')` / `integrate`: CLI repair and CLI review must differ in provider, except Copilot (multi-family; comment above `counterpart`). Test: "a restarted repair cannot select its own CLI provider for a fresh review".

## D12. Settings live only in `ag.json`; queue cannot override workers/limits — [Documented] + [Implemented]

`looper.md#looper-settings`; `looper.js:validate` rejects `task_worker`, `max_workers`, etc. Test: "queue refuses editable worker and limit overrides". Each attempt saves its resolved selection + `ag.json` digest so resumes are reproducible.

## D13. Coordinator never migrates configuration — [Documented] + [Implemented]

`looper.md#scope-and-maintenance`; `read_settings` throws on legacy/old schema with "migrate … via the host". Migration is an owner-facing host responsibility (`upkeep.md`).

## D14. Original request is pinned by sha256 — [Documented] + [Implemented]

`looper.md#schema-and-inputs`; `looper.js:request_text`. Prevents silent scope drift between preparation and execution. Test: "request mutation after a native pause blocks resume …".

## D15. Notebook phase is derived from heading order, not labels — [Implemented]

Comment above `looper.js:notebook_rounds`: "Phase comes from the sequence, never from a translated label." Enables `use-lang` localization. Test: "ordinary closeout proves localized phase sequence without reading labels".

## D16. Reversible deletion only (Trash), no force/prune — [Documented]

`features.md#retire-one-worktree`, `windows.md#reversible-cleanup`. Looper never cleans up worktrees (`looper.md#retained-files`).

## D17. Prefer CLI task routes for the looper — [Documented]

`looper.md#prepare-and-route`: fresh short-lived external sessions per task; native is explicit, never a silent fallback. Bundled `looper-routes` is empty so routes must be configured (`assets/.agentflow/ag.json`).

## D18. Claude leads planning, Codex challenges — [Documented]

`review.md#planning-routes` and `#3ways-compare-before-implementation`; CHANGELOG 0.3.1 "Claude-first plan-order". Rationale beyond preference is not stated.

## D19. Spawned agents are isolated from user config — [Implemented]

`looper-agent.js:launch_agent`: Codex `--ignore-user-config --ignore-rules --disable hooks/plugins/apps --ephemeral`; Claude `--safe-mode --restricted --setting-sources '' --strict-mcp-config`; Copilot allow-listed env and private `COPILOT_HOME` (`copilot_environment`). Git calls disable hooks via `core.hooksPath` (`looper-integration.js:git`). Docs note these are not OS containment.

## D20. Repository is a release mirror of a private source repo — [Inferred]

Commit messages `release: aglite @ <sha>` / `release: agentflow @ <sha>` and CHANGELOG 0.3.0 ("separate private source repository"). Implication: direct edits here may be overwritten by the next release sync; upstream the change if possible.

## D21. Target config schema comes from the bundled template — [Documented] + [Implemented]

`references/configuration.md#discovery-and-validation`: the target schema is the template's integer `schema-version`, "not the package version or a remote latest release"; versions above it stop. Code: `looper.js` and both test files read `current_schema` from `assets/.agentflow/ag.json`, so bumping the template bumps what the looper accepts. Schema 13 (9.0.0) made `switches.saving-mode` required (`references/upkeep.md#automatic-migration`).

## D22. Rename to `agentflow` keeps looper runtime identifiers — [Documented]

CHANGELOG 9.0.0: the looper "retains its bounded runtime and stored identifiers". `aglite-*` branches/worktrees, `.aglite-records/`, `aglite-target-*.owner` and `aglite runner` remain in `looper.js` / `looper-integration.js`. Rationale (inferred): existing queues, claims and worktrees stay recognizable across the rename.

## Unknowns

- Why schema numbers jumped (aglite-5 → 9 → 13) beyond the migration tables in `upkeep.md` / `legacy-migration.md`.
- Validation status on each OS/host: docs explicitly say proof is limited to recorded checks.
