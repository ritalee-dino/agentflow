# Worktree-local notebook implementation

Authority: A-001 requests implementation of C:/Projects/Development_CBM_ui/.agentflow/artifacts/worktree-local-notebook/design.md with away: gates. Its answered Q1 accepts on/true; Q2 rejects existing canonical stream notebooks; Q3 excludes init changes. The external design remains authoritative and unchanged.

Outcome: a manually created linked worktree can initialize once with godev worktree-local-notebook: on, then use its ignored local notebook for startup, capture, progress, compaction and close, retaining Git.

Route: direct; allow-ag on; native implementation worker for the bounded scripts/tests slice; host owns planning, documentation, verification, review and delivery. Existing approved detailed design settles interface and safety decisions; no unresolved owner choices.

## Scope

Add the optional setting, fence-aware owner request parser, shared linked-worktree safety/routing, startup bootstrap, hook/guard/intake integration, AC-1 through AC-13 tests, reusable terminal journey, documentation and v8.5.0 release metadata. Preserve agf init, stream lifecycle, main-checkout behavior, devlog-guard and incident history. Do not repair excluded-notebook commits.

## Invariants

Use the external design INV-1 through INV-6 verbatim as the implementation contract: unchanged default, untracked/ignored I-039 safety, preserved streams, one notebook, linked-worktree-only behavior, and unchanged Git-visible state. Each starting condition, guarantee and failure condition is defined in section 6 of that design.

## Acceptance criteria

External design AC-1 through AC-13 are required; AC-14 is excluded by answered Q3. New regression tests must demonstrate AC-2 and unsafe startup failures before implementation, then pass. Run the scripts test suite once for the shared routing and release integration boundary; existing Windows-only skips are recorded, not treated as passes. Run a real PTY start/capture/close journey using an available terminal, with input/output, exit statuses and repository state checked; report environment limitations truthfully.

## Minimality check

Smallest result: one explicit startup request initializes an ignored worktree-local notebook and every caller uses it. A startup-only change fails capture/guard; manual configuration does not satisfy the requested first-message flow. Shared safety prevents tracked root history leakage. Tests and short instruction updates preserve the existing default and explain the exception. No init repair, no new dependencies, no stream lifecycle changes.

## Delivery gates

Commit this plan before source edits. Current Ask away: gates supplies Design Go after the resolved design checks, and Result Go only after tests, review and host inspection pass for the exact implementation commit. Commit authorized files and deliver to origin/personal/v8.4.7 without force; do not publish to main or install to user skill copies.
