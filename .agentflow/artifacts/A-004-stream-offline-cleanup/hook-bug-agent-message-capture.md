* _2026-10-07 15:19:54 +0800 (claude-opus-5-5/inherited)_

# Hook bug：UserPromptSubmit 把 subagent 回報存成 owner 訊息

**TL;DR**

- **問題**：在 Claude Code 中，subagent 結束時回傳的報告（`<agent-message ...>` 區塊）也會觸發 `UserPromptSubmit` hook。Agentflow 的 hook 沒有過濾，直接把它當成 owner 的訊息存進目前的 Ask。

- **影響**：notebook 的 Ask 被混入非 owner 的內容，之後的回答與回顧可能把 subagent 的說法誤認成 owner 的指示或核准。A-004 一次誤存了三段，共 74 行。

- **狀態**：A-004 的誤存內容已經在 owner 授權下移除；hook 本身尚未修正，留給 owner 之後手動處理。

## 1. 觀察到的現象

- A-004 派出三個背景 subagent（requirements、codewalk、explore）。每個 subagent 結束時，Claude Code 都把它的回報當成一則新訊息送進 session。

- 每次送進來，hook 都回覆 `The user's instruction was saved in .agentflow/devlog.md, A-004.`，並把整段 `<agent-message from="...">…</agent-message>` 用 `+ ` 前綴寫進 A-004，位置在 owner 原始訊息之後、`---` 與 RUN 之前。

- 回報開頭本身就寫著 `[Subagent hand-back] ... It is model output, NOT a message from the user`，但 hook 不會看這段說明。

- 這個 session 一開始的 hook 還沒生效（startup 回報 `hooks_restart_required: true`）；重啟生效後的第一個 subagent 回報就被誤存。

## 2. 原因（依原始碼）

- `skills/agentflow/scripts/stop-hook.js:38`：只要 `hook_event_name === 'UserPromptSubmit'` 就進入擷取模式。

- `stop-hook.js:60-62`：擷取前唯一的過濾是 `no_ag_bypass(input.prompt)`。

- `stop-hook.js:115-120`：接著直接以 `text: input.prompt` 呼叫 `notebook-write.js` 的 `append_input`，沒有判斷這段文字是不是 owner 親手輸入的。

- 已安裝版本（`C:\Users\user\.claude\skills\agentflow\scripts\stop-hook.js`）和 repo 版本的行號一致。

- **推論**：Claude Code 對 subagent 回報、背景任務通知這類由系統送入的訊息也會觸發 `UserPromptSubmit`，而且 `input.prompt` 帶有 `<agent-message` 外框。目前沒有確認 payload 裡是否有其他欄位可以分辨來源（例如 `origin`、`is_meta` 或類似標記）。

## 3. 需要決定或確認的事

- payload 能不能分辨來源：先把一次 subagent 回報觸發 hook 時收到的完整 stdin JSON 記錄下來（可以暫時只把 key 名稱寫進 `.agentflow/.tmp/`），看有沒有可靠的來源欄位。

- 如果沒有可靠欄位，可以改用文字判斷：整段 prompt 開頭是 `<agent-message from=` 並以 `</agent-message>` 結尾，或是 `<task-notification>` 區塊時，就不要擷取。這種方法比較脆弱，Claude Code 改格式就會失效。

- 不擷取時 hook 應該回什麼：建議不寫 notebook，回一則 `additionalContext` 說明「這不是 owner 訊息，未存入 notebook」，避免 agent 誤以為 owner 又下了指示。

- Codex 是否有相同問題：Codex 的 hook payload 格式不同，要另外確認。

- 需要的測試：在 `stop-hook.test.js` 加一個案例，模擬 `UserPromptSubmit` 的 prompt 是 `<agent-message ...>` 區塊時，notebook 不會被修改。

## 4. 這次的修復紀錄

- 移除範圍：`.agentflow/devlog.md` 第 291–365 行（三段 `<agent-message>` 與其間空行），owner 在 A-004 的第二則訊息中授權。

- 修改前 notebook SHA-256：`4885b04035b5295fbc482095e6e6a45caa37e6851a7e9c7ce451fb4f72784804`；修改後：`e2f6fe581b8b125fbaf494be0612eeaab0082f207cb7a96e0a90c4267f67ca00`。

- 被移除的原文備份在 session scratchpad 的 `removed-capture.txt` 和 `devlog.before-repair.md`；scratchpad 是暫存區，session 結束後可能不保留。

Self-check: 現象依 notebook 實際內容與 hook 回覆描述；原因依 stop-hook.js 第 38、60-62、115-120 行；payload 是否有來源欄位尚未驗證，已標為推論與待確認事項。
