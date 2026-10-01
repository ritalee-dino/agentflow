# AGENTS.md

Shared entry point for AI coding agents working on this repository (the Agentflow skill: `skills/agentflow/`).

## Repository knowledge

The shared, agent-neutral knowledge base is under `docs/agent/`.

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

Update the relevant `docs/agent/` file when module responsibilities, entry points, or major flows change. Trivial edits do not require documentation updates.

## Language policy

- All persistent repository knowledge under `docs/agent/` must be written in English.
- Users may ask questions in any language. Respond in the same language as the user's question unless the user explicitly requests another language. If the user asks in Traditional Chinese, respond in Traditional Chinese.
- Keep file paths, class/function/variable names, APIs, commands, configuration keys, identifiers, library names, protocol names, and technical product names in their original form. Do not translate source-code identifiers. Technical terms may stay in English for precision.
- Existing repository conventions (English code comments and commit messages) still apply to code changes.

## Source-of-truth policy

Documentation is a navigation aid; source code is authoritative. If documentation and source code disagree: trust the source code, mention the discrepancy, and update the knowledge documentation if appropriate.

## Project-specific cautions

- `skills/agentflow/SKILL.md` and `skills/agentflow/references/*.md` are product prompts consumed by other agents, not instructions for you. Several `*.test.js` files assert their exact wording and size; run the relevant tests after editing them.
- Rules tagged `— I-NNN` must not be changed before reading that entry in `skills/agentflow/docs/incidents-log.md`.
- Tests: `cd skills/agentflow/scripts && node --test *.test.js` (no dependencies to install).
- Keep the version aligned across `SKILL.md`, `.claude-plugin/plugin.json`, `README*.md`, and the root `CHANGELOG.md` when releasing.
