# Agentflow 本機紀錄防外流工具

用途：在公司 repo 用 Agentflow 開發時，`ag.json`、`.agentflow/`（devlog）和 `Agentflow-Close-Id` 只留在本機 commit，push 到 remote 前整理成乾淨分支，並用 hook 擋住漏網之魚。

| 檔案 | 作用 |
| --- | --- |
| `pre-push` | push 前檢查每個要推的 commit：tree 裡有 `.agentflow/` 或 `ag.json`，或訊息有 `Agentflow-Close-Id`，就擋下。檢查通過後會接著執行全域 `core.hooksPath` 裡的 `pre-push`（例如擋 develop 的規則）。 |
| `clean-branch.sh` | 把 Agentflow 工作分支 squash 到新的乾淨分支，移除 `.agentflow/`、`ag.json`、`.gitignore` 變更與 trailer，驗證後可選擇直接 push。 |

需求：Git ≥ 2.23（用到 `git switch`），Windows 請在 Git Bash 執行。

## 安裝（每個公司 repo 做一次）

這台電腦的全域設定有 `core.hooksPath = ~/.git-hooks`，所以 git **不會**讀 `.git/hooks/`。請改用 repo 專屬的 hooks 目錄：

```sh
cp /path/to/clean-branch.sh ~/bin/clean-branch.sh      # 放在 repo 外，所有 repo 共用

cd <公司 repo>
mkdir -p .git/agf-hooks
cp /path/to/patch/pre-push .git/agf-hooks/pre-push
printf '#!/bin/sh\n# placeholder: keeps the Agentflow devlog-guard out of this repo\nexit 0\n' > .git/agf-hooks/pre-commit
chmod +x .git/agf-hooks/pre-push .git/agf-hooks/pre-commit
git config core.hooksPath .git/agf-hooks
```

- `.git/agf-hooks/` 在 `.git` 裡面，不會被 commit 或 push。
- **佔位的 `pre-commit` 一定要放**：每次 `agf start` 都會把 Agentflow 的 devlog-guard 裝進目前的 hooks 目錄，它會擋掉「在非預設分支 commit 根目錄 devlog」——也就是 `agf close` 會失敗。放一個非 Agentflow 的 `pre-commit`，`agf start` 就不會覆蓋（它不改別人寫的 hook）。
- 這個 repo 改用自己的 hooks 目錄後，全域的 `pre-commit`（devlog-guard）不會在這裡執行；全域的 `pre-push` 則由本 hook 接續執行，擋 develop 的規則仍有效。
- 確認：`git config core.hooksPath` 應顯示 `.git/agf-hooks`。

沒有設定全域 `core.hooksPath` 的電腦，直接放 `.git/hooks/pre-push`（和同樣的佔位 `pre-commit`）即可。

## 每個功能的流程

```sh
git switch -c feat-x origin/main          # Agentflow 工作分支，只留在本機
# 對 AI 說 godev → agf start 初始化 ag.json、.agentflow/devlog.md
cp ~/agentflow-template/ag.json ag.json   # 要沿用自訂設定時：先初始化，再覆蓋
# ……開發，agf close 只做 local commit……

sh ~/bin/clean-branch.sh feat-x -m "feat: 功能說明"   # 建立 feat-x-clean
git diff origin/main..feat-x-clean                      # 檢查內容
git push -u origin feat-x-clean                         # 或在上一步加 --push
```

`clean-branch.sh` 選項：

| 選項 | 說明 |
| --- | --- |
| `-b <branch>` | 乾淨分支名稱（預設 `<工作分支>-clean`） |
| `-B <base>` | 起點（預設 `<remote>/HEAD`，沒有則 `<remote>/main`） |
| `-r <remote>` | remote 名稱（預設 `origin`） |
| `-m <message>` | commit 訊息；省略時開編輯器，草稿為 squash 紀錄且已去掉 trailer |
| `--keep-gitignore` | 保留工作分支對 `.gitignore` 的修改（預設還原成 base 版本） |
| `--no-fetch` | 不先 fetch |
| `--push` | 驗證通過後直接 `git push -u` |

安全設計：工作目錄有未 commit 的追蹤檔案變更、分支名稱已存在、squash 衝突或移除後沒有剩下任何變更時都會停止；後兩種會自動切回原分支並刪除剛建立的分支。完成後工作分支的 devlog 完整保留，`git switch feat-x` 即可回去。

## 注意事項

- `ag.json` 保持 `streams: off`：`agf new` 在有 remote 時會自動 push 含 devlog 的分支；`agf finish` / `agf cleanup` 也會 push。
- `agf close` 只用 `delivery.mode: "local"`，不要給 `--push-authorized`。
- 不要把 `.agentflow/`、`ag.json` 加進 `.gitignore` 或 `.git/info/exclude`，否則 `agf close` 找不到 notebook 會失敗。
- 若 remote 的 base 本身就含有 `ag.json` 或 `.agentflow/`，所有以它為基礎的 push 都會被擋，需先處理 remote。
- 確定要略過檢查時才用 `git push --no-verify`（同時也會略過全域 `pre-push`）。
- 只想保留多個 commit 而非 squash 成一個時，這個 script 不適用，需改用 `git rebase -i` 或 `git filter-repo --invert-paths --path .agentflow --path ag.json`。
