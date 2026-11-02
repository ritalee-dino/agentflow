# Runtime flows

Flows 1–4 are executed by the host following prompts (no code, no automated tests). Flows 5–11 are implemented in `skills/agentflow/scripts/` and covered by `looper*.test.js` / `feature*.test.js` / `init.test.js`. Paths are relative to `skills/agentflow/`.

---

## 1. Host activation (`godev` / any on-record message)

Trigger: owner message in a host that loaded `SKILL.md`.

Pre-step (9.1.4, `SKILL.md` preamble): text after an unquoted `eli5:` through message end is set aside as explanation data before marker/command detection; steps 1–6 apply only to the preceding instructions, and `references/eli5.md` loads after routing (FEATURES F16).

1. Off-record check: unquoted `nolog:` / `noop:` / `off:` / `skip:` → answer in chat, no notebook access (`SKILL.md#route-before-records` step 1).
2. Isolated looper task? Apply coordinator-supplied overrides (step 2; see flow 6 prompt).
3. Verify physical directory, Git root/branch/worktrees; read `references/configuration.md`; reread live `ag.json` (step 3).
4. Feature lifecycle command or `.wts/` path → `references/features.md`, bypassing the root notebook (step 4).
5. Retained `<ag-dir>/.init-pending.owner` (also the default `.agentflow` when different) → initializer recovery first, blocking dependent work (`setup.md#standalone-initialization`). No notebook/history → `references/setup.md` (supported fresh Git setup runs `agf init`, flow 11); otherwise bare activation with no work → idle shortcut (ask for next request, no claim) (step 5).
6. Owned work → `references/session.md`: claim → recover → capture owner input → project rules/invariants → task work (step 6).
7. Owner-facing host also runs the release check when `next_update_date` is due (`configuration.md#session-release-check`).

## 2. Owned round: claim → work → closeout → delivery

Trigger: actual task or Q&A on-record.

```
resolve notebook path
→ create .<notebook>.owner with wx  {session, ask, claimed_at}     session.md#notebook-ownership
→ read active Ask, STATUS Current, tracker Recovery, evidence       session.md#activate-and-recover step 3
→ capture unrecorded owner messages with "+ " prefix                step 4
→ read project rules, sys-invariants                                step 5
→ planning criteria / gates                                         planning.md
→ execute (work.md), optional delegation/review (review.md)
→ render Reply + next Ask + STATUS in one write                     delivery.md#notebook-and-delivery
→ task commit → owner-edit commit → push (if switches on)          delivery.md#git-delivery
→ settle workers, release own claim                                 session.md#notebook-ownership
→ chat: "→ Updated: A-NNN | <notebook>" receipt (inline-reply off)
```

Failure paths: foreign/malformed claim blocks immediately; late conflict retries 60/120/180 s; blocked delivery saves recovery in Current/tracker and still releases the claim when processes are settled.

## 3. Feature worktree lifecycle

Trigger: `new-feature <name>`, `merge-feature <name> [and cleanup]`, `drop-feature <name>`. Source: `references/features.md`.

- **new-feature**: verify main → if main has no HEAD, apply `setup.md#empty-bootstrap` only → `git worktree add -b feature/<name> <main>/.wts/ft-<name> <main-tip>` → reserve feature notebook claim → initialize `<ag-dir>/features/<name>/<name>.devlog.md` (and config if absent) → close preparation Ask with handoff → display 3-step handoff (`/cd <path>` then `godev`). No commit (except that empty bootstrap) or push. Main root notebook untouched.
- **merge-feature**: claim feature notebook → commit verified feature paths → `git merge --no-ff` when safe, else scoped merge via `git merge-tree --write-tree` + `commit-tree` + CAS `git update-ref` excluding main notebook paths → validate combined main → mark `Stream: merged`, `Session: retired` → gates → optional cleanup (Trash, `git worktree remove`, `git branch -d`).
- **drop-feature**: inspect contents/claims → move checkout to Trash → `git worktree remove` → `git branch -D` → report in chat (no durable record).
- Side effects are local Git only; directory switch requires the owner to run `/cd` (host never simulates it).
- The terminal equivalents (`agf new-feature|merge-feature|drop-feature`) are code, not this prompt flow; see flow 10.

## 4. `append-rounds` batch

Trigger: message starting with `append-rounds <work>` / `append-tasks <work>`. Source: `references/batches.md`.

Stage in `Pending batches` (Current-linked) → finish active round incl. delivery → re-verify identity/routing → capture oldest entry into the empty trailing Ask → execute (prefer fresh native worker) → Reply → next.

---

## 5. `agf looper status`

`scripts/agf.js:main` → `looper.js:status(root)`:
`validate(queue, root, { verify_request: false })` → try `request_text` (errors reported, not thrown) → if `phase === 'running'`, read `.queue.owner` and `looper-state.js:process_alive` → observe actual target (`looper-integration.js:target_identity`) → print run/tasks/groups/expected vs actual target/adoption count/ready/questions/native handoffs, then `looper-report.js:details` (locale from `use-lang` when settings are readable; output/recovery/cleanup paths). Never writes. Exit 0; on error `agf` prints a status hint and exits 1.

Test: "invalid selected settings fail before claims; status remains read-only without valid settings".

## 6. Looper run

Trigger: host (or owner in a terminal) runs `agf looper run <run-root> [--cleanup]` for `run-tasks` / `handle-tasks`. `agf.js:main` reads `use-lang` (failures only affect presentation), starts a `looper-report.js:observer` (stderr progress on every `save()` via `options.on_save`, 30 s heartbeat), then calls `looper.js:run`. After settlement it optionally runs cleanup (flow 9), writes `results.md` + `evidence/run-*.txt` (`save_report`), and prints the summary to stdout.

### 6a. Startup

0. If `queue.cleanup` exists, `looper-cleanup.js:assert_completed` + matching completed cleanup → return 0 without settings, claims or workers.
1. `load(root)` → `validate`: rejects legacy fields, requires schema 2, physical Git-root `repo`, valid `target_branch`, full `base_commit`, authorization booleans, registered checks, `group-NNN.md` files with exactly one `## <task>` heading per task, safe `allowed_paths` (not `.git`/`.wts`/`.aglite-records`), `depends_on` only to earlier groups, no unregistered group files.
2. `request_text`: request file must be regular, UTF-8, sha256 = `request_sha256`.
3. `read_settings(q.repo)`: walks repo for `ag.json` (skips `.git`, `node_modules`, `.aglite-records`, nested checkouts), exactly one canonical config, schema = bundled template `current_schema` (13) or absent, `switches.saving-mode` exactly `on|off`, `looper-limits`. Returns sha256 digest.
4. If any group needs a new task attempt, `select(settings, 'task')` validates routes before any claim/worktree.
5. Claims: `.queue.owner` and `<git-common-dir>/aglite-target-<sha>.owner` via `acquire` (takeover only if old claim process and recorded children are proved stopped).
6. Reconcile: landed-but-unrecorded integration (`phase: landing` and `looper-integration.js:landing_applied` — result is an ancestor of the target, otherwise a saved reflog-coverage digest must prove it was never applied) → `finished_merge`; `adopt_target(q, save, 'startup')` records compatible forward movement, failure → `lane_error`; re-prove done tasks/groups; resume pending ordinary-review handoffs; check notebooks of in-progress groups.
7. Import `inbox/answers.json` (owner-only questions reject `source: host`; conflicting answers rejected).

### 6b. Scheduling loop (`while` in `run`)

- For each group in `pending|working|native` state without a job: skip if unmet `depends_on`, skip if slots (`max_workers`, counting outstanding native handoffs) are full, skip native groups with no inbox response → start `task_job(group)`. A group without a workspace first calls `adopt_target(q, save, 'workspace dispatch')`, so new groups start on the latest adopted head.
- If no merge running, no lane error and `ready` non-empty → `integrate(q.ready[0])`.
- `collect()` processes finished jobs in group-ID order: errors/blocked → `question()` (group `blocked`), native pending → `native`, finished group → `ready` (FIFO append).
- Exit when no jobs/merge remain; phase = `complete` (exit 0) / `stopped` / `blocked` (exit 2). `finally`: abort, wait, release both claims unless writers are uncertain or persistence failed.

### 6c. Task job (`task_job`)

```
looper-integration.js:prepare_group   create .wts/aglite-<run>-<group> on branch from expected_head; add .aglite-records excludes
→ create .aglite-records/ (no notebook scaffold)
→ write inputs/<group>-<task>.md from task_text (wx)
→ invoke('task')                       select route, save attempt {id, selection, expected_head, previous_round}
   ├─ native: write attempts/<id>/assignment.md, add handoff, return null until inbox/<id>.json exists
   └─ cli:    looper-agent.js:launch_agent → execute (20 min timeout) → parse result
              (failures after attempt-dir creation save attempts/<id>/failure.json)
              while running, serve_review polls .aglite-records/ordinary-review/<id>/request.json:
              hash-bound request → invoke('review') fresh read-only sibling → result back to task
→ outcome != pass → question (blocked / needs_owner)
→ ordinary_review_proof               latest relayed review passed on unchanged source (if any were requested)
→ ordinary_closeout                    notebook must gain a new completed round + next Ask
→ release_task_claim                   archive .aglite-records/.devlog.md.owner if session == attempt id
→ save commit_intent → commit_task     only in-scope regular files; author "aglite runner"
→ checks(task.checks)                  must not move HEAD or change files
→ task.state = done
```

Prompt content: `SKILL.md` path, original request, session overrides (`ag-dir .aglite-records`, `auto-commit off`, `auto-push off`), `project_context` (rules, invariants, writing, AGENTS.md, contracts at `base_commit`), changed contract/AGENTS.md text at the workspace base (`contract_changes`, as data), allowed paths, task Markdown, declared checks, prior answers.

### 6d. Integration (`integrate`)

```
adopt_target          'integration start'; record compatible forward target advance
→ prepare_integration target_safe; worktree .wts/aglite-merge-<run>-<group>-<uuid> at expected_head;
                      git merge --no-ff --no-commit <candidate>; conflicts → phase repair, else commit → phase checks
→ checks(integration_checks ∪ checks of all included tasks)
   fail → phase repair
→ repair (invoke 'repair', bounded by max-repairs; must not change HEAD/index) → commit_repair (no conflict markers)
   → checks → review → acceptance (each may return repair)
→ verified → before landing: adopt_target; if the target advanced, carry the checked result into a new
             merge attempt on the latest head (old attempt kept in integration_history) and rerun checks
→ land: target_safe, ancestry checks, no staged owner edits, phase landing (+ landing_reflog), git merge --ff-only
          (race-refused fast-forward → adopt + carry forward, not charged to max-repairs)
→ finished_merge: group done, expected_head = result
```

Clean merges with passing checks skip review/acceptance unless contracts changed (`attempt.phase = attempt.repaired || <contract_changes with unaccepted signature> ? 'review' : 'verified'`). Branch change, rewrite or foreign Git operation during adoption → `lane_error`.

Tests: "real Git integration preserves disjoint owner edits …", "simultaneously observed readiness uses group ID order …", "failed combined check requires repair, fresh checks, review, then acceptance", "repair cannot commit unresolved conflict markers", "external forward target movement integrates once …", "adoption refuses branch mismatch, rewrite and foreign operations …", "changed contracts receive original/current context …", "ordinary review relay preserves configured fresh CLI selection …".

## 7. Native handoff

1. Coordinator writes `attempts/<uuid>/assignment.md` and a `handoffs[]` entry; the group keeps its slot.
2. Host reads the assignment, dispatches its own subagent, waits for it and descendants to stop.
3. Host writes `inbox/<uuid>.json` `{attempt_id, outcome, summary, evidence, writer_stopped: true}`.
4. Host reruns `agf looper run`; `invoke` validates with `looper-agent.js:validate_result`. Invalid responses keep the slot reserved and are retried only on the next run.

Tests: "native dispatch waits for exact stopped inbox result and never substitutes CLI", "native outstanding assignments reserve max_workers …", "stopped native handoff resumes exact attempt …".

## 8. Questions and recovery

- Blocked/needs_owner results create `q.questions[]` entries; only that group blocks.
- Host writes `inbox/answers.json` `[{id, answer, source?}]`; next run imports. `source: host` on a CLI task keeps the exact attempt for a technical recheck (`retry_attempt`); `source: owner` drops the attempt (native attempts need `writer_stopped: true`).
- A nested ordinary-review handoff that was never dispatched may be cancelled with host-attested `outcome: "blocked", dispatched: false` (no `writer_stopped`).
- Crash recovery: `commit_intent` lets an interrupted commit finish; `phase: landing` whose result is already in the target is recorded once, otherwise reflog coverage must prove it was never applied before carrying forward (removed result/unknown effect blocks); `phase: prepared` integration requires host reconciliation; unsettled processes set `uncertain` and keep claims.

Tests: "stopped question blocks only its group …", "owner-only worker question rejects host source …", "host corrects technical blocker …", "killed coordinator after actual landing …", "unsettled writer stops subsequent dispatch …", "interrupted prepared integration retry …", "landing recovery recognizes result ancestor and refuses landed then removed history", "unapplied landing intent carries forward with covering reflog …".

## 9. Explicit looper cleanup

Trigger: `agf looper cleanup <run-root>` (root required), or `agf looper run … --cleanup` after `run` returned 0. Entry `looper-cleanup.js:cleanup`. Contract `references/looper.md#explicit-cleanup`.

```
load queue → assert_completed (all groups/tasks done, passing integration/check evidence)
→ macOS only: /usr/bin/trash + same-volume ~/.Trash (else refuse)
→ acquire .queue.owner + target claim; target ancestry; refuse live/foreign claims, dirty or locked worktrees,
  active notebook markers, unsafe links, nested checkouts, declared-output overlap
→ save queue.cleanup intent before each move / Trash call / exact `git worktree` unregistration
→ move generated worktrees and all run-root extras into a UUID bundle → Trash; verify recoverable location
→ keep queue.json, request and group files; never delete branches
→ final sweep, retire queue claim by rename into Trash; state complete
```

Exit 0 on complete (idempotent repeat), else 1. A later `run` on a cleaned queue returns 0 without workers (flow 6a step 0). Tests: `scripts/looper-cleanup.test.js` ("completed cleanup retains only queue/request/plans …", "dirty, live claim, unfinished and output overlap refuse before movement", "provider moves then throws …").

## 10. Terminal feature CLI

Trigger: `agf new-feature|merge-feature|drop-feature` (or `newft`/`mergeft`/`dropft`) in a shell. Contract `references/features.md#terminal-cli`.

```
agf.js:main  validate argv/flags/name → feature-shell.js:channel(AGF_CD_FILE) → AbortController on SIGINT/SIGTERM
→ feature.js:create | feature-merge.js:merge | feature.js:drop
→ print message; on success write destination (+ hint if AGF_CD_HINT=1) to AGF_CD_FILE,
  or print a cd / Set-Location continuation when no channel
→ generated shell function cds only after exit 0 and a valid destination
```

- **create**: `feature-common.js:context` (primary registered main, `.wts/ft-<name>`, `feature/<name>`) → `git worktree add -b` from main tip → UUID claim → scaffold or resume feature notebook (en/zh-TW) → copy inherited config if absent → release claim → optional `--open` with `default-editor` (failure only warns).
- **merge**: claim → snapshot/commit feature records plus `--include` paths → scoped candidate (temporary index, `commit-tree`, `merge-tree --write-tree`) excluding main root records → conflicts → `codex exec` in a `.merge-*` checkout (conflict paths only) → checks (10 min each) → candidate commit with original parents → apply to main index/worktree → CAS `git update-ref` → checks on main → gates on → stop → retirement STATUS → optional `--cleanup` (`feature-common.js:retire`) → auto-commit → auto-push. Every phase is saved in `merge-state.json` (`prepared → conflict → checking → ready → applied → integrated → retired → delivered → complete`) so a repeat of the same command resumes.
- **drop**: already absent → no-op message; merged CLI records without `--abandon` → directs to `merge-feature --cleanup`; else `retire` (default requires merged history and no local data; `--abandon` discards).

Tests: `scripts/feature.test.js`, `scripts/feature-merge.test.js`, `scripts/feature-shell.test.js` ("dispatcher validates before effects, routes aliases, and publishes only success", "real terminal CLI aliases create, snapshot, merge and clean up …").

## 11. Standalone initializer (`agf init`, 9.1.2)

Trigger: owner runs `agf init [--lang <locale>]` in a shell, or the host runs it during eligible fresh Git setup (`setup.md#first-time-setup`). Contract `references/setup.md#standalone-initialization`.

```
agf.js:main            argv must be exactly `init` or `init --lang <tag>`; else usage, exit 1, no writes
→ init.js:initialize   Node ≥ 20; physical cwd
→ locale(lang)         --lang or OS locale; en/zh-TW kept, other zh → zh-tw, other valid → en-us, malformed → stop
→ feature-common.js:discover(absent allowed, diagnosticLocale)   ambiguous/unresolved → bounded en/zh-TW warning, stop
→ repository()
→ config exists?       no .owner/symlinks under ag-dir + complete() → "Already initialized", exit 0, no changes
→ scan()               existing devlog/archive/backlog/registry/.owner/.agentflow/.aglite-records → stop
→ AGENTS checks, detect() routes, preflight (recorded history, Git identity, git init if non-Git, check-ignore)
→ mkdir .agentflow + write .init-pending.owner (wx)        reservation = interruption marker
→ empty bootstrap commit if no HEAD
→ write scaffolds (wx) + AGENTS adoption (temp file + rename, mode preserved) → complete()
→ auto-commit on: git add + commit --only "chore: initialize agentflow" of generated paths; verify parents/paths/index
→ rename marker to .git/agf-init-completed-<uuid>.json; print invariant notice + "write the next request in A-002"
```

Any error after the reservation keeps `.init-pending.owner` and appends a host-reconciliation hint (exit 1); the next host activation must reconcile it before setup/idle/claim (flow 1 step 5). After success the host rereads `use-lang`, claims A-002 and finishes binding, release-check and delivery duties.

Tests: `scripts/init.test.js` ("unborn Git bootstrap, generated-only commit …", "complete custom canonical setup remains byte/index/HEAD no-op", "bootstrap failure retains explicit partial reservation …", "concurrent real processes cannot compete for scaffolds", "CLI validates init arguments before writes", "discovery warning explains parent-directory risk with bounded examples in both languages").

## Error propagation summary

| Where | Behavior |
| --- | --- |
| `validate` / `read_settings` / `select` failures | thrown before claims or worktrees → `agf` exit 1 |
| task failure / blocked result | group question, other groups continue → exit 2 |
| integration failure | group question with `suspended_integration`, or `lane_error` if target unsafe (branch change, rewrite, foreign operation, missing completed integration) |
| unsettled process (`error.unsettled`) | `uncertain = true`; stop dispatch; claims retained |
| `save()` failure | `persistence_failed`; claims retained |
| report save failure (`results.md` / `evidence/run-*.txt`) | warning on stderr; exit code and scheduling unchanged |
| `run --cleanup` cleanup failure after task success | both reported; exit 1; retry with `agf looper cleanup` |
| feature CLI error | message + retained-state/recovery hint on stderr; exit 1; no cwd change |
| config discovery ambiguity (`feature-common.js:discover`, used by `agf init` and the feature CLI) | bounded multi-line warning (checked dir, counts, ≤ 3 examples, next actions) before any write; exit 1 |
| `agf init` error | message on stderr, exit 1; after reservation `.init-pending.owner` is retained for host reconciliation (never deleted or retried automatically) |
