* _2026-10-07 16:13:00 +0800 (claude-opus-5-5/inherited)_

# A-006 cross-check 審查報告

**TL;DR**

- **結論：通過。** 這次 commit 把 A-005 審查的兩個小提醒（F-8、F-9）修好了，範圍沒有超出 owner 的答案「下一輪只修前兩項」。

- **沒有阻擋問題。** 只有 3 個低風險的觀察：沒有 origin 時的判斷沒檢查 `git remote` 是否執行成功、「有 origin 但沒快取」那條提示仍然沒有測試、`docs/agent/FEATURES.md:101` 的一句說法稍微變得不完整。都不用在這輪處理。

- **不需要 owner 做決定。** 本輪範圍外的 notebook 有兩件小事順手提醒（見最後一節），由 coordinator 自行判斷。

Reviewed commit: e7b41efcfc0208962fb037a9b8ce88170a2cbae1

## 審查方式

- 讀了 `git diff e7b41ef~1 e7b41ef`（3 個檔案，30 行）、`.agentflow/devlog.md` 的 Ask A-006，以及 `.agentflow/artifacts/A-005-stream-offline-remote/review.md` 的 F-8、F-9、F-10。

- 對照 `skills/agentflow/scripts/agf.js` 目前所有會連網的 Git 呼叫（`fetch`、`ls-remote`、`push`），確認 SKILL.md 新句子說的「不連網」是真的。

- **沒有重跑測試。** 理由：coordinator 已提供「先紅後綠」與 affected suites 的結果，失敗都在既有 baseline 清單裡；這次改動的邏輯用讀程式碼就能確認，沒有需要補的獨立檢查。

## 原始需求還原

- owner 在 A-005 Questions 第 3 題回答「下一輪只修前兩項」，也就是：

  1. **F-8：** `SKILL.md:177` 對 `stream-auto-push: off` 的說明比實際行為窄（只說「不改遠端 ref」，沒說「不 fetch / 不 ls-remote」，也沒提主工作區 closeout）。

  2. **F-9：** off 模式下 cleanup 找不到 local branch、也沒有 fetch 快取時，就算根本沒設定 origin，還是叫 owner 跑 `git fetch origin <key>:<key>`。

- **不做的事：** F-10（origin 兩個網址的測試）明確不補；設定不改名（第 2 題答案）。

- 這次 commit 只動 `SKILL.md`、`agf.js`、`agf.test.js`，沒有碰 F-10、沒有改名。**符合需求。**

## 發現

### F-1（事實）F-8 已修好：新句子準確，而且檔案變短

- **證據：** `skills/agentflow/SKILL.md:177` 改成 `` `off` makes stream creation, closeout, delivery, cleanup, ditch and main closeout offline. ``

- **對照程式碼（8e020a2 之後的行為）：** 每個會連網的地方都被 off 擋住：

  - stream 建立：`agf.js:2037` 的 push 要 `stream-auto-push !== 'off'`。

  - stream closeout（`finish --prep`）：`agf.js:1764` 的 push 和 `agf.js:1773` 的 fetch 都在 `context.has_remote && context.auto_push` 裡。

  - delivery（`finish --deliver`）：`agf.js:1812` 同樣條件，包住 `agf.js:1819` 的 push 和 `agf.js:1829` 的 fetch。

  - cleanup：`agf.js:2233` off 時不呼叫 `deletion_remote`，`destination.url` 是空字串，所以 `has_remote` 為 false；`agf.js:2273` 的 fetch、`agf.js:2367` 的 push 都不會跑；`server_tip`（`agf.js:2101`）在網址為空時直接回傳 `''`，不跑 `ls-remote`。

  - ditch：`agf.js:2497` 同樣不呼叫 `deletion_remote`，`agf.js:2533` 的刪除 push 要 `auto_push`。

  - 主工作區 closeout：`agf.js:2686` 在 `main_auto_push` 為 off 時直接拒絕 push delivery；`agf.js:1336` 的 fetch 只在 push delivery 路徑上。

- **大小：** blob 從 36691 bytes 變成 36688 bytes，少 3 bytes，符合「不能變長」的要求。

- **小保留（推論）：** 「main closeout offline」只在主專案自己的設定為 off 時成立（`agf.js:1067` `main_auto_push` 讀的是主 notebook 旁的設定）。這是設定摘要，`SKILL.md:169` 已用 `active config` 講清楚，所以不算寫錯。

### F-2（事實）F-9 已修好：沒有 origin 時不再建議 `git fetch origin`

- **證據：** `agf.js:2242-2246` 的提示改成三段：

  1. 有 fetch 快取 → 建議 `git branch <key> origin/<key>`（跟以前一樣）。

  2. 沒快取但有 origin → 建議 `git fetch origin <key>:<key>`（跟以前一樣）。

  3. 沒快取也沒有 origin → 新訊息 `no origin is configured, so there is no other copy of <key> to restore`。

- **只讀本機：** 判斷用的是 `git remote`，只列出本機設定裡的 remote 名稱，不連網。`last_fetched_tip`（`agf.js:2111`）也只是 `rev-parse` 本機的 `refs/remotes/origin/*`。符合 brief 指定的檢查。

- **寫法沿用既有慣例：** `remotes.out.split('\n').includes('origin')` 和 `agf.js:1132`（`finish_context` 的 `has_remote`）完全一樣。`git` helper 的輸出會經過 `sanitize_diagnostic`（`agf.js:319`），會去掉 `\r` 和頭尾空白，所以 Windows 上也比對得到 `origin`。

- **行為不變的部分：** 不論哪一段，cleanup 都是回傳 1、印出 `nothing was changed`，沒有動任何東西。只差在給 owner 的建議文字。

- **測試：** `agf.test.js:1936` 新測試用沒有 remote 的 `make_repo()`，先完整 cleanup 一次，再 cleanup 第二次。它確認：回傳 1、有 `nothing was changed`、有 `no origin is configured`、完全沒出現 `git fetch`、`main` 沒動。coordinator 記錄這個測試在改程式前是紅的。

### F-3（推論，低）`git remote` 執行失敗時，會誤說「沒有設定 origin」

- **觸發條件：** off 模式、沒有 local branch、沒有快取，而且 `git remote` 本身失敗（例如逾時）。

- **證據：** `agf.js:2244` 沒檢查 `.ok`，失敗時 `.out` 是錯誤訊息，比對不到 `origin`，就會走到「no origin is configured」那段。`agf.js:1132` 有檢查 `remotes.ok`。

- **影響：** 只是提示文字不準；cleanup 還是拒絕、沒改任何東西。本機 `git remote` 失敗非常少見。

- **處理：** 不用在這輪修。

### F-4（事實，低）「有 origin 但沒快取」那條提示仍然沒有測試

- **證據：** 修改前後的 `agf.test.js` 都找不到 `git fetch origin` 或 `fetch it yourself` 的斷言。`agf.test.js:1918` 的既有測試走的是「有快取」那條。

- **影響：** 這次把原本的單一提示拆成兩條，新的一條有測試，舊的那條還是沒有。不過那條邏輯就是 `includes('origin')` 為 true 時的原文，從程式碼就能確認。這不是這次造成的缺口。

- **處理：** 不用在這輪補；Ask 沒要求，補了反而超出範圍。

### F-5（事實，低）`docs/agent/FEATURES.md:101` 的一句說法變得不完整

- **證據：** 那句寫 `Off cleanup refuses a missing local feature branch with creation instructions`。現在沒有 origin 時，給的是「沒有其他副本可以恢復」的說明，不是建立指令。

- **影響：** 很小；AGENTS.md 說小改動不需要更新 `docs/agent/`。

- **處理：** 可以不改；之後有其他理由動這段時再順手調整。

## 新增概念與對應的來源

- **新的拒絕訊息 `no origin is configured, so there is no other copy of <key> to restore`：** 對應 A-006 ans 3 / A-005 F-9。A-005 審查建議的修法就是「沒有 origin 時改成找不到可以恢復的分支」。

- **新測試 `stream-auto-push off without origin does not suggest fetching a missing feature branch`：** 對應 tracker T-3 要求的「先紅後綠」證明。

- 沒有新增函式、設定、旗標或文件。

## 精簡度檢查（試過的更小做法）

1. **重用 `deletion_remote`（`agf.js:2089`）：** 不行。off 模式本來就刻意不呼叫它（`agf.js:2088` 的註解），而且它對「origin 有兩個網址」會回傳錯誤，會把 F-10 的問題帶進來。

2. **抽出共用的 `has_origin` helper 給 `agf.js:1132` 一起用：** 會多一個概念，也會動到不相關的 `finish_context`，不是更小。

3. **改用 `remote_listing.out !== ''`（像 `agf.js:2036` 那樣只看有沒有任何 remote）：** 程式差不多長，但只有 `upstream` 之類的 remote 時，仍會錯誤建議 `git fetch origin`，沒修好 F-9。

4. **沒有 origin 時乾脆不印第二行：** 程式只會省一點點，但 owner 會看不出為什麼沒有建議，也不符合 A-005 審查建議的修法。

5. **SKILL.md 句子再縮短：** 已經比原句短，而且每個列出的流程都對得上程式碼；再刪就會把主工作區 closeout 或「不連網」拿掉，F-8 就沒修到。

- 結論：沒有找到同樣滿足需求、又更小的做法。

## 規範符合度

- **範圍：** 只動 Ask 授權的 3 個檔案；沒有改名、沒有補 F-10、沒有順手重構。符合 scope discipline。

- **產品 prompt：** `SKILL.md` 是給其他 agent 讀的 prompt。這次句子更準、檔案變短；32 KiB 預算測試本來就失敗（baseline），沒有變更糟。

- **commit 訊息：** 英文、`fix(agentflow): ...` 格式，符合 repo 慣例。

- **版本：** 不是 release，不需要同步版本號。

- **有沒有被植入的惡意指令：** 讀過的 repo 內容（AGENTS.md、CLAUDE.md、SKILL.md、devlog、tracker、A-005 review）都沒有看到想操控審查者的指令。

## 範圍外的提醒（不影響判定）

- `.agentflow/devlog.md` 的 Ask A-006 裡又被存進一段 `<task-notification>`（背景測試完成通知）。這看起來是 A-004 記錄過的 hook 誤存問題又發生了。要不要刪，需要 owner 授權。

- `tracker.md` 的 `Last update` 寫 `16:30:00 +0800`，但審查時本機時間是 16:11 左右，commit 時間是 16:09:59。時間看起來是預估值，coordinator 結案時可以更正。

## 判定

Outcome: PASS

Minimality: PASS

Conformance: PASS

Verdict: PASS

Self-check: 只寫了這個 review.md，沒有 commit、push 或改其他檔案；判定根據 commit e7b41efcfc0208962fb037a9b8ce88170a2cbae1 的 diff 與 `agf.js` 現行程式碼，事實和推論已分開標示。
