# Design decisions

Evidence labels:
- **[Documented]** — stated explicitly in repository docs (`SKILL.md`, `references/`, `scripts/README.md`, `CHANGELOG.md`, `incidents-log.md`).
- **[Implemented]** — strongly supported by code structure, not stated as a rationale.
- **[Inferred]** — reasonable interpretation; verify before relying on it.

The richest rationale source is `skills/agentflow/docs/incidents-log.md` (79 incidents, `I-001`…`I-079`). Any rule tagged `— I-NNN` must not be changed until that entry is read (editing guard at the top of the log).

---

## D1. Slim always-loaded prompt; rulebooks load on demand
- **[Documented]** `SKILL.md` "Load rules only when triggered"; `docs/skill-editing-and-compression.md`.
- **[Implemented]** `scripts/prompt-compression.test.js` enforces a 32 KiB budget for `SKILL.md` and that advanced machinery is routed to references.
- Rationale: reduce context cost; compression must not remove controls (I-038, I-051).

## D2. Policy in Markdown, enforcement in deterministic scripts
- **[Documented]** `scripts/README.md`: "These zero-dependency Node scripts ... are not model instructions"; I-071 ("four workflow promises had no enforcing boundary"), I-061 (hook skipped checks that looked enforced).
- **[Implemented]** Linter, ownership guard, and closeout validation run in code; Markdown contract tests keep text and code aligned (`alignment.test.js`).

## D3. Zero dependencies, Node ≥ 18, no build
- **[Documented]** `scripts/README.md` ("zero-dependency Node scripts"), `README.md` (Node 18).
- **[Implemented]** No `package.json`; only `node:` built-ins.
- **[Inferred]** Lets the skill be copied into any host's skills directory and run immediately.

## D4. The notebook is the single authoritative, append-only history
- **[Documented]** `SKILL.md` step 6: completed spans and archived bytes are immutable; STATUS is a mutable projection; only verified byte-preserving compaction may move history.
- **[Implemented]** `notebook-compact.js` verifies id, length, SHA-256 before removing live bytes; I-065 (line-oriented repair changed content).

## D5. One-command startup and closeout
- **[Documented]** `SKILL.md` step 2 and `references/closeout.md`; I-073, I-077 (hand-built calls caused retries).
- **[Implemented]** `agf.js:start_main` and `close_main` perform initialization / validation / replace / commit / push in one call; manifest via stdin only, never temp files.

## D6. Owner text is never interpolated into shell
- **[Documented]** `SKILL.md` "Final safety"; startup uses a single-quoted heredoc on stdin.
- **[Implemented]** `--message-stdin`, `--manifest-stdin`, `--input-stdin`; `external-runner.js:normalize_command` executes literal argument arrays; `install-hook.js` shell-quotes paths (`shell_literal`).

## D7. Single session owner per notebook Ask (optional since 8.4.0)
- **[Documented]** `SKILL.md` step 2; `references/streams.md`; CHANGELOG 8.3.x, 8.4.0.
- **[Implemented]** `notebook-owner.js:guard` in start, capture, writers, close; explicit `agf owner adopt` with hash + token preconditions; never expire by age.
- **[Changed in 8.4.0]** Session enforcement is now opt-in via `switches.notebook-ownership: on`; default `off` for new templates and when absent. `off` keeps file locks, safe paths, current-Ask and unchanged-snapshot checks. CHANGELOG recommends `on` for shared notebooks and states the startup speed gain is unproven.
- Rationale: concurrent CLIs corrupted notebooks (I-018, I-022, I-031, I-039).

## D8. Hooks fail open; block only on a failed completed round
- **[Documented]** `scripts/README.md` (Stop-hook referee section).
- **[Implemented]** `stop-hook.js`: `stop_hook_active` exits 0; delegate marker exits 0 (I-044); installed hooks must pass `--host` (I-043); capture ownership errors become notices.

## D9. Git is optional
- **[Documented]** `SKILL.md` step 2 (`git.state: unavailable`), README install section.
- **[Implemented]** `repository-state.js:detect` → `plain`; `close_main` plain-folder path uses `notebook-write.js:close_round` without commit.

## D10. Streams use worktrees inside the repo; CLI never writes the root notebook
- **[Documented]** `references/streams.md`; I-039 (stream session adopted root devlog), I-058 (cleanup removed running host's folder), I-059 (`agf new` depended on hidden session facts).
- **[Implemented]** `devlog-guard.js` pre-commit guard; `clean_main` refuses from inside target worktree; `stream-cleanup.js` preserves local records before removal.

## D11. Unordered `allowed-worker` permissions; host chooses per task
- **[Documented]** CHANGELOG 8.3.0; `references/ag.md` "Front door and route".
- **[Implemented]** `delegation-route.js:select_executor_action` returns `selection-required` when multiple kinds are eligible; order in the array is explicitly ignored.
- v7 configs migrate conservatively to `["external","host"]` + `require-independent` (`ag-settings.js:migrate_config`).

## D12. External workers run in disposable no-remote clones; exit status is not acceptance
- **[Documented]** `scripts/README.md` (`external-runner.js`); `references/delegation.md`; I-041, I-042, I-045, I-047.
- **[Implemented]** `external-runner.js:prepare_clone`, `worker_environment`, nested-process containment via `process-tree.js`.

## D13. Independent review preferred; host review only after recorded unavailability
- **[Documented]** `README.md`, CHANGELOG 8.3.0/8.3.4, `references/closeout.md`.
- **[Implemented]** `review-policy` handling in `delegation-route.js` and `completion-context.js:review_decision`; `completion-record.js:validate_review_record`.
- Proportional review depth (`cross-check-plan.js`) exists because a narrow change paid for a full repeated review (I-060); recursion guard from I-072.

## D14. Scope discipline: worker/reviewer findings never expand scope
- **[Documented]** `SKILL.md` "Scope and evidence"; `references/ag.md` "Gates and evidence"; I-054, I-062, I-067.
- Policy-only; not mechanically enforced beyond route/record checks.

## D15. Looper changes require a real live gate
- **[Documented]** `references/looper.md` "Changes to looper behavior"; I-064 (fake looper tests accepted broken real-worker contracts).
- **[Implemented]** `scripts/looper-live-gate.js`.

## D16. Local numeric-offset timestamps written by the writer, not the model
- **[Documented]** `SKILL.md` ("the writer supplies RUN numbers, local times"); I-056, I-074, I-075.
- **[Implemented]** `local-time.js:format_local_timestamp`; linter timestamp checks.

## D17. Public mirror; releases generated from a private checkout
- **[Documented]** `SKILL.md` release paragraph (fetch and treat the public branch as authoritative for corrections); scripts README mentions a "private development checkout" with a Windows workflow not present here.
- **[Inferred]** from commit titles `release: agentflow @ <sha>` — this repo receives release snapshots, so large edits here may be overwritten by the next release.

## D18. Portable core, verified integrations only for Codex and Claude
- **[Documented]** `README.md`, CHANGELOG 8.3.0 ("Portable hookless host support").
- **[Implemented]** `install-hook.js` only writes Claude/Codex configs; generic hosts get `hooks: not_available` and manual capture/close instructions.

## D19. Graduated per-Ask opt-outs that are not aliases
- **[Documented]** `references/skip-ag.md`, `SKILL.md`, CHANGELOG 8.4.3: `no-ag` skips the whole protocol; `fast-lane` keeps the notebook but waives AG, delegation, new streams and independent review; `skip-ag` waives only the development pipeline and advisors. None changes `ag.json`; each expires with its Ask.
- **[Implemented]** `fast-lane.js:parse_task_control` shared by `parse_fast_lane` / `parse_skip_ag`; `round-linter.js:lint_round` skips a narrower check set for skip-ag than for fast-lane.

## D20. Startup repairs only missing settings; wrong values need owner permission
- **[Documented]** CHANGELOG 8.4.7; `SKILL.md` step 2 (`config_audit.invalid` → ask before changing); `README.md`; `docs/AG_GUIDE.md` ("Settings are missing or invalid").
- **[Implemented]** `agf.js:start_main` / `audit_start_file` writes only template properties that are absent; `ag-settings.js:audit_template` reports invalid values and applies `safe_start_fallbacks` in memory only; other invalid values stop startup. Explicit settings commands stay strict (`strict_values`).

## D21. A verified close is final for the Stop hook
- **[Documented]** CHANGELOG 8.4.7; `scripts/README.md` (`stop-hook.js`); comment in `closed-round.js` ("A successful close already linted the committed round").
- **[Implemented]** `closed-round.js:verified_closed_round` checked before `completion-context.js:collect` in `stop-hook.js:main`.

## Open / uncertain
- CHANGELOG 8.4.0: native Windows execution of the ownership switch and review-only fixes is stated as unproven.
- Exact semantics of `internal` (native host tool) execution are mostly policy; code validates records but cannot invoke native tools itself.
- CHANGELOG 8.3.4 and 8.4.0 note two unresolved pre-existing assertions. Observed on 2026-09-30 at v8.4.0 (unmodified `SKILL.md`): `prompt-compression.test.js` "the always-loaded skill stays within the retained 32 KiB budget" and "the slim front door retains the owner, scope, evidence, and Git boundaries" fail. Re-observed on 2026-10-01 at v8.4.4 (host env markers unset, native Windows): only the 32 KiB budget assertion fails (`SKILL.md` is 32,953 bytes); the front-door assertion passes. Re-observed on 2026-10-02 at v8.4.7: same single failure (`SKILL.md` is 33,244 bytes).
- CHANGELOG 8.4.3: native Windows and case-sensitive-filesystem checks for its changes are unavailable; no universal host-parity claim.
- CHANGELOG 8.4.5 says the release procedure now requires refreshing `skills/agentflow/docs/agent-brief.md` and checking its published bytes; that procedure and any check for it are not present in this public mirror (presumably in the private checkout).
