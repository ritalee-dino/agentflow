# Runtime flows

Paths are relative to `skills/agentflow/scripts/` unless stated. Traced from implementation; policy-only steps are marked *(policy)*.

---

## 1. Startup (`agf start`)

Trigger: host receives `godev` (or any first message) and runs `agf.js start --repo <repo> --host <id> [--session <id>] [--host-family <f>] --message-stdin --json`.

```text
agf.js:main → COMMANDS.start → start_main
  parse_start_args; notebook-owner.js:identity (reject conflicting identity)
  git rev-parse --show-toplevel  → repo root (or plain folder)
  read_start_message (stdin)
  acquire_start_lock   (since 8.4.7 taken before config handling; released if config handling throws)
  no existing lock → audit_start_file(ag.json) → ag-settings.js:audit_template
     added keys → atomic rewrite (switches sorted); invalid values → reported only
  load existing ag.json (ag-settings.js:load_config, safe fallbacks) → target-doc
     unsafe invalid value → error + template suggestions, stop
  linked worktree? → stream_doc + stream ag.json (audited the same way)
  lock already present → resume-intake.js:collect_intake(interrupted_start) → emit result, no writes
  notebook-write.js:acquire_close_round_lock
  notebook-owner.js:guard(allow_missing, resume_unclaimed)   (ownership off: current-Ask check only, no record)
  ag-settings.js:ensure_configuration | initialize_project   (creates ag.json + notebook; audit runs here if not yet done)
  update_ignore_file (.gitignore; prepends only missing defaults, owner bytes preserved since 8.4.8)
  install-hook.js:install (host hooks, quiet; points at the installed skill copy and repairs stale Agentflow commands)
  notebook-compact.js:compact_locked (auto-compaction) → blocked? keep { blocked, message } as compaction
  insert_start_message → into an empty final Ask; into a populated Ask only when the message newly selects fast-lane / skip-ag
  notebook-write.js:capture_input_scope, atomic_replace
  release locks
  resume-intake.js:collect_intake → STATUS, final Ask, changed paths, stream_decision
  start_result → JSON (repository, notebook, git, next_run_id, setup, message, stream_decision, hooks, optional compaction / fast_lane / skip_ag / config_audit {added, invalid})
```

Side effects: may create `ag.json` (or add missing template properties to an existing one), notebook, `.gitignore` entries, `.claude/settings.json` or `.codex/hooks.json`, ownership record. No commit.
Afterwards *(policy)*: answer-recovery gate (`ans:`, inline `-> ask:` / `-> ans:`), then follow-through on any `compaction.blocked` (verify saved answers before `agf compact --include-answered true`), load `references/writing.md`, `closeout.md`, `progress.md` (plus `mixed-requests.md` when triggered), choose route (`direct|selected_advisors|full_pipeline|blocked`).
Tests: `start-journey.test.js`, `agf.test.js`, `resume-intake.test.js`, `git-optional.test.js`.

## 2. Per-message capture (UserPromptSubmit hook)

```text
host hook → stop-hook.js --host <codex|claude> (stdin JSON: hook_event_name, prompt, cwd, session_id, turn_id)
  resolve project dir (CLAUDE_PROJECT_DIR for claude, else input.cwd)
  completion-context.js:no_ag_bypass(prompt) → exit 0, no output, nothing read or written (since 8.4.12)
  resolve notebook: linked worktree → stream notebook; else ag.json target-doc
  no notebook → exit 0
  last round already has Reply → emit notice "not saved", exit 0
  notebook-write.js:append_input(host, session, message_id)   (runs compact_locked; returns compaction when blocked)
     └─ AG_NOTEBOOK_OWNER error → emit ownership notice, exit 0
  fast-lane.js:parse_fast_lane, else parse_skip_ag → optional route notice (fast-lane wins if both)
  stdout: hookSpecificOutput.additionalContext (+ compaction.message when present, since 8.4.14)
```

Hookless hosts run `notebook-write.js append-input --notebook <path> --input-stdin --host <id>` manually. Tests: `stop-hook.test.js`, `notebook-write.test.js`, `notebook-boundary-journey.test.js`, `no-ag-hook.test.js`, `notebook-compact.test.js`.

## 3. Closeout (`agf close`)

Trigger: host pipes the manifest (`version, notebook, ask, run_events, reply, status, allowed_paths, commit_message, delivery`) to `agf close --manifest-stdin`.

```text
agf.js:close_main
  read_close_stdin; ag_settings.duplicate_json_key; JSON.parse
  repository-state.js:detect(cwd)  → git | plain | error
  close_validate_manifest
  push mode requires --push-authorized (and vice versa)
  plain folder:
    notebook-write.js:match_closed_close (retry?) or close_round
  git repo → close_execute:
    read_regular_file (source identity)
    acquire_delivery_lock (<git-common-dir>/agf-delivery.lock)
    push retry with saved close scope → close_push only
    acquire_close_round_lock; notebook-owner.js:guard(allow_closed)
    identity/hash unchanged check (else notebook_stale)
    notebook-write.js:prepare_close_candidate
        notebook-owner guard → render_reply (reply-identity.js stamp) → completion-record.js:publish_reply
        → completion-context.js:validate_candidate → round-linter.js:lint_round
    verify_notebook_unchanged → atomic_replace
    git add allowed paths; git commit (Agentflow-Close-Id trailer)
    save_close_scope; notebook-owner.js:release
    close_push (fetch, branch check, non-force push, verify remote SHA)
  build display.text from saved Reply (inline-reply on) or "<notebook> updated"
```

Errors return JSON `{ok:false, error:{code, message}, recovery}` (`agf.js:set_close_error`) with exit 1 (codes include `invalid_manifest`, `push_not_authorized`, `delivery_lock_busy`, `notebook_lock_busy`, `notebook_stale`). A failed replace is rechecked via `match_closed_close` so a retry is idempotent.
Tests: `agf.test.js`, `notebook-write.test.js`, `no-ag-closeout.test.js`, `close-language-journey.js`.

## 4. Stop-hook referee (end of turn)

```text
host Stop hook → stop-hook.js:main
  stop_hook_active === true → exit 0         (one-correction loop guard)
  AGENTFLOW_EXTERNAL_DELEGATE valid → exit 0  (delegated worker, I-044)
  --host must be codex|claude (I-043)
  input.prompt, else completion-context.js:latest_owner_prompt(transcript_path, session_id)
     no_ag_bypass → exit 0 (since 8.4.12; other session or no current input → ordinary checks)
  resolve notebook (same as capture); missing → exit 0
  only empty bootstrap Ask → exit 0
  closed-round.js:verified_closed_round (Reply + close commit + Agentflow-Close-Id + receipt + committed round text) → exit 0
  completion-context.js:collect(transcript_path, now_ms, require_status_projection)
  round-linter.js:lint_round
    ok   → completion-cleanup.js:sweep_completion_records → exit 0
    fail on completed round → message + exit 2 (host runs one correcting turn)
    fail on active (unfinished) round → warnings, non-blocking
  internal error → fail open
```

Tests: `stop-hook.test.js`, `stop-hook-recovery.test.js`, `closed-round.test.js`, `no-ag-hook.test.js`; PTY `no-ag-hook-journey.js`.

## 5. Delegated worker execution

*(policy: `references/delegation.md`)* The host decides to delegate a bounded slice.

```text
delegation-route.js:select_executor_action(facts)
  policy = allowed-worker + review-policy (+ cli-provider)
  enumerate external / internal / host candidates; skip attempted, disallowed, control mismatch
  review tasks: drop host if a separate reviewer exists; require-independent forbids host
  → selected | selection-required (host must choose) | unsatisfied
external kind → external-runner.js:run_external_command
  prepare_clone (disposable no-remote clone) → worker_environment (filtered env)
  spawn literal command (e.g. codex exec / claude -p) with timeout, bounded output
  process-tree.js: detect/contain nested model processes
  return exit status, output tail, result-file facts, clone changes
next_executor_action → advance only after a settled `unavailable` attempt
validate_execution_record → evidence validated by coordinator; exit status ≠ acceptance
```

Tests: `delegation-route.test.js`, `external-runner.test.js`, `transport-journey.test.js`.

## 6. Queue publication and looper run

```text
make-plans (host, policy) → queue-contract.js:plan_jobs / make_plans → publish_queue
  writes plan-NNN.md privately, moves without overwrite, writes .queue-generation.json last

agf-looper → looper.js:main → run_looper
  lock .looper.lock; get_tasks; queue-contract select_frozen_ready_plans (generated queues)
  standalone: only external capability; unavailable → exit before claim, queue stays pending
  for each ready plan → run_plan:
    reserve_notebook_round (empty next Ask under writer lock, looper identity; ownership off → keeps guard context, no owner record)
    verify_queue_identity (digests)
    executor chosen via delegation-route.js:select_executor_action; write attempt record (.looper-attempt.json)
    start_child spawns the provider CLI in the current checkout (not a clone); stream output; 60 s milestones
    nested model process → quarantine, error
    complete_plan → verify notebook round + completion line → move to planned/done/ → release reservation
Interactive host variant: claim_host_plan → run selected action → finish_host_plan(claim, record)
```

Not supported on native Windows. Tests: `looper.test.js`, `queue-contract.test.js`, `notebook-looper-owner.test.js`; live gate `looper-live-gate.js`.

## 7. Stream lifecycle

```text
agf new <name> [taskkey] [-m ask]   → agf.js:new_main
  validate config; create branch + .worktrees/<taskkey>; copy stream ag.json;
  write <workspace>/features/<taskkey>/<taskkey>.devlog.md (devlog_template); commit; push if remote
agf finish --prep  → finish_main: merge default branch into stream (abort on conflict), push
(host writes closing Reply, STATUS closed, commits)            (policy: references/streams.md)
agf finish --deliver → finish_main: delivery lock; fast-forward default branch locally/remotely
agf cleanup <key> (from main checkout) → clean_main
  stream-cleanup.js:inspect → preserve recognized local files into <git-common-dir>/agentflow-cleanup/...
  merge-preserving cleanup; remove worktree + branch; refuse from inside target worktree (I-058)
agf ditch <key> → ditch_main: confirmed discard, no merge
```

Guard: `devlog-guard.js` pre-commit hook blocks staging the root notebook/config on a feature branch (I-039).
Tests: `agf.test.js`, `streams-off.test.js`, `devlog-guard.test.js`, `branch-safety-terminal.test.js`.

## 8. Notebook compaction

```text
start / capture → notebook-compact.js:compact_locked(force=false) when ≥ 750 lines (since 8.4.10) or ≥ 768 KiB
agf compact → compact (locks + ownership) [--include-answered true]
  select completed rounds in order; stop at the first open round or, unless included,
    the first round with non-empty ans: / -> ask: / -> ans:  → result.blocked + message
  append exact bytes to adjacent archive; verify id, length, SHA-256; then remove live bytes
  blocked → reported as compaction in agf start output and the capture hook notice (since 8.4.14)
```

Tests: `notebook-compact.test.js`, `start-journey.test.js`.

## Error propagation conventions

- CLI modules return exit codes; `agf.js` wraps errors to stderr and exits 1; `agf close` returns structured JSON errors.
- Hooks fail open on internal errors (never trap the host), except a genuine failed completed round (Stop exit 2).
- Diagnostics are bounded (≈4,096 bytes) and sanitized (`agf.js:sanitize_diagnostic`).
- Ownership violations (including a `notebook-ownership` policy change after the guard) throw errors with `code: 'AG_NOTEBOOK_OWNER'`.
- Target-doc rename refuses with `AG_RENAME_CONFIG_CHANGED` when `ag.json` changes mid-rename.
