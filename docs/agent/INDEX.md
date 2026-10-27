# Agent knowledge base — index

Routing page for AI coding agents working **on this repository** (the agentflow skill source; formerly named aglite). Read this page, load only the document that matches the question, then verify against current source. Source code and the skill's own reference files are authoritative; these documents are a navigation layer.

## Which document to read

| Question type | Read |
| --- | --- |
| What is this repo, layout, commands, tests, release shape | [CODEBASE.md](CODEBASE.md) |
| Layers, module boundaries, how prompts and the Node looper relate, persistence, external CLIs | [ARCHITECTURE.md](ARCHITECTURE.md) |
| "Where is feature X defined/implemented?", "What files does X touch?" | [FEATURES.md](FEATURES.md) |
| Step-by-step runtime behavior (activation, notebook claim, feature worktrees, looper run/integration/recovery) | [FLOWS.md](FLOWS.md) |
| Meaning of a term (Ask, devlog, claim, run-root, ag-dir, fast-lane, …) | [GLOSSARY.md](GLOSSARY.md) |
| Why something is designed the way it is | [DECISIONS.md](DECISIONS.md) |

## How to use it

1. Pick one or two documents from the table; do not load all of them by default.
2. Follow the file/symbol references to the current source (`skills/agentflow/...`).
3. For behavior of the Node looper, confirm against `skills/agentflow/scripts/*.js` and the matching test in `skills/agentflow/scripts/looper.test.js` or `looper-copilot.test.js`.
4. For workflow behavior (prompt-defined), the authority is the Markdown under `skills/agentflow/SKILL.md` and `skills/agentflow/references/`. Quote section anchors, not line numbers.
5. If a document here disagrees with source, trust source, mention the discrepancy, and update the document when the change is architectural.

## Conventions used in these documents

- `path/to/file.js:symbol` names a function or constant in that file.
- `path/to/file.md#anchor` names a section heading.
- **Confirmed** = read in source. **Inferred** = deduced from structure/naming; verify before relying on it.
