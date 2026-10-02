# Tracker

## Identity

- **Work key:** A-003-stream-auto-push.

- **Active Ask:** A-003.

- **Goal:** Restore stream-auto-push off without changing main-workspace delivery or version.

- **Last update:** 2026-10-02 16:07:00 +0800.

- **Evidence commit:** uncommitted.

## Overall state

- **State:** active.

- **Reason:** Work remains.

- **Total:** 1.

- **Completed:** 0.

- **Remaining:** 1.

## Accepted task checklist

- [ ] **T-1:** Restore the reference setting and stream lifecycle guards in ag-settings.js/agf.js, focused tests, SKILL/references/guides and docs/agent/FEATURES.md; default on, off never updates remote refs. Verify settings, local lifecycle with a bare remote, closeout refusal and prompt contracts. Preserve existing switches/version; stop on new regression. Source: A-003.

## Accepted scope changes

- None.

## Current recovery

- **Current item:** T-1.

- **Last proven result:** None.

- **Active blocker or running process:** None.

- **Next safe action:** Run focused suites, inspect diff, commit, independently review and close.

- **Expected changed files:** skills/agentflow/SKILL.md; skills/agentflow/scripts/{ag-settings.js,ag-settings.test.js,agf.js,agf.test.js,README.md}; skills/agentflow/references/{streams.md,closeout.md}; skills/agentflow/docs/AG_GUIDE*.md; docs/agent/FEATURES.md; task tracker/review.

## Completion proof

- **All accepted tasks checked:** no.

- **Blocking accepted decision:** none.

- **Operation running:** no.

- **Next action remaining:** T-1.

- **Evidence status:** current.

- **Judgment:** active.

## Update meaning

- Saving this tracker is a recovery checkpoint, not a stop signal.

- For completed work, Evidence commit names the Git evidence commit, or is not applicable in a plain folder. Local file and test proof is still required.

- Work continues with the next unfinished item unless an independent stop condition applies.
