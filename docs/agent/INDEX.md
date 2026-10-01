# Agent knowledge base — index

Navigation layer for AI coding agents working **on** this repository (developing Agentflow itself). Source code and the skill Markdown under `skills/agentflow/` are authoritative; these notes only help you find them. Snapshot: v8.4.4, 2026-10-01 (verified against commit `4257a20`; earlier text was written against v8.4.0).

## Which document to read

| Question type | Read |
| --- | --- |
| What is this repo, how is it laid out, how do I run tests? | [CODEBASE.md](CODEBASE.md) |
| How do the parts fit together, what depends on what, where is state stored? | [ARCHITECTURE.md](ARCHITECTURE.md) |
| "Where is feature X implemented?" / which files and tests own X | [FEATURES.md](FEATURES.md) |
| "What happens when X runs?" (startup, capture, closeout, Stop hook, looper, streams) | [FLOWS.md](FLOWS.md) |
| What does Ask / RUN / STATUS / stream / tier / cross-check / skip-ag mean? | [GLOSSARY.md](GLOSSARY.md) |
| Why is it built this way? Why does rule Y exist? | [DECISIONS.md](DECISIONS.md), then `skills/agentflow/docs/incidents-log.md` |

## Two kinds of "source" in this repo

1. **Model instructions** (Markdown loaded into an LLM host): `skills/agentflow/SKILL.md`, `skills/agentflow/references/**`. These *are* product behavior. Changing wording changes behavior; contract tests assert on it.
2. **Host-side scripts** (zero-dependency Node.js): `skills/agentflow/scripts/*.js`. Deterministic enforcement — notebook writing, validation, Git delivery, hooks, worker launch.

When a question is about "what the agent must do", check the Markdown. When it is about "what is enforced / what the CLI does", check the scripts and their `*.test.js`.

## Verification checklist

- Confirm a symbol still exists: `grep -n "<symbol>" skills/agentflow/scripts/<file>.js` (look at the `module.exports` block near the end of each file).
- Confirm a rule: grep the rule text in `skills/agentflow/SKILL.md` and `skills/agentflow/references/`.
- Rules tagged `— I-NNN` have a narrative in `skills/agentflow/docs/incidents-log.md`; read it before changing the rule.
