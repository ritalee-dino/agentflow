# Feature map

Paths are relative to `skills/agentflow/` unless they start with `docs/` or `.`. Symbols are `const` arrow functions unless noted. Policy = Markdown rules the host follows; Code = enforced by scripts.

---

## 1. Startup / activation (`godev`)

- **Purpose:** initialize or resume the project notebook and record the owner's first message.
- **Trigger:** owner says `godev` (or other skill triggers); host runs `node <skill>/scripts/agf.js start --repo <repo> --host <id> --message-stdin --json`.
- **Entry:** `scripts/agf.js:start_main`.
- **Core path:** `parse_start_args` → `notebook-owner.js:identity` → `ag-settings.js:initialize_project` or `ensure_configuration` → `update_ignore_file` → `install-hook.js:install` → `notebook-compact.js:compact_locked` → `insert_start_message` → `notebook-write.js:atomic_replace` → `resume-intake.js:collect_intake` → `start_result`/`emit_start_result`.
- **Settings audit at start (since 8.4.7):** inside the start lock (skipped when resuming an interrupted start), `audit_start_file` runs `ag-settings.js:audit_template` on the root or stream `ag.json` (not on duplicate-key/unparseable/schema-7 files). Missing template properties are written back atomically (switch keys sorted) and reported in `config_audit.added`; invalid saved values are never rewritten, only reported in `config_audit.invalid` (`path`, `value`, `suggested`). Safe switches (`ask-names`, `git-timeout-ms`, `inline-reply`, `lang`, `large-work-minutes`, `log-verbosity`) use the template value in memory; any other invalid value still fails `load_config`, with the template suggestions appended to the error. `SKILL.md` step 2 tells the host to ask the owner before changing reported values.
- **Route controls at start:** `insert_start_message` also appends a message into a populated Ask when it newly selects `fast-lane` or `skip-ag` (`message.reason` `fast_lane_selected` / `skip_ag_selected`); `start_result` carries `fast_lane` / `skip_ag` from intake when present.
- **Persistence:** creates `ag.json`, `.agentflow/devlog.md`, `.gitignore` entries, host hook config; ownership record in `.agentflow/.tmp/`.
- **Policy:** `SKILL.md` "Start here" (answer-recovery gate, `message.reason` handling).
- **Tests:** `scripts/start-journey.test.js`, `scripts/agf.test.js` (incl. config audit, unsafe-value stop, v7 migration before audit), `scripts/resume-intake.test.js`, `scripts/git-optional.test.js`, `scripts/portable-host.test.js`.

## 2. Message capture

- **Purpose:** save every owner message into the current Ask before acting.
- **Trigger:** host `UserPromptSubmit` hook (Codex/Claude) or manual `notebook-write.js append-input --input-stdin` on hookless hosts.
- **Entry:** `scripts/stop-hook.js:main` (branch `hook_event_name === 'UserPromptSubmit'`); `scripts/notebook-write.js:append_input`, `format_owner_input`.
- **Side effects:** appends `+ <message>` lines; writes input receipt in `<workspace>/.tmp/`; returns hook `additionalContext` notice (including fast-lane notice). Ownership conflicts do not block the prompt (notice only).
- **Tests:** `scripts/notebook-write.test.js`, `scripts/stop-hook.test.js`, `scripts/notebook-boundary-journey.test.js`, `scripts/stop-hook-recovery.test.js`.

## 3. Progress records (RUN / WIP)

- **Purpose:** timestamped progress events and ten-minute owner status checkpoints.
- **Entry:** `scripts/notebook-write.js:append_run`, `append_wip`; tracker via `scripts/tracker-contract.js:template`, `validate`.
- **Controls:** `log-verbosity` (`off|wip|all`) via `ag-settings.js:read_notebook_controls`.
- **Policy:** `references/progress.md`.
- **Tests:** `scripts/log-controls.test.js`, `scripts/notebook-write.test.js`, `scripts/round-linter.test.js`.

## 4. Round closeout (`agf close`)

- **Purpose:** in one command, validate the completed round, write Reply + STATUS + next Ask scaffold, commit, and optionally push.
- **Trigger:** host pipes a JSON manifest to `agf close --manifest-stdin [--push-authorized]`.
- **Entry:** `scripts/agf.js:close_main` → `close_validate_manifest` → `close_execute` (Git) or `notebook-write.js:close_round` (plain folder).
- **Core logic:** `notebook-write.js:prepare_close_candidate` → `completion-record.js:publish_reply` → `completion-context.js:validate_candidate` → `round-linter.js:lint_round`; then `atomic_replace`, `git commit` with `Agentflow-Close-Id` trailer, `save_close_scope`, `notebook-owner.js:release`, `close_push`.
- **Reply stamp:** `notebook-write.js:render_reply` (passes `host` + `session`) → `reply-identity.js:detect_reply_identity` (Codex and, since 8.4.3, Claude transcripts).
- **Idempotency:** `close_find_commit` / `match_closed_close` / `read_close_scope` make retries report the existing commit.
- **Output:** JSON with `display.text` (Reply or `<notebook> updated`, per `inline-reply`).
- **Policy:** `references/closeout.md` (manifest shape, Reply format, review requirements). Since 8.4.6 `[SUMMARY]` holds exactly one bullet per numbered `[FINAL REPORT]` item, in the same order (policy only).
- **Tests:** `scripts/agf.test.js`, `scripts/notebook-write.test.js`, `scripts/close-language-journey.js`, `scripts/no-ag-closeout.test.js`, `scripts/transport-integration.test.js`.

## 5. Stop-hook referee

- **Purpose:** independent end-of-turn check; block (exit 2) only when a completed round fails the linter.
- **Entry:** `scripts/stop-hook.js:main` (installed as `node stop-hook.js --host <codex|claude>`).
- **Core path:** resolve notebook (root or stream) → `closed-round.js:verified_closed_round` (since 8.4.7; a verified closed last round exits 0 without linting, so later working-file edits cannot revoke it) → `completion-context.js:collect` (with transcript, real clock) → `round-linter.js:lint_round` → on pass, `completion-cleanup.js:sweep_completion_records`.
- **Guards:** `stop_hook_active` → exit 0; valid `AGENTFLOW_EXTERNAL_DELEGATE` → exit 0; fails open on internal errors.
- **Tests:** `scripts/stop-hook.test.js`, `scripts/stop-hook-recovery.test.js`, `scripts/closed-round.test.js`, `scripts/long-round-hook-journey.js`.

## 6. Round linter (validation rules)

- **Purpose:** deterministic grading of notebook rounds (timestamps, Reply structure, boundaries, review evidence, push claims, invented Asks, STATUS projection, etc.).
- **Entry:** `scripts/round-linter.js:lint_round`, `parse_devlog`; CLI `round-linter.js <devlog> --context <facts.json>`; wrapper `scripts/terminal-preflight.js:preflight`.
- **Result:** ordered `{checks, ok}`; only `fail` blocks.
- **Tests:** `scripts/round-linter.test.js` (largest), `scripts/terminal-preflight.test.js`.

## 7. Review decision and review records (`cross-check`, `agf review`)

- **Purpose:** decide whether a separate review is required, validate review evidence, allow host fallback only under `prefer-independent`.
- **Entry:** `scripts/agf.js:review_main`; `scripts/completion-context.js:review_decision` (internal); `scripts/round-linter.js:lint_cross_check`; `scripts/completion-record.js:validate_review_record`, `verify_review_files`; depth selector `scripts/cross-check-plan.js:select_cross_check_plan`.
- **Waivers:** `fast-lane`, `no-ag`, exact `skip-review: <tradeoff>`.
- **Review-only rounds:** `round-linter.js:review_only_intent` accepts only bounded owner controls (`review-only`/`3ways`, reviewer selection `reviewer: codex|claude` or `reviewer 用 …`, `target:`, `godev`, exact takeover continuation); quoted, unknown or mixed implementation text is rejected. `lint_cross_check` then lets a `purpose: "review-only"` record keep non-PASS verdicts while source, delivered-scope, report-integrity and independence checks still apply.
- **Policy:** `references/closeout.md`, `references/delegation.md`.
- **Tests:** `scripts/review-policy.test.js`, `scripts/review-only.test.js`, `scripts/review-only-journey.js`, `scripts/cross-check-plan.test.js`, `scripts/completion-record.test.js`.

## 8. Notebook ownership

- **Purpose:** one host+session writes the active Ask; refuse foreign writers.
- **Policy switch:** `switches.notebook-ownership` (`on|off`, default `off`), read via `ag-settings.js:read_notebook_controls`. `location`/`guard` return a context carrying `policy`, `ask`, `identity`. With `off`, `guard` checks only the current Ask (and that it is not completed), never reads or writes the owner record; `verify` re-checks the policy and the notebook's current Ask; `release` and `relocate` leave existing records untouched. `inspect`, `transfer` and `stream-cleanup.js` pass `record_aware: true` to always read records.
- **Entry:** `scripts/notebook-owner.js:guard`, `verify`, `release`, `inspect`, `transfer`, `cli` (`agf owner inspect|adopt`).
- **Callers re-verify** after each guarded step (start, compaction `compact_locked`/`publish_archive`, writers in `notebook-write.js`, `completion-record.js` publication, `agf.js:close_execute`, rename); a policy change mid-operation aborts before publishing.
- **Persistence:** `<workspace>/.tmp/agentflow-owner-<sha256(notebook)>.json` (only written when `on`).
- **Tests:** `scripts/notebook-owner.test.js`, `scripts/notebook-owner-recovery.test.js`, `scripts/notebook-owner-first-stream.test.js`, `scripts/notebook-looper-owner.test.js`, `scripts/ownership-controls.test.js`; PTY journey `scripts/ownership-controls-journey.js`.

## 9. Notebook compaction

- **Purpose:** archive completed rounds when notebook > 1,000 lines or ≥ 768 KiB, byte- and hash-verified.
- **Entry:** `scripts/notebook-compact.js:compact` (CLI `agf compact`), `compact_locked` (auto, from start/capture).
- **Option:** `--include-answered true` to archive rounds with filled `ans:` fields.
- **Tests:** `scripts/notebook-compact.test.js`.

## 10. Settings (`ag.json`)

- **Purpose:** validate, show, change, migrate, rename notebook.
- **Entry:** `scripts/agf.js:settings_main` → `scripts/ag-settings.js` (`validate_config`, `change_configuration`, `apply_changes`, `parse_change_lines`, `rename_target_document`, `migrate_config`, `format_status`, `resolve_worker_tier`).
- **Templates:** `ag-settings.js:host_template_values` (defaults, external worker profiles and model tiers); switch keys alphabetical and include `away-gates: off` since 8.4.7. `canonical_config` also writes switches sorted.
- **Audit vs strict reads:** `audit_template` (template fill + invalid-value report, used by startup). `read_json_config` without `strict_values` substitutes safe fallbacks when validation fails and no property is missing; `agf settings validate|show` and `change_configuration` pass `strict_values: true` and reject any invalid value. Since 8.4.7 `notebook_controls` falls back to defaults for invalid `log-verbosity` / `inline-reply` instead of throwing (invalid `notebook-ownership` still throws).
- **Rename safety:** `rename_target_document_locked` snapshots source and destination `ag.json` text and refuses with `AG_RENAME_CONFIG_CHANGED` if either changed during the rename; ownership context is re-verified before and after the move.
- **Tests:** `scripts/ag-settings.test.js`, `scripts/threeways-tier-journey.js`, `scripts/log-controls.test.js`, `scripts/terminal.test.js` (away-gates PTY).

## 11. Streams (feature worktrees)

- **Purpose:** isolate a feature on a branch in `.worktrees/<taskkey>` with its own notebook + `ag.json`.
- **Triggers:** `new-feature: <name>`, `merge-back`, `cleanup:<taskkey>`; `resume-intake.js:stream_decision` returning `foreign_or_parallel_work`.
- **Entry:** `scripts/agf.js:new_main`, `finish_main` (`--prep`, `--deliver`), `clean_main` (aliases `clean`, `merge`), `ditch_main`; helpers `devlog_template`, `stream_doc`, `acquire_delivery_lock`; `scripts/stream-cleanup.js:inspect`, `preserve`; `scripts/default-branch.js:resolve_default_branch`; guard `scripts/devlog-guard.js:verdict`.
- **Policy:** `references/streams.md`.
- **Tests:** `scripts/agf.test.js`, `scripts/streams-off.test.js`, `scripts/devlog-guard.test.js`, `scripts/default-branch.test.js`, `scripts/branch-safety-terminal.test.js`.

The optional `worktree-local-notebook` switch (v8.5.0, absent = off) supports manually created linked worktrees without an Agentflow stream notebook. `scripts/worktree-local.js:parse_worktree_local_request` accepts on/true outside fenced code in an initial `godev` message. `prepare_request` rejects existing canonical stream notebooks; `notebook-owner.js:worktree_local_paths` requires root `ag.json` and the configured notebook to be untracked, Git-ignored, safe paths outside `<workspace>/features/`. `worktree_local_notebook` is shared by startup, hook routing, notebook guards and active configuration resolution. Startup avoids Git-visible bootstrap changes; capture, progress, compaction and close retain the same local notebook. `resume-intake.js:stream_decision` suppresses only the non-default-branch signal; active streams and unknown changes still trigger normal handling. Main checkouts and plain folders ignore the request. Tests: `scripts/worktree-local.test.js`; PTY: `scripts/worktree-local-journey.js`.

---

## 12. Worker delegation

- **Purpose:** choose and run an executor (external CLI, native host subagent, or host itself) under `allowed-worker` and `review-policy`.
- **Entry:** `scripts/delegation-route.js:select_executor_action`, `next_executor_action`, `validate_execution_record`, CLI `main`; `scripts/external-runner.js:run_external_command`, `prepare_clone`, `worker_environment`; `scripts/process-tree.js:contain_nested_processes`.
- **Profiles:** `ag.json` `external-workers` (`codex exec`, `claude -p`), tiers via `ag-settings.js:resolve_worker_tier`.
- **Policy:** `references/delegation.md`.
- **Tests:** `scripts/delegation-route.test.js`, `scripts/external-runner.test.js`, `scripts/process-tree.test.js`, `scripts/transport-journey.test.js`, `scripts/queue-transports.test.js`; fixture `scripts/fixtures/external-worker.js`.

## 13. AG pipeline, advisors, 3ways

- **Purpose:** multi-stage flow (requirements → codewalk → explore/spike → spec → implementation → security-scan → acceptance → learn) for risky work; `3ways` read-only pre-implementation debate.
- **Trigger:** `ag`, `agentflow`, `all-in`, `make-plans`, `3ways`, `advisors:`; gated by `allow-ag`; overridden for the current Ask by `skip-ag` (section 20).
- **Mostly policy:** `references/ag.md`, `references/advisors/*.md`. Code support: `delegation-route.js:parse_threeways_trigger`, `plan_threeways_debate`, `execute_threeways_debate`; `round-linter.js:parse_advisor_selection`, `lint_route_decision`, pipeline artifact checks.
- **Tests:** `scripts/alignment.test.js`, `scripts/round-linter.test.js`, `scripts/delegation-route.test.js`.

## 14. Frozen queue and looper (`make-plans`, `run-looper`, `run-plans`)

- **Purpose:** publish digest-bound `plan-NNN.md` queues and execute them one at a time with notebook completion proof.
- **Entry:** `scripts/queue-contract.js:make_plans`, `plan_jobs`, `publish_queue`, `select_frozen_ready_plans` (= `select_host_ready_plans`); `scripts/looper.js:main`, `run_looper`, `run_plan`, `reserve_notebook_round`, `complete_plan`, `claim_host_plan`, `finish_host_plan`.
- **Persistence:** `<workspace>/planned/` (+ `done/`), `.queue-generation.json`, `.looper.lock`, `.looper-attempt.json`, `.stop.txt`.
- **Policy:** `references/looper.md`, `references/ag.md` (queue section).
- **Tests:** `scripts/looper.test.js`, `scripts/queue-contract.test.js`, `scripts/queue-routing.test.js`, `scripts/looper-live-gate.test.js`; mandatory live gate `scripts/looper-live-gate.js`.

## 15. Fast-lane

- **Purpose:** keep a task with the host, waive AG/delegation/independent review, keep self-review and checks.
- **Entry:** `scripts/fast-lane.js:parse_fast_lane`; consumers `round-linter.js:lint_round` (`workflow_check` skip), `completion-context.js:review_decision`, `stop-hook.js`.
- **Policy:** `references/fast-lane.md`.
- **Tests:** `scripts/fast-lane.test.js`.

## 16. Install, setup, hooks, uninstall

- **Entry:** `scripts/setup.js:main` (`agf setup [--fix]`), `scripts/install-hook.js:install`, `inspect` (`agf hooks`), `scripts/agf.js:uninstall_main`, `init_main`.
- **Side effects:** edits shell rc files (with backup), `.claude/settings.json`, `.codex/hooks.json`, `.git/hooks/pre-commit`.
- **Tests:** `scripts/setup.test.js`, `scripts/install-hook.test.js`.

## 17. Completion records and cleanup

- **Entry:** `scripts/completion-record.js:location`, `publish_reply`, `read_metadata`; `scripts/completion-cleanup.js:sweep_completion_records`.
- **Controls:** `completion-cleanup`, `completion-cleanup-interval-days`.
- **Reference versions:** `publish_reply` writes reference `version: 2` (metadata-block removal joins paragraphs with one blank line); `read_reference` accepts 1 and 2, and retries against a version-1 reference keep the original spacing so completed Reply bytes are not rewritten.
- **Tests:** `scripts/completion-record.test.js`, `scripts/completion-cleanup.test.js`, `scripts/completion-cleanup-integration.test.js`.

## 18. Skills audit

- **Entry:** `scripts/skills-audit.js:inventory`, `main` (`agf skills audit [--json]`).
- **Policy:** `references/skill-conflicts.md`.
- **Tests:** `scripts/skills-audit.test.js`, `scripts/skills-audit-journey.py`.

## 19. Writing styles and `show-diff`

- Policy only: `references/writing.md`, `SKILL.md` "Writing styles protocol". Protected by `scripts/prompt-compression.test.js`, `scripts/language-contract.test.js`.

## 20. Skip-ag (added 8.4.3)

- **Purpose:** skip only the development pipeline and advisors for the current Ask; keep devlog records, normal independent review, ordinary delegation, streams and closeout. Does not change `ag.json`; expires when the Ask closes. Distinct from `fast-lane` (also waives delegation/streams/independent review) and `no-ag` (skips the whole protocol).
- **Trigger:** owner line `skip-ag [task]` or `/skip-ag [task]`; bare command = `pending` (wait for a task, no closing Reply). Quoted/fenced examples, mentions and `skip-ag: on` do not count.
- **Entry:** `scripts/fast-lane.js:parse_skip_ag`; consumers `agf.js:insert_start_message`/`start_result`, `resume-intake.js:collect_intake` (`skip_ag`), `stop-hook.js` (UserPromptSubmit route notice), `round-linter.js:lint_round`.
- **Linter effect:** `workflow_check` skips `large_work_route`, `queue_contract`, `security_disposition`, `acceptance_disposition`, `pipeline_artifacts`, `quality_gate`; `route_decision` fails on `selected_advisors`/`full_pipeline` and otherwise calls `lint_route_decision(..., { skip_pipeline: true })`; `skip_ag_task` fails if a pending skip-ag round has a Reply. `executor_decision` and review checks still run.
- **Policy:** `references/skip-ag.md`; mentioned in `SKILL.md`, `references/ag.md`, `closeout.md`, `delegation.md`, `fast-lane.md`.
- **Tests:** `scripts/fast-lane.test.js` (skip-ag cases), `scripts/terminal.test.js` (PTY, both hosts), `scripts/alignment.test.js` (documentation presence).

## 21. Away gates (`away-gates` switch, added 8.4.5)

- **Purpose:** let Agentflow supply Design Go and Result Go for consequential work after the normal evidence passes, project-wide, instead of per Ask with `away: gates`. Does not override Stop, owner-only choices or failed checks.
- **Config:** optional `switches.away-gates` `on|off`, absent = `off` (`ag-settings.js:switch_display_value`, `validate_switches`).
- **Entry:** `scripts/completion-context.js:collect` reads `away-gates` from the active `ag.json` into the lint context → `scripts/round-linter.js:lint_quality_gate` treats `metadata_context['away-gates'] === 'on'` as authorization (alternative to `facts.away_gates` + exact Ask line `away: gates`), including for the renewed Design Go after a repeated concept. Since 8.4.5 a `journey.red_proven` / `green_proven` of `false` fails the gate.
- **Policy:** `SKILL.md` (consequential work, controls list) — rule tagged I-067; `docs/AG_GUIDE.md`.
- **Tests:** `scripts/round-linter.test.js` (`quality_gate accepts configured away-gates on ...`, `configured away-gates supplies the renewed Design Go ...`), `scripts/completion-context.test.js`, `scripts/ag-settings.test.js`, `scripts/terminal.test.js`.
