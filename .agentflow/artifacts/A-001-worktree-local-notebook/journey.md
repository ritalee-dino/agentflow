* _2026-10-02 14:50:03 +0800 (codex/unknown)_

# Worktree-local notebook 終端驗證

- 真實 Windows PTY 流程 PASS，終端腳本 exit 0；stdin、stdout、stderr 都確認為 TTY。
- 初始化、第二則訊息、progress、compact、close 共用 `.agentflow/devlog.md`，Git 可見狀態保持不變。
- close 的驗證 PASS、Reply 已寫入；被 ignore 的 notebook 無法建立新 commit，結果與主 checkout 相同，符合設計 AC-7 的既有限制。

來源：實作 commit `eee1e12b87906ad86523db18996b16330abf5ea4`；host tool PTY session `53655`。最新的 local `persist_migration: false` 修正只影響既有 legacy metrics 的保存；本流程使用新 template，驗證輸入不受影響。

可重複執行：在真實終端跑 `node skills/agentflow/scripts/worktree-local-journey.js`。startup 子程序以 pipe 接收 owner 文字，符合 start 不接受終端 stdin 的規則。

| 步驟 | 輸入／檢查 | 結果 |
| --- | --- | --- |
| 終端 | stdin/stdout/stderr `isTTY` | 全為 true，平台 win32 |
| 手動 worktree | 真實 `git worktree add`，共用 exclude 排除 ag.json 與 .agentflow | 建立成功 |
| 首次 start | `godev worktree-local-notebook: on` | exit 0；enabled=true；local notebook |
| 第二則訊息 | hook capture：`please capture the second message` | exit 0；同一本 notebook 留存訊息 |
| 再次 start | `godev` | exit 0；同一本 notebook |
| progress | notebook writer append-wip | exit 0 |
| compact | `agf compact` | exit 0 |
| close | 完整 stdin manifest | validation.ok=true；Reply 與下一個 Ask 已儲存 |
| 主 checkout 比較 | 相同 exclude 的 close | commit error/state/exit status 與 local 相同 |
| Git 狀態 | 初始化前後及流程結束 | 相同 |

Self-check: 本記錄只列出 host 直接執行並檢查的結果；不宣稱 ignored notebook 的 commit 成功。
