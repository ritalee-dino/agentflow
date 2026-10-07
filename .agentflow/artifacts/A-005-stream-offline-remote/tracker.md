# Tracker

## Identity

- **Work key:** A-005-stream-offline-remote.

- **Active Ask:** A-005.

- **Goal:** 依 A-004 的 6 個 owner 答案，讓 `stream-auto-push: off` 時 Agentflow 完全不連網（不 fetch、不 ls-remote、不 push），包含 cleanup、ditch 和主工作區 closeout；不發版。

- **Last update:** 2026-10-07 15:52:14 +0800.

- **Evidence commit:** 8e020a2428e1520501233f3262b6018723dace3b.

## Overall state

- **State:** complete.

- **Reason:** 6 項都已實作、測試並通過獨立審查。

- **Total:** 6.

- **Completed:** 6.

- **Remaining:** 0.

## Accepted task checklist

- [x] **T-1:** `agf cleanup` 在 stream 設定 off 時不執行 fetch／ls-remote，也不呼叫 `deletion_remote`（不檢查 origin 網址數量）；只依本機狀態合併、清理。範圍：`skills/agentflow/scripts/agf.js` 的 `clean_main`。證明：origin fetch 與 push 網址都指向不存在路徑時，cleanup 成功且本機分支、資料夾被清掉。Proof: 8e020a2 agf.test.js review.md. Source: A-005 ans 1、2、5.

- [x] **T-2:** off 時本機沒有 feature 分支（只有快取 `origin/<key>`）就拒絕 cleanup，並印出自己建本機分支的指令。範圍：`clean_main`。證明：測試確認拒絕訊息與指令，且沒有改動任何 ref。Proof: 8e020a2 agf.test.js review.md. Source: A-005 ans 3.

- [x] **T-3:** off 時用本機快取 `refs/remotes/origin/*` 提醒遠端可能有新 commit，只提醒不擋，訊息註明依上次 fetch 的資料；不要求快取存在，也不寫入快取。範圍：`clean_main`、`ditch_main` 的離線訊息。證明：快取落後／領先情境的測試看到提醒且 cleanup 仍成功；快取 ref 前後不變。Proof: 8e020a2 agf.test.js review.md. Source: A-005 ans 2、4.

- [x] **T-4:** `agf ditch` 在 off 時不執行 ls-remote、不呼叫 `deletion_remote`，只刪本機資料夾與分支。範圍：`ditch_main`。證明：origin 連不到時 ditch 仍成功，遠端分支不變。Proof: 8e020a2 agf.test.js review.md. Source: A-005 ans 1、5.

- [x] **T-5:** 主工作區設定 off 時，`agf close` 拒絕 push 模式；round linter 對主工作區 notebook 也免除 push 證據。範圍：`agf.js` 的 `close_main`、`round-linter.js` 的 `push_setting_disabled`（原 `stream_push_disabled`）。證明：反轉既有的主工作區 push 測試、更新 linter 測試。Proof: 8e020a2 agf.test.js round-linter.test.js review.md. Source: A-005 ans 1.

- [x] **T-6:** 文件與產品 prompt 改成「off 時 Agentflow 完全不連網」：`references/streams.md`、`references/closeout.md`、`SKILL.md` 的 push 規則、`docs/agent/FEATURES.md`、`skills/agentflow/docs/AG_GUIDE*.md`、`scripts/README.md`、`ag-settings.js` 設定說明文字。不改名、不發版（版本維持 8.4.14）。證明：相關文件 contract 測試通過（既有失敗另列）。Proof: 8e020a2 review.md. Source: A-005 ans 1、6.

## Accepted scope changes

- None.

## Current recovery

- **Current item:** None.

- **Last proven result:** 8e020a2：focused 8 個測試 PASS；相關 14 個測試檔沒有新增失敗；獨立審查 Outcome／Minimality／Conformance 皆 PASS（review.md）。

- **Active blocker or running process:** None.

- **Next safe action:** None.

- **Expected changed files:** skills/agentflow/scripts/agf.js; skills/agentflow/scripts/agf.test.js; skills/agentflow/scripts/round-linter.js; skills/agentflow/scripts/round-linter.test.js; skills/agentflow/scripts/ag-settings.js; skills/agentflow/SKILL.md; skills/agentflow/references/streams.md; skills/agentflow/references/closeout.md; docs/agent/FEATURES.md; skills/agentflow/docs/AG_GUIDE.md; skills/agentflow/docs/AG_GUIDE.zh-tw.md; skills/agentflow/scripts/README.md.

## Completion proof

- **All accepted tasks checked:** yes.

- **Blocking accepted decision:** none.

- **Operation running:** no.

- **Next action remaining:** none.

- **Evidence status:** complete.

- **Judgment:** complete.
