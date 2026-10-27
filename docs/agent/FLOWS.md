# Runtime flows

Flows 1–4 are executed by the host following prompts (no code, no automated tests). Flows 5–8 are implemented in `skills/agentflow/scripts/` and covered by `looper.test.js`. Paths are relative to `skills/agentflow/`.

---

## 1. Host activation (`godev` / any on-record message)

Trigger: owner message in a host that loaded `SKILL.md`.

1. Off-record check: unquoted `nolog:` / `noop:` / `off:` / `skip:` → answer in chat, no notebook access (`SKILL.md#route-before-records` step 1).
2. Isolated looper task? Apply coordinator-supplied overrides (step 2; see flow 6 prompt).
3. Verify physical directory, Git root/branch/worktrees; read `references/configuration.md`; reread live `ag.json` (step 3).
4. Feature lifecycle command or `.wts/` path → `references/features.md`, bypassing the root notebook (step 4).
5. No notebook/history → `references/setup.md`; otherwise bare activation with no work → idle shortcut (ask for next request, no claim) (step 5).
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

## 4. `append-rounds` batch

Trigger: message starting with `append-rounds <work>` / `append-tasks <work>`. Source: `references/batches.md`.

Stage in `Pending batches` (Current-linked) → finish active round incl. delivery → re-verify identity/routing → capture oldest entry into the empty trailing Ask → execute (prefer fresh native worker) → Reply → next.

---

## 5. `agf loop status`

`scripts/agf.js` → `looper.js:status(root)`:
`validate(queue, root, { verify_request: false })` → try `request_text` (errors reported, not thrown) → if `phase === 'running'`, read `.queue.owner` and `looper-state.js:process_alive` → print run/tasks/groups/target/ready/questions/native handoffs/lane error. Never writes. Exit 0.

Test: "invalid selected settings fail before claims; status remains read-only without valid settings".

## 6. Looper run

Trigger: host runs `agf loop run <run-root>` for `run-tasks` / `handle-tasks`. Entry `looper.js:run`.

### 6a. Startup

1. `load(root)` → `validate`: rejects legacy fields, requires schema 2, physical Git-root `repo`, valid `target_branch`, full `base_commit`, authorization booleans, registered checks, `group-NNN.md` files with exactly one `## <task>` heading per task, safe `allowed_paths` (not `.git`/`.wts`/`.aglite-records`), `depends_on` only to earlier groups, no unregistered group files.
2. `request_text`: request file must be regular, UTF-8, sha256 = `request_sha256`.
3. `read_settings(q.repo)`: walks repo for `ag.json` (skips `.git`, `node_modules`, `.aglite-records`, nested checkouts), exactly one canonical config, schema = bundled template `current_schema` (13) or absent, `switches.saving-mode` exactly `on|off`, `looper-limits`. Returns sha256 digest.
4. If any group needs a new task attempt, `select(settings, 'task')` validates routes before any claim/worktree.
5. Claims: `.queue.owner` and `<git-common-dir>/aglite-target-<sha>.owner` via `acquire` (takeover only if old claim process and recorded children are proved stopped).
6. Reconcile: landed-but-unrecorded integration (`phase: landing` and HEAD equals result) → `finished_merge`; `target_safe` → `lane_error`; re-prove done tasks/groups; check notebooks of in-progress groups.
7. Import `inbox/answers.json` (owner-only questions reject `source: host`; conflicting answers rejected).

### 6b. Scheduling loop (`while` in `run`)

- For each group in `pending|working|native` state without a job: skip if unmet `depends_on`, skip if slots (`max_workers`, counting outstanding native handoffs) are full, skip native groups with no inbox response → start `task_job(group)`.
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
→ outcome != pass → question (blocked / needs_owner)
→ ordinary_closeout                    notebook must gain a new completed round + next Ask
→ release_task_claim                   archive .aglite-records/.devlog.md.owner if session == attempt id
→ save commit_intent → commit_task     only in-scope regular files; author "aglite runner"
→ checks(task.checks)                  must not move HEAD or change files
→ task.state = done
```

Prompt content: `SKILL.md` path, original request, session overrides (`ag-dir .aglite-records`, `auto-commit off`, `auto-push off`), `project_context` (rules, invariants, writing, AGENTS.md, contracts), allowed paths, task Markdown, declared checks, prior answers.

### 6d. Integration (`integrate`)

```
prepare_integration   target_safe; worktree .wts/aglite-merge-<run>-<group>-<uuid> at expected_head;
                      git merge --no-ff --no-commit <candidate>; conflicts → phase repair, else commit → phase checks
→ checks(integration_checks ∪ checks of all included tasks)
   fail → phase repair
→ repair (invoke 'repair', bounded by max-repairs; must not change HEAD/index) → commit_repair (no conflict markers)
   → checks → review → acceptance (each may return repair)
→ verified → land: target_safe, ancestry checks, no staged owner edits, phase landing, git merge --ff-only
→ finished_merge: group done, expected_head = result
```

Clean merges with passing checks skip review/acceptance (`attempt.phase = attempt.repaired ? 'review' : 'verified'`).

Tests: "real Git integration preserves disjoint owner edits …", "simultaneously observed readiness uses group ID order …", "failed combined check requires repair, fresh checks, review, then acceptance", "repair cannot commit unresolved conflict markers", "external target movement stops integration …".

## 7. Native handoff

1. Coordinator writes `attempts/<uuid>/assignment.md` and a `handoffs[]` entry; the group keeps its slot.
2. Host reads the assignment, dispatches its own subagent, waits for it and descendants to stop.
3. Host writes `inbox/<uuid>.json` `{attempt_id, outcome, summary, evidence, writer_stopped: true}`.
4. Host reruns `agf loop run`; `invoke` validates with `looper-agent.js:validate_result`. Invalid responses keep the slot reserved and are retried only on the next run.

Tests: "native dispatch waits for exact stopped inbox result and never substitutes CLI", "native outstanding assignments reserve max_workers …", "stopped native handoff resumes exact attempt …".

## 8. Questions and recovery

- Blocked/needs_owner results create `q.questions[]` entries; only that group blocks.
- Host writes `inbox/answers.json` `[{id, answer, source?}]`; next run imports. `source: host` on a CLI task keeps the exact attempt for a technical recheck (`retry_attempt`); `source: owner` drops the attempt (native attempts need `writer_stopped: true`).
- Crash recovery: `commit_intent` lets an interrupted commit finish; `phase: landing` with HEAD at result is recorded once; `phase: prepared` integration requires host reconciliation; unsettled processes set `uncertain` and keep claims.

Tests: "stopped question blocks only its group …", "owner-only worker question rejects host source …", "host corrects technical blocker …", "killed coordinator after actual landing …", "unsettled writer stops subsequent dispatch …", "interrupted prepared integration retry …".

## Error propagation summary

| Where | Behavior |
| --- | --- |
| `validate` / `read_settings` / `select` failures | thrown before claims or worktrees → `agf` exit 1 |
| task failure / blocked result | group question, other groups continue → exit 2 |
| integration failure | group question with `suspended_integration`, or `lane_error` if target unsafe |
| unsettled process (`error.unsettled`) | `uncertain = true`; stop dispatch; claims retained |
| `save()` failure | `persistence_failed`; claims retained |
