# AGENTS.md

Shared entry point for AI coding agents working on **this repository** (the source of the agentflow skill, formerly the aglite beta).

This repo *ships* agentflow; it is not itself an agentflow-managed project. The activation directive that agentflow's `references/setup.md#agents-adoption` adds to consumer projects does not belong here.

## Repository knowledge

The shared, agent-neutral knowledge base is in `docs/agent/`.

When answering questions about this repository:

1. Start with `docs/agent/INDEX.md`.
2. Load only the documentation relevant to the current question.
3. Inspect the relevant current source code.
4. Verify important behavioral claims against the implementation.
5. Treat source code as authoritative when documentation is stale.
6. Reference concrete file paths and symbols.
7. Reference relevant tests when available.
8. Distinguish confirmed behavior from inference.
9. Do not re-analyze the entire repository for every question.

Update the relevant `docs/agent/` file when architecture, module responsibilities or major feature flows change. Trivial edits do not need documentation updates.

## Language policy

- All persistent repository knowledge under `docs/agent/` must be written in English.
- Users may ask questions in any language. Respond in the same language as the user's question unless the user explicitly requests another language. If the user asks in Traditional Chinese, respond in Traditional Chinese.
- Keep these in their original form: file paths, class/function/variable names, APIs, commands, configuration keys, identifiers, library names, protocol names and technical product names. Do not translate source-code identifiers. Technical terminology may stay in English when that is more precise.

## Source-of-truth policy

Documentation is a navigation aid; source code is authoritative. If documentation and source code disagree, trust the source, mention the discrepancy, and update the knowledge documentation if appropriate.

For this repo, "source" includes both `skills/agentflow/scripts/*.js` (looper runtime) and the prompt files `skills/agentflow/SKILL.md` and `skills/agentflow/references/**` (workflow behavior).

## Working on this repo

- Tests: `cd skills/agentflow && npm test` (Node.js ≥ 20, Git required; no npm dependencies).
- Files under `skills/agentflow/SKILL.md` and `skills/agentflow/references/` are operational machine prompts; changing them changes agent behavior for every user.
- When looper behavior changes, keep `references/looper.md`, `SKILL.md`, `references/configuration.md`, `references/review.md`, both guides in `skills/agentflow/docs/`, `CHEATSHEET.md` / `CHEATSHEET.tw.md` and both READMEs aligned (`references/looper.md#scope-and-maintenance`).
- Version strings appear in `.claude-plugin/plugin.json`, `skills/agentflow/package.json`, `SKILL.md` metadata, README titles and `CHANGELOG.md`.
