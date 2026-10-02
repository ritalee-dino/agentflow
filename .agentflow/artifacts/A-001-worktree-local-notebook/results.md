* _2026-10-02 15:04:43 +0800 (codex/unknown)_

# Worktree-local notebook 實作結果

- 已依設計與 Q1～Q3 完成 v8.5.0：手動 linked worktree 可用第一則 `godev worktree-local-notebook: on` 初始化本地筆記，後續流程共用同一本筆記。
- 新增功能測試 20/20 PASS；真實 Windows PTY PASS。完整 suite 有 39 個既有／環境失敗，不能宣稱整套測試全綠。
- 變更已在目前專案原始碼完成；本輪未將新版覆蓋到使用者安裝的 skill 目錄，也未發布到 main。

## 使用方式與完成範圍

先以 `git worktree add` 建立 worktree，讓根目錄 `ag.json` 與 notebook 未被 Git 追蹤且已被 ignore，再於第一則訊息輸入：

```text
godev
worktree-local-notebook: on
```

也接受 `true`，存檔一律為 `on`。已存在 canonical stream notebook 時會拒絕啟用。設定只影響 linked worktree；主 checkout、無 Git 資料夾與原有 stream 流程保持原本行為。

新增共用設定、訊息解析與安全路由，接通 start、hook capture、writer、progress、compact、close 與 intake。首次啟動不建立 Git 可見的 .gitignore／hook 檔案，並保留既有設定值。依 Q3 回答，`agf init` 的行為沒有修改；ignored notebook commit、no-git 設定與 stream lifecycle 仍在設計排除範圍。

版本已對齊 SKILL.md、plugin.json、README 中英文版、CHANGELOG；同步更新 streams、使用指南、agent brief 與英文 repository knowledge。沒有新 dependency。

## 驗證

| 項目 | 結果 |
| --- | --- |
| AC-1～4、Q1 | 預設錯誤維持；同行／換行／on／true 成功；fenced code 不啟用 |
| AC-5、6、12 | 後續 start、writer、hook 共用本地筆記；其他 notebook 被拒絕 |
| AC-7 | close validation PASS，Reply 已儲存；ignored notebook commit 與主 checkout 相同 |
| AC-8、9 | 未 ignore notebook／tracked config 會拒絕，檔案不被建立或改寫 |
| AC-10 | 真正 agf new 工作區拒絕切換；原 stream startup 正常 |
| AC-11、INV-5 | 主 checkout／無 Git 以及儲存為 on 的設定仍維持普通路由 |
| AC-13 | maybe 值被設定驗證拒絕，合法 optional setting 保留 |
| 額外安全 | 自訂 workspace、既有 invalid-safe／legacy metrics 值保留、後續重新檢查 ignore、features 路徑拒絕 |
| 真實 PTY | Windows stdin/stdout/stderr 為 TTY；完整流程 exit 0，Git status 不變 |
| 完整 scripts suite | 1,420 tests：1,227 PASS、39 FAIL、154 skipped；661.256 秒 |

來源 commit：`eee1e12b87906ad86523db18996b16330abf5ea4`，已推送至 `origin/personal/v8.4.7` 並核對 remote SHA。獨立 [review.md](review.md) 的 Outcome／Minimality／Conformance 均為 PASS。完整 suite 的 local regression 在最後的 metrics 保存修正後執行，20/20 通過。PTY 細節見 [journey.md](journey.md)。

## 本輪收尾限制

實作 commit 已推送，notebook 的 Reply、STATUS、下一個空 Ask 已保存，completion validation PASS。最後的 Agentflow notebook commit 被既有 I-039 pre-commit guard 拒絕，原因是目前 `personal/v8.4.7` 並非預設分支，根目錄 `.agentflow/devlog.md` 不能加入該分支。保留此 guard，不以 `--no-verify` 繞過；根目錄筆記留在本地，結果文件另行提交並推送。這是本輪 Git 收尾限制，不能宣稱 `agf close` 全部成功。

## 既有限制

在修改前的 `efcc300cf03acd118dc7beced1f23fa7bb94c148` 建立無 remote 的獨立副本，針對失敗項目核對：55 tests 中 37 FAIL；另兩項 hook 失敗以隔離的 global-hooks 設定重現 2/2 FAIL。所有 current failure 都有基準對照，沒有 baseline-only 的差異。

失敗包含 Windows symlink EPERM、既有 POSIX／hook fixture 假設、older-settings 的既有預期，以及 SKILL.md 大小限制。SKILL.md 基準為 33,244 bytes，已超過 32 KiB；目前新增必要說明後為 33,650 bytes。跳過的測試不算通過；本輪保留既有測試與規則，沒有放寬 gate 或修正範圍外行為。

完整 suite 的既有 hook 測試沿用使用者的 global `core.hooksPath`，會存取 `C:/Users/user/.git-hooks/pre-commit`。目前檔案是指向本專案 `devlog-guard.js` 的 Agentflow guard；執行前沒有 byte snapshot，因此不宣稱已還原原始內容。後續基準核對使用隔離的 Git global config。改善既有測試的 global config 隔離列為後續提案。

Self-check: 本報告區分功能成功、完整 suite 未全綠、環境跳過與尚未安裝／發布；結果來自直接執行與基準對照。
