# Glossary

Terms as used in this repository. Primary definitions live in `skills/agentflow/SKILL.md` and `skills/agentflow/references/*.md`.

**Owner** — the human user who authors requests. Owner text is authoritative for scope; the agent must not invent owner content.

**Host** — the interactive AI assistant running the skill (Codex, Claude Code, or a generic host identified by a safe ID). Also called the *coordinator*. Passed as `--host <safe-id>`; Codex/Claude also carry `--host-family`. See `ag-settings.js:detect_host`, `normalise_host`.

**Session** — host session identity used for ownership (`--session`, `AGENTFLOW_SESSION_ID`, `CODEX_THREAD_ID`/`CODEX_SESSION_ID`, `CLAUDE_CODE_SESSION_ID`).

**Notebook / devlog / target-doc** — the tracked Markdown file holding all conversation history; default `.agentflow/devlog.md`, configured by `switches.target-doc`. Written only by `scripts/notebook-write.js`.

**STATUS** — the mutable header block (`# STATUS`, Project, Notebook, Current commit, Proven, Open, Next, Artifacts, Archived eras, Streams). A recovery *projection*, not settings storage. Format: `ag-settings.js:format_status`; validated by `validate_status_projection`.

**Ask (`A-NNN`)** — one round, opened by the heading `# → Ask / A-NNN` (optionally `(name)` when `ask-names: on`). Owner messages appear as `+ <text>` lines. Parsed by `round-linter.js:parse_devlog`; final Ask via `resume-intake.js:final_ask_span`.

**RUN (`RUN-NNN`)** — numbered, timestamped progress event inside an Ask (routes, dispatches, gates, results). `notebook-write.js:append_run`.

**WIP** — owner-facing status checkpoint, at least every ten active minutes during long work. `append_wip`.

**Reply** — the saved final answer for an Ask (`# ← Reply / A-NNN`), with `## [SUMMARY]`, `## [FINAL REPORT]`, `## Questions`. Written at closeout.

**Round** — Ask + RUN/WIP + Reply. Completed rounds are immutable history.

**Closeout / close manifest** — the JSON passed to `agf close --manifest-stdin` (`version, notebook, ask, run_events, reply, status, allowed_paths, commit_message, delivery`). `agf.js:close_main`.

**`Agentflow-Close-Id`** — commit trailer that makes closeout retries idempotent.

**`ans:` field** — inline answer slot under a question; unhandled answers must be carried forward (answer-recovery gate).

**Archive / compaction** — moving completed rounds byte-for-byte into the adjacent `*.archive.md`. `notebook-compact.js`. "Archived eras" in STATUS points to it.

**Ownership / owner token** — local record binding the active Ask to one host+session. `notebook-owner.js`; stored under `<workspace>/.tmp/`. Adopt via `agf owner adopt`. Enforced only when `switches.notebook-ownership: on` (default `off` since 8.4.0); with `off`, existing records are left untouched and not claimed.

**`notebook-ownership`** — optional `on|off` switch (default `off`, `ag-settings.js:notebook_control_defaults`). `off` keeps caller identity, file locks, safe paths and current-Ask checks but lets sessions mix work in one notebook. A policy change mid-operation aborts the write.

**Workspace dir** — `switches.workspace-dir`, default `.agentflow`; contains notebook, `artifacts/`, `features/`, `planned/`, `.tmp/`.

**Work root / work key** — per-task artifact directory `<workspace>/artifacts/A-NNN-<name>/` (or under a stream's feature dir).

**Stream** — feature workspace = Git branch + `.worktrees/<taskkey>` + stream notebook `<workspace>/features/<taskkey>/<taskkey>.devlog.md` + adjacent `ag.json`. Managed by `agf new|finish|cleanup|ditch`. **Taskkey** is its kebab-case identifier.

**`stream_decision`** — startup classification: `none`, `owner_input_only`, `bootstrap_files_only`, `foreign_or_parallel_work`. `resume-intake.js:stream_decision`.

**Main checkout** — the primary (non-worktree) checkout; only it writes the root notebook.

**Route** — the host's planning choice per Ask: `direct`, `selected_advisors`, `full_pipeline`, `blocked` (policy in `SKILL.md`, `references/ag.md`; checked by `round-linter.js:lint_route_decision`).

**AG / pipeline** — the full multi-stage workflow (requirements → codewalk → explore/spike → spec → implementation → security-scan → acceptance → learn). Triggered by `ag`, `agentflow`, `all-in`; permitted by `allow-ag: on|ask|off`.

**Advisor** — a pipeline role prompt in `references/advisors/*.md`, run by a worker.

**Pipeline role / tier** — `ag.json` `pipeline-roles` maps each role to a tier (`best`, `better`, `basic`, `cheap`, or `off`). Tiers map to `<model>/<effort>` in each external-worker profile. `ag-settings.js:resolve_worker_tier`.

**3ways / threeways** — a single read-only pre-implementation debate review; allowed even when `allow-ag: off`. `delegation-route.js:plan_threeways_debate`.

**Worker kinds** — `external` (separate CLI such as `codex exec`/`claude -p` in a no-remote clone), `internal` (native host subagent/tool), `host` (the coordinator itself). Permitted by the unordered `allowed-worker` list.

**External worker profile** — entry in `ag.json` `external-workers`: `id`, `command`, `priority`, `tiers`, optional `family`.

**`cli-provider`** — filter on external profiles only (e.g., opposite family).

**Review policy** — `prefer-independent` (host review allowed after recorded unavailability of a separate reviewer) or `require-independent`.

**Cross-check** — separate review of the final implementation; depth `narrow|targeted|full|skip` from `cross-check-plan.js`. **Review record** — a version-1 `Review record:` JSON line (`external-review`, `native-review`, `host-review`) validated by `completion-record.js:validate_review_record`.

**Review-only** — a round whose owner text is only a review control (`review-only`, `3ways`/`threeways`, optionally `, reviewer: codex|claude`), plus `target:`, `reviewer:`, `godev` or the exact takeover continuation lines. Recognized by `round-linter.js:review_only_intent`; its review record (`purpose: "review-only"`) may keep BLOCKING/UNRESOLVED verdicts.

**Fast-lane** — per-Ask mode: host does the work directly, waives AG/delegation/independent review, keeps self-review and checks. `fast-lane.js:parse_fast_lane`; states include `pending` (waiting for a task).

**Skip-ag** — per-Ask control (`skip-ag [task]`, since 8.4.3): forces the direct route and waives only development-pipeline/advisor requirements; keeps normal review, delegation, streams and closeout. States `pending`/`active` like fast-lane. `fast-lane.js:parse_skip_ag`; policy `references/skip-ag.md`. Not an alias of `no-ag` or `fast-lane`.

**`no-ag`, `skip-review:`** — per-Ask owner waivers recognized by `completion-context.js:review_decision`.

**Design Go / Result Go** — explicit owner gates for consequential work (`Design Go: <7-hex commit prefix>`).

**Minimality check** — required statement in `design.md` justifying each part of a consequential change.

**Tracker** — `<work-root>/tracker.md` generated by `tracker-contract.js:template` and validated before checkpoints.

**Frozen queue / plan** — `plan-NNN.md` files plus digest-bound `.queue-generation.json`, produced by `make-plans` (`queue-contract.js`). **Looper** runs them sequentially (`agf-looper`, `looper.js`). `run-looper` / `run-plans` are the exact triggers.

**Referee / Stop hook** — `stop-hook.js`; grades completed rounds at end of turn; exit `2` asks for one correcting turn.

**Round linter** — `round-linter.js:lint_round`; deterministic checks with `pass|warn|skip|fail`.

**Completion record** — per-Ask metadata at `<workspace>/.tmp/[features/<key>/]A-NNN/completion.json`. `completion-record.js`.

**Delivery lock** — `agf-delivery.lock` in the Git common dir, serializing Agentflow delivery.

**`inline-reply`, `log-verbosity`, `auto-reply`, `keep-going`** — settings/controls: show saved Reply in chat; suppress RUN/WIP; auto-accept safe defaults; temporary auto-reply.

**Incident (`I-NNN`, legacy `F-NNN`)** — entry in `skills/agentflow/docs/incidents-log.md`; rules citing `— I-NNN` were born from that failure and must not be changed without reading it.

**`agf` / `agf-looper`** — shell function shortcuts installed by `setup.js` that call `scripts/agf.js` and `scripts/looper.js`.

**Safe ID** — host identifier matching `^[a-z0-9][a-z0-9_-]{0,127}$`.
