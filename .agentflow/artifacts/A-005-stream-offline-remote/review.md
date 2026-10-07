* _2026-10-07 15:50:00 +0800 (claude-opus-5-5/inherited)_

# A-005 cross-check 審查報告

**TL;DR**

- **結論：PASS。** 設成 `stream-auto-push: off` 後，`agf cleanup`、`agf ditch` 跟主工作區的 `agf close` 都不會再連網，也就是不會跑 fetch、ls-remote 或 push。owner 的 6 個決定都有做到，`on` 模式的行為沒有變。

- **沒有阻擋問題。** 只有 3 個小提醒：`SKILL.md:177` 的設定說明還是舊的範圍；沒有 local branch 又沒有 origin 時，提示指令不適用；「origin 有兩個網址也能跳過檢查」沒有專門的測試。這三個都不影響這次要的結果。

- **沒有重跑測試。** 程式碼看下來，coordinator 的紅燈、focused 綠燈和 14 個 suite 的基準比較都能直接沿用，找不到需要另外補驗的缺口。

- **下一步：** coordinator 可以依這份報告結案。上面的小提醒要不要修，由 owner 決定，可以另開 Ask 處理。

Reviewed commit: 8e020a2428e1520501233f3262b6018723dace3b

## 依原始 Ask 重建的預期結果

- A-004 的 issue 要求：`off` 時，stream 生命週期不能 fetch、pull、push、ls-remote；就算 origin 連不到或回 403，cleanup 也要能完成；`on` 模式維持原樣。

- A-005 的 owner 答案又加了幾條：主工作區 closeout 也要停止推送（ans 1）；可以讀本機的 `refs/remotes/origin/*` 快取（上次 fetch 留下的遠端分支位置），但不能要求它存在，也不能寫入它（ans 2）；本機沒有 feature branch 時要拒絕，並教 owner 怎麼建（ans 3）；可以用快取發提醒但不能擋，而且要寫明資料來自上次 fetch（ans 4）；跳過 `deletion_remote` 的 origin 網址檢查（ans 5）；不發版（ans 6）。

## Findings

### F-1（事實）off 模式下，`clean_main` 沒有任何路徑會連到遠端

- **證據：** `agf.js:2233` 在 off 時不呼叫 `deletion_remote`，直接把 `destination` 設成 `{ url: '' }`，所以 `has_remote` 一定是 false。

- Step 1 的 fetch（`agf.js:2270`）、Step 3 的 push 加 ls-remote（`agf.js:2364`），以及刪除遠端分支（`agf.js:2415`），都要 `has_remote` 為 true 才會執行，所以 off 時全部跳過。

- `server_tip` 在網址是空字串時，會在 `agf.js:2102` 直接回傳 `''`，不跑 ls-remote。所以 sweep guard（`agf.js:2385` 後面那段）比對的是 `'' === ''`，也不會連網。

- 新增的 `last_fetched_tip`（`agf.js:2111`）只跑 `rev-parse` 讀快取，不寫 ref。其他會呼叫到的 `known_keys`、`branch_names`、`selected_default_branch` 也都只讀本機 refs（`agf.js:594`、`default-branch.js` 讀的是 `refs/remotes/origin/HEAD`）。

- **測試：** `agf.test.js:1824` 把 origin 改成不存在的路徑，等於模擬離線或 403，cleanup 仍然成功，而且 `refs/remotes` 的快取前後完全一樣。

### F-2（事實）off 模式下，`ditch_main` 和 `discard_snapshot` 也不會連網

- **證據：** `agf.js:2495` 同樣傳空網址。確認前後各做一次的 snapshot（`agf.js:2512`）和刪除前的 `server_tip` 檢查都不會跑 ls-remote。遠端刪除（`agf.js:2531`）在 off 時不會執行。

- **測試：** `agf.test.js:1864` 在 origin 連不到時 ditch 仍然成功，而且遠端的 bare repo 分支沒有被改到。

### F-3（事實）`on` 模式的行為沒有變

- 舊版在 on 時呼叫的是 `deletion_remote(repo, true)`，走的正是現在保留下來的那段，也就是檢查 fetch 和 push 網址必須相同。這次刪掉的 `!push_required` 分支，原本只有 off 會走到。

- 新加的「沒有 local branch 就拒絕」（`agf.js:2240`）、快取提醒（`agf.js:2260`）、結尾訊息（`agf.js:2435`、`agf.js:2543`）都有 `!auto_push` 條件擋著。Step 3 的 else 訊息在 on 時一樣是 `no remote configured — nothing pushed`。

### F-4（事實）off 模式保留了所有本機安全檢查

- 以下檢查都沒動，而且仍然在任何刪除動作之前執行：未保存檔案（Guard 4，`agf.js:2221`）、主工作區 dirty 檢查（`agf.js:2325`）、merge 衝突時自動 abort（`agf.js:2345`）、`deletion_worktree` 的 worktree 歸屬與註冊比對、`delete_local_tip` 用 `update-ref` 做「比對 tip 後才刪」，以及刪除前的 recovery 備份（`agf.js:2397`）。

- 沒有 local branch 的拒絕發生在任何修改之前，所以訊息說的「nothing was changed」是真的。測試 `agf.test.js:1918` 確認 `main` 和快取都沒被動到。

### F-5（事實）owner 決定 2～5 都有對應的實作

- **ans 2：** 只讀快取，不要求快取存在（沒有快取時不會提醒，也不會擋），也不寫入。`agf.test.js:1936` 確認快取前後一樣。

- **ans 3：** `agf.js:2240` 拒絕 cleanup。有快取時提示 `git branch <key> origin/<key>`，沒有快取時提示 `git fetch origin <key>:<key>`。

- **ans 4：** `agf.js:2260` 的訊息寫著 `according to the last fetch`，提醒之後 cleanup 照樣繼續。`agf.test.js:1936` 對 `main` 和 feature 兩條分支都有驗證。

- **ans 5：** off 時根本不會呼叫 `deletion_remote`。

### F-6（事實）主工作區 closeout 和 linter 的設定來源一致，缺檔或設定壞掉時都偏保守

- `close_main`（`agf.js:2684`）在 stream worktree 裡照舊用 `stream_auto_push`；在主工作區改用 `main_auto_push`（`agf.js:1067`），它透過 `ag_settings.active_config_path` 找到 notebook 所屬的 `ag.json`。

- `active_config_path` 會先找 notebook 旁邊的 `ag.json`。所以就算在主工作區關閉 stream notebook，用的也是那個 stream 自己的設定（`ag-settings.js:809`）。

- 找不到設定檔時，`main_auto_push` 回傳 true，push 照常。設定檔格式錯誤時，`stream_auto_push_from_text` 會丟出錯誤，被 `close_main` 的 catch 接住，closeout 直接失敗。結果是在「設定可疑」的情況下不會 push，也不會默默改成 local。

- linter 的 `push_setting_disabled`（`round-linter.js:2360`、`round-linter.js:2368`）用的是同一個 `active_config_path`。檔案不存在或格式錯誤時會被 catch 接住、回傳 false，也就是照樣要求 push 證據。`round-linter.test.js` 也測了 stream 的 adjacent 設定、未設定、JSON 壞掉，以及主工作區 off/on 這幾種情況。

- **測試：** `agf.test.js:1330` 確認主工作區 off 時，close 會在修改前拒絕：notebook 的 bytes 和遠端 SHA 都沒變。

### F-7（推論，低）格式錯誤的主工作區 `ag.json` 現在會讓 push closeout 提早失敗

- **觸發條件：** 主工作區設定檔存在但格式錯誤或沒通過驗證，而且 closeout 用 push 模式。

- **影響：** 以前不會在這裡讀設定；現在會在 `close_main` 提早報錯。這是偏安全的失敗方式，而且後面的 close 流程本來就會讀同一個設定檔（`agf.js:1397` 附近的 `config_file`）。所以我推測對實際使用沒有影響。

- **處理：** 不需要修改。

### F-8（事實，低）`SKILL.md:177` 的設定說明只寫到一部分範圍

- **證據：** 這行還寫著 `off keeps stream creation, closeout, delivery, cleanup and ditch from changing remote refs`。它沒提到「不 fetch、不 ls-remote」，也沒提到主工作區 closeout。

- **影響：** 真正會影響 host 行為的是 `SKILL.md:169`，這行已經改成 `active config`。`references/closeout.md:47` 和 `references/streams.md:68` 也都寫對了。`:177` 只是說法比實際行為窄，但沒有寫錯，host 照著做也不會做出違規動作。

- **處理：** 可以另外再修。這次沒有一起改，也符合 scope discipline，而且 `SKILL.md` 的大小限制本來就很緊。

### F-9（事實，低）沒有 origin 又沒有 local branch 時，拒絕訊息給的指令不適用

- **觸發條件：** off 模式，沒有設定 origin，沒有 local feature branch，也沒有快取。

- **影響：** `agf.js:2244` 叫 owner 執行 `git fetch origin <key>:<key>`，但沒有 origin 時這個指令會失敗。不過 cleanup 本來就會拒絕，沒有任何資料受影響。

- **處理：** 可以不修。要修的話，在沒有 origin 時改成「找不到可以恢復的分支」就好。

### F-10（事實，低）「off 時跳過 origin 網址檢查」沒有專門的測試

- 測試是把 origin 改成連不到的單一網址，沒有測「origin 有兩個 fetch 網址」這種情況。

- 不過從程式碼看，off 時根本不會呼叫 `deletion_remote`（`agf.js:2233`、`agf.js:2495`），所以這個行為可以直接從程式碼確認。這個缺口不影響結論。

## 新增概念與對應的 owner 決定

- `main_auto_push`：對應 ans 1（主工作區 closeout 也要停）。

- `last_fetched_tip`：對應 ans 3（決定拒絕訊息要給哪個指令）、ans 4（提醒），也用在結尾回報保留的遠端分支，這是 `streams.md:68` 原本就有的「清楚回報保留的遠端 ref」規則。

- 沒有 local branch 就拒絕：對應 ans 3。

- 快取提醒迴圈：對應 ans 4。

- `deletion_remote` 拿掉參數：對應 ans 5。off 不再呼叫它之後，`push_required=false` 那個分支就沒有任何呼叫端了。

- 把 `stream_push_disabled` 改名成 `push_setting_disabled`：對應 ans 1。這個函式現在也適用主工作區，舊名稱會讓人誤會。它是模組內部的函式，改名範圍很小。

## 試過的簡化方案（Minimality）

- **保留 `deletion_remote(repo, false)`：** 雖然它只跑本機的 `git remote get-url`，不會連網，但 origin 有多個網址時仍然會擋住，違反 ans 5。所以不能用這個方案。

- **不加 `last_fetched_tip`，改成直接用 clean_main 原有的 `remote_tip_before` 和 `remote_feature_before`：** 這兩個值只在 `has_remote` 為 true 時才會算。要讓 off 也能用，就得改 on 路徑的計算條件，反而動到 on 的行為，程式也不會比較短。而且 ditch 也要用到同樣的讀取，抽成 helper 比較合理。

- **`main_auto_push` 改用 `read_notebook_controls`：** 那個函式不做嚴格驗證，跟 linter 用的嚴格讀法 `stream_auto_push_from_text` 不一致。一個要求 push、一個不要求，就可能對同一份設定做出不同判斷。現在 4 行的寫法已經是重用既有 helper 的最小組合。

- **拿掉 cleanup 和 ditch 結尾的「origin 分支保留」訊息：** 這是原本就有的回報，只是改成讀快取。拿掉的話會違反 `streams.md` 的回報規則。

- **結論：** 找不到更小、而且仍然滿足 Ask 的設計。

## Conformance

- 產品 prompt 和文件都已經同步：`SKILL.md:169`、`references/closeout.md:47`、`references/streams.md:68`、`AG_GUIDE.md`、`AG_GUIDE.zh-tw.md`、`scripts/README.md`、`docs/agent/FEATURES.md`、`ag-settings.js` 的設定說明。只有 F-8 提到的那一處沒改，屬於小問題。

- 沒有動到任何標著 `— I-NNN` 的規則；`closeout.md` 的 I-079 那行沒有修改。`SKILL.md` 這次的改動長度不變（`stream` 換成 `config`），不會讓 32 KiB 大小限制更吃緊。

- 版本維持 8.4.14，沒有改 `plugin.json`、`CHANGELOG.md` 或 README 的版本號，符合 ans 6。沒有改設定名稱；owner 允許改名，但不是必要的。

- coordinator 的測試證據：7 個新增或改寫的測試在改程式前都失敗（紅燈），focused 測試 8 個全過，14 個 suite 跟基準比沒有新增失敗。以上都是沿用 coordinator 的結果，這次審查沒有重跑；找不到證據缺失或失效的地方。

## 敵意指令檢查

- 沒有發現針對 reviewer 的敵意指令。

- A-005 的 Ask 裡有一段 `<task-notification>`，是 UserPromptSubmit hook 把背景工作的通知誤存進去的，不是 owner 寫的。它沒有要求任何動作，我把它當成一般資料。coordinator 已經在 RUN-002 記錄過這件事。

## Verdicts

Outcome: PASS

Minimality: PASS

Conformance: PASS

Verdict: PASS

Self-check: 已直接讀過 Ask A-004、A-005、完整的 diff 和 `clean_main`、`ditch_main`、`close_main`、`round-linter.js` 的現行程式碼。每個 off 路徑上的網路呼叫都逐一確認過。只寫了這一份 review.md，沒有 commit、push、改 Git 設定，也沒有修改其他檔案。
