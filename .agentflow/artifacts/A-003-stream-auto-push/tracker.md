# Tracker

## Identity

- **Work key:** A-003-stream-auto-push.

- **Active Ask:** A-003.

- **Goal:** Restore stream-auto-push off without changing main-workspace delivery or version.

- **Last update:** 2026-10-02 16:22:08 +0800.

- **Evidence commit:** 9bf9d694d3c859aeba8320e184fba5438fe17c4a.

## Overall state

- **State:** complete.

- **Reason:** Setting, lifecycle behavior, focused checks and independent review accepted.

- **Total:** 1.

- **Completed:** 1.

- **Remaining:** 0.

## Accepted task checklist

- [x] **T-1:** Restore the reference setting and stream lifecycle guards in ag-settings.js/agf.js, focused tests, SKILL/references/guides and docs/agent/FEATURES.md; default on, off never updates remote refs. Verify settings, local lifecycle with a bare remote, closeout refusal and prompt contracts. Preserve existing switches/version; stop on new regression. Source: A-003. Proof: five new setting/lifecycle cases PASS; 297-case broad run followed by corrected template rerun, all 11 remaining failures reproduced on 55d885f; exact-commit independent review.md Outcome/Minimality/Conformance PASS.

## Accepted scope changes

- None.

## Current recovery

- **Current item:** none.

- **Last proven result:** Five new cases PASS; all 11 remaining broad-suite failures reproduced on unchanged parent; native review three verdicts PASS.

- **Active blocker or running process:** None.

- **Next safe action:** none.

- **Expected changed files:** skills/agentflow/SKILL.md; skills/agentflow/scripts/{ag-settings.js,ag-settings.test.js,agf.js,agf.test.js,README.md}; skills/agentflow/references/{streams.md,closeout.md}; skills/agentflow/docs/AG_GUIDE*.md; docs/agent/FEATURES.md; task tracker/review.

## Completion proof

- **All accepted tasks checked:** yes.

- **Blocking accepted decision:** none.

- **Operation running:** no.

- **Next action remaining:** none.

- **Evidence status:** complete.

- **Judgment:** complete.

## Update meaning

- Saving this tracker is a recovery checkpoint, not a stop signal.

- For completed work, Evidence commit names the Git evidence commit, or is not applicable in a plain folder. Local file and test proof is still required.

- Work continues with the next unfinished item unless an independent stop condition applies.
