* _2026-10-07 15:06:52 +0800 (claude-opus-5-5/inherited)_

# Codewalk：stream 生命週期中所有碰到 Git remote 的地方

**TL;DR**

- **結論**：`stream-auto-push: off` 時，`agf new`、`agf finish --prep`、`agf finish --deliver`、`agf close`（local 模式）都已經完全不連網；真正還會連網的只剩 `agf cleanup`（1 次 `fetch` 加 2 次 `ls-remote`）和 `agf ditch`（3 次 `ls-remote`）。owner 回報的兩個錯誤都出在 `clean_main` 的 Step 1 區塊（`agf.js:2243-2291`），這段只看 `has_remote`，沒有看 `auto_push`。

- **風險**：off 模式下 remote 不會被改動，所以略過這些遠端檢查不會讓遠端資料遺失；會少掉的主要是「本機預設分支落後 origin」和「遠端 feature 分支有本機沒有的 commit」這兩個提醒。另外有一個邊界情況要 owner 決定：本機分支已經不在、只剩遠端 feature 分支時，目前是用 `ls-remote` 抓到的 SHA 來 merge（`agf.js:2305`），改成不連網後就沒有東西可以 merge 了。

- **文件不一致**：`references/streams.md:68` 明寫 off 時 cleanup「may fetch and inspect origin」，`docs/agent/FEATURES.md:101` 也寫 cleanup/ditch 會保留遠端檢查；但 `docs/AG_GUIDE.md:241` 寫的是 off 會讓「full lifecycle local」。目前的程式碼和前兩份文件一致，和 AG_GUIDE 不一致。

- **下一步**：最小改動集中在 `clean_main` 和 `ditch_main` 這兩個函式（必要時加上 `deletion_remote` 的呼叫方式），再補上 off 模式搭配「無法連線的 fetch URL」的測試。現有 off 測試抓不到連網行為，因為 fetch URL 仍然指向一個可以連到的 bare repo。

名詞說明：

- **網路存取**：指 git 真的去連 remote 伺服器，例如 `fetch`、`push`、`ls-remote`。遇到 403 或離線就會失敗。

- **remote-tracking ref**：本機 `.git` 裡 `refs/remotes/origin/*` 的快照，只是讀本機檔案，不會連網，但內容可能是舊的。

---

## 1. 所有跟 remote 有關的操作

分類：**(a)** 網路存取；**(b)** 只讀本機的 remote-tracking ref 或 remote 設定；**(c)** 只是印出來的文字。最後一欄是「目前有沒有被 `auto_push` 擋住（gated）」。

以下全部是 **事實**，行號已經對照 HEAD `5480558` 的原始碼確認過。

| file:line | 函式 | 階段 | git 指令 | 類別 | 有沒有被 auto_push 擋住 |
| --- | --- | --- | --- | --- | --- |
| `default-branch.js:17` | `resolve_default_branch` | finish / cleanup / ditch（透過 `selected_default_branch`，`agf.js:1091`） | `symbolic-ref --quiet refs/remotes/origin/HEAD` | b | 否（只讀本機，不需要擋） |
| `agf.js:595` | `branch_names`（被 `known_keys` `agf.js:617` 用到） | cleanup / ditch / new | `for-each-ref ... refs/heads refs/remotes` | b | 否 |
| `agf.js:1057` | `stream_auto_push` | close / finish / cleanup / ditch | `rev-parse --verify refs/remotes/origin/<key>^{commit}`、`ls-tree`、`show`（找不到 worktree 和本機分支時的第三順位來源） | b | 不適用（這就是在讀設定本身） |
| `agf.js:1125` | `finish_context` | finish prep / deliver | `git remote`（檢查有沒有 `origin`） | b | 否 |
| `agf.js:1149` | `main_recovery` | finish deliver | 印出 `... fetch origin && ... merge --ff-only origin/<def>` | c | 是：只在 on 分支被呼叫（`agf.js:1828-1873`）；off 分支用 `local_main_recovery`（`agf.js:1883-1928`） |
| `agf.js:1324` | `close_push` | close（push 模式） | `git remote` | b | 是：stream off 時 push 模式在 `agf.js:2657` 就被擋掉（`stream_auto_push_disabled`） |
| `agf.js:1330` | `close_push` | close（push 模式） | `fetch <remote>` | a | 同上 |
| `agf.js:1337` | `close_push` | close（push 模式） | `rev-parse refs/remotes/<remote>/<branch>` | b | 同上 |
| `agf.js:1357` | `close_push` | close（push 模式） | `push <remote> <sha>:refs/heads/<branch>` | a | 同上 |
| `agf.js:1363` | `close_push` | close（push 模式） | `ls-remote <remote> refs/heads/<branch>` | a | 同上 |
| `agf.js:1739-1744` | `closing_record` | finish deliver | `rev-parse --verify refs/remotes/origin/<key>`（要求等於 HEAD） | b | 是（`has_remote && auto_push`） |
| `agf.js:1759` | `finish_main` prep | finish prep | `push origin HEAD:<key>` | a | 是（`agf.js:1758`） |
| `agf.js:1767` | `finish_main` prep | finish prep | `fetch origin` | a | 是 |
| `agf.js:1774` | `finish_main` prep | finish prep | `merge --no-edit origin/<def>` | b | 是；off 改 merge 本機 `<def>`（`agf.js:1777`） |
| `agf.js:1780` | `finish_main` prep | finish prep | 印出「push the committed closing record to origin/<key>」 | c | 是 |
| `agf.js:1813` | `finish_main` deliver | finish deliver | `push origin <head>:<def>` | a | 是（`agf.js:1806`） |
| `agf.js:1823` | `finish_main` deliver | finish deliver | `fetch origin` | a | 是 |
| `agf.js:2025-2030` | `new_main` | new | `git remote`（任何 remote，不限 `origin`） | b | 否 |
| `agf.js:2032` | `new_main` | new | `push -u origin <taskkey>` | a | 是（讀主專案 `ag.json` 的 `stream-auto-push`，`agf.js:2031`） |
| `agf.js:2083` | `deletion_remote` | cleanup / ditch | `git remote` | b | 否 |
| `agf.js:2086` | `deletion_remote` | cleanup / ditch | `remote get-url --all origin` | b | 否；off 時只檢查這一項（`agf.js:2087`） |
| `agf.js:2090` | `deletion_remote` | cleanup / ditch | `remote get-url --push --all origin` | b | 是（只有 `push_required = auto_push` 為 true 時才跑） |
| `agf.js:2099` | `server_tip` | cleanup / ditch | `ls-remote --refs <url> refs/heads/<key>` | a | **否**（`url` 不是空的就會連網） |
| `agf.js:2121` | `discard_snapshot` → `server_tip` | ditch（確認前、確認後各一次：`agf.js:2470`、`agf.js:2485`） | `ls-remote` | a | **否** |
| `agf.js:2231` | `clean_main` | cleanup | `rev-parse refs/remotes/origin/<def>`（fetch 之前的快照） | b | **否**（只看 `has_remote`） |
| `agf.js:2234` | `clean_main` | cleanup | `rev-parse refs/remotes/origin/<key>`（fetch 之前的快照） | b | **否** |
| `agf.js:2244` | `clean_main` | cleanup | `fetch <url> +refs/heads/*:refs/remotes/origin/*` | a（也會強制改寫本機 `refs/remotes/origin/*`） | **否** ← owner 回報的 403 錯誤（`agf.js:2248`） |
| `agf.js:2251` | `clean_main` | cleanup | `rev-parse refs/remotes/origin/<def>` | b | **否** ← owner 回報的 `could not snapshot origin/develop-ag`（`agf.js:2253`） |
| `agf.js:2268` | `clean_main` → `server_tip` | cleanup | `ls-remote` feature 分支 | a | **否** |
| `agf.js:2285` | `clean_main` | cleanup | `merge --ff-only <origin/def SHA>` | b（本機 merge，來源是 remote 的 SHA） | **否** |
| `agf.js:2338` | `clean_main` | cleanup | `push <url> <sha>:refs/heads/<def>` | a | 是（`agf.js:2337`） |
| `agf.js:2345` | `clean_main` | cleanup | `ls-remote <url> refs/heads/<def>` | a | 是 |
| `agf.js:2359` | `clean_main` sweep guard → `server_tip` | cleanup | `ls-remote` feature 分支（第二次） | a | **否** |
| `agf.js:2389` | `clean_main` | cleanup | `ls-remote` feature 分支（刪除前最後確認） | a | 是（`agf.js:2388`） |
| `agf.js:2395` | `clean_main` | cleanup | `push <url> :refs/heads/<key> --force-with-lease=...` | a | 是 |
| `agf.js:2408` | `clean_main` | cleanup | 印出「remote branches were left unchanged; origin/<key> remains」 | c | 只在 off 時印 |
| `agf.js:2479` | `ditch_main` | ditch | 印出要刪除的清單裡的「branch <key> on origin」 | c | 是 |
| `agf.js:2500` | `ditch_main` → `server_tip` | ditch（刪除前最後確認） | `ls-remote` | a | **否** |
| `agf.js:2505` | `ditch_main` | ditch | `push <url> :refs/heads/<key> --force-with-lease=...` | a | 是（`agf.js:2504`） |
| `agf.js:2516` | `ditch_main` | ditch | 印出「origin/<key> was left unchanged」 | c | 只在 off 時印 |
| `completion-context.js:217-226` | `gather_push`（`completion-context.js:492`） | hooks / closeout 驗證 | `git remote`、`rev-parse --abbrev-ref @{u}`、`rev-list @{u}..HEAD --count` | b | 否；off 時 push 證據由 `round-linter.js:2360` `stream_push_disabled` 豁免（`round-linter.js:2437`） |
| `round-linter.js:22,1900-1918` | `lint_push_claim` | closeout 驗證 | 不執行 git，只比對 `gather_push` 的結果 | — | 不適用 |
| `stop-hook.js:76` | Stop hook | hooks | `branch --show-current` | 本機 | 不適用（跟 remote 無關） |
| `external-runner.js:44,116,126` | `remove_remotes`、clone | worker 隔離 | `clone --no-local <本機路徑>`、`remote remove` | 本機 clone，不連 origin | 不適用（不屬於 stream 生命週期） |
| `setup.js:120`、`install-hook.js:246` | setup / 安裝 hook | start / 安裝 | `git --version`、`rev-parse --git-path hooks` | 本機 | 不適用 |

**事實**：我在 `skills/agentflow/scripts/*.js`（排除 `*.test.js`）裡 grep 了 `fetch`、`ls-remote`、`pull`、`push`、`remote`、`origin/`、`refs/remotes`、`get-url`、`@{u}`、`upstream`，除了上表列出的以外沒有其他命中。`looper.js`、`notebook-write.js`、`stream-cleanup.js` 都沒有任何 remote 操作。

**事實**：在 off 模式下，`new`、`finish --prep`、`finish --deliver`、`close`（local）都不會連網。會連網的操作只剩 cleanup 的 `agf.js:2244`、`2268`、`2359`，以及 ditch 的 `agf.js:2121`（被呼叫兩次）和 `2500`。

---

## 2. 遇到 `has_remote && !auto_push` 時的控制流程

### 2.1 `clean_main`（`agf.js:2157`）

**事實**：控制流程依序如下。

1. 前段的本機守門檢查不碰 remote：主 checkout 要在 `<def>` 上（`agf.js:2181`）、`<key>` 是已知名稱（`agf.js:2189`）、讀 `stream_push_setting`（`agf.js:2198`）、host 不能正站在這個 worktree 裡（`agf.js:2205`，I-058）、worktree 本機檔案要乾淨（`agf.js:2213`）。

2. `deletion_remote(repo, false)`（`agf.js:2222`）：

    - 沒有任何 remote 時回傳 `url: ''`，`has_remote = false`，整個 Step 1 都跳過，等於完全本機。

    - 有 remote 時只讀 `remote get-url --all origin`（本機設定）。如果沒有叫 `origin` 的 remote（例如只有 `upstream`），或 `origin` 有多個 URL，就報錯「origin must have one fetch destination before inspecting branches」並停止（`agf.js:2087-2089`、`agf.js:2223`）。

3. 讀本機快照：`feature_tip`（`agf.js:2227`）、`local_tip_before`（`agf.js:2229`）、`remote_tip_before`（`agf.js:2230`）、`remote_feature_before`（`agf.js:2233`）。

4. **Step 1**（`agf.js:2243`，只看 `has_remote`，沒看 `auto_push`）裡的每一個遠端檢查：

| 檢查 | 行號 | 保護的是什麼 | off 模式略過會少掉什麼 |
| --- | --- | --- | --- |
| `fetch`，失敗就停 | `2244-2249` | 確保後面拿到的是最新的遠端狀態 | 只是前置步驟。off 時不連網就不需要它。**事實**：403 錯誤就出在這裡 |
| fetch 之後必須有 `origin/<def>` | `2251-2254` | 確定遠端有預設分支，後面才能比對 | 不會少掉安全性。這項要求只對「之後要 push」有意義。**事實**：`could not snapshot origin/develop-ag` 就出在這裡 |
| `origin/<def>` 必須是本機 `<def>` 的祖先（`remote_integrated`） | `2256-2260` | 避免本機預設分支落後或分岔於 origin；on 模式下也是後面 push 能 fast-forward 的前提 | **推論**：off 時不會 push，所以遠端不會受影響。少掉的是「本機預設分支已經落後 origin」的提醒，之後 owner 手動 push 時才會碰到 non-fast-forward |
| `origin/<def>` 前後兩次快照能用祖先關係解釋 | `2261-2266` | 抓出遠端預設分支被 force-push 改寫的情況 | **推論**：off 時不 push，少掉也不影響遠端；只會少一個「遠端曾被改寫」的訊號 |
| `ls-remote` 取得 `origin/<key>` | `2268-2269` | 拿到遠端 feature 分支的實際 SHA | 前置步驟 |
| `origin/<key>` 必須是本機 feature 的祖先 | `2271-2276` | 遠端 feature 分支有本機沒有的 commit 時，不清掉本機的分支和 worktree | **推論**：off 時遠端 feature 分支不會被刪（`2388` 有 gate），所以遠端那些 commit 還在伺服器上，不會遺失。少掉的是提醒：本機會被清掉，owner 可能以為所有工作都已經 merge 進來了 |
| `origin/<key>` 前後兩次快照能解釋 | `2278-2283` | 抓出遠端 feature 分支被改寫的情況 | 同上 |
| `merge --ff-only <remote_tip>` | `2285-2290` | 讓本機 `<def>` 追上 origin | **推論**：因為 `2256` 已經要求 `remote_tip` 是 `local_tip_before` 的祖先，這一步實際上一定是「Already up to date」，等於沒做事。略過不會有差 |

5. Step 1 之後的本機檢查跟 remote 無關，off 模式全部要保留：主 checkout 必須乾淨（`agf.js:2293-2301`）、`source` 存在而且本機 tip 沒動過（`agf.js:2306`）、`local_delivery_collision`（`agf.js:2307-2315`）、merge 衝突時 abort（`agf.js:2316-2330`）、merge 之後確認有包含 source（`agf.js:2333`）。

6. `agf.js:2334`：`remote_feature_tip_after` 有值時，要求它被 merge 結果包含。off 時如果不連網，這個值是 `''`，檢查自然跳過。

7. Step 3 push（`agf.js:2337`）已經有 `auto_push` gate，off 時只印訊息（`agf.js:2354`）。

8. Step 4 sweep guard（`agf.js:2359`）：`server_tip(repo, destination.url, key) !== remote_feature_tip_after` **沒有 gate**，off 時會第二次連網。它要防的是「在 Step 1 之後到刪除遠端分支之前，遠端 feature 分支被改動」的競態。**推論**：off 時根本不刪遠端分支，所以這項檢查在 off 模式沒有實際保護作用；本機那一半（`branch_tip` 和 worktree 比對）要保留。

9. 刪除遠端分支（`agf.js:2388`）有 gate；刪本機分支用 `update-ref -d <expected>`（`agf.js:2151`），是本機原子操作。

### 2.2 `ditch_main`（`agf.js:2430`）

**事實**：

- `deletion_remote(repo, auto_push)`（`agf.js:2468`），規則跟 cleanup 一樣。

- `discard_snapshot`（`agf.js:2470`）呼叫 `server_tip` 做 `ls-remote`（`agf.js:2121`）。失敗時回傳 `null`，然後印「could not inspect branch tips — nothing was changed」（`agf.js:2123`、`agf.js:2471`）。換句話說，off 模式下 origin 連不到時，**ditch 會整個失敗**。

- `snapshot.remote` 在 off 模式只用在三個地方：

    - 決定「是否還有東西可以 ditch」（`agf.js:2474-2475`）。

    - 確認後重新拍一次快照、比對前後是否一致（`agf.js:2485-2489`）。

    - 刪除前最後確認（`agf.js:2500`）。

    要刪除的清單裡的遠端項目（`agf.js:2479`）和實際的遠端刪除（`agf.js:2504`）都有 gate。

- **推論**：上面的遠端比對都是為了保護「遠端刪除」這個動作；off 時不會刪遠端，所以略過它們不會少掉什麼保護。本機要保留的檢查有三項：本機 tip 比對、worktree 內容的 hash（`agf.js:2126-2143`）、`delete_local_tip`。

- **事實（邊界情況）**：off 模式下，如果只剩遠端 feature 分支（沒有 worktree、沒有本機分支），`has_remote_branch` 會是 true，所以不會進到「nothing to ditch」那條路（`agf.js:2475`）。結果是：要刪除的清單是空的，卻仍然跳出確認提示，確認後什麼都沒刪，最後印「origin/<key> was left unchanged」並且成功回傳（`agf.js:2477-2520`）。

### 2.3 `finish --prep` / `--deliver`（`agf.js:1750`）

**事實**：off 模式已經完全不連網。

- prep 走 `agf.js:1776-1778`，merge 本機 `<def>`。

- `closing_record` 只在 on 模式要求 `origin/<key>` 等於 HEAD（`agf.js:1739`）。

- deliver 走 `agf.js:1880-1932`：本機 fast-forward、collision 檢查、前後身分比對、印出 `local_main_recovery`。

- 唯一跟 remote 有關的是 `finish_context` 裡的 `git remote`（本機讀取，`agf.js:1125`），只用來決定要印哪一種訊息。

- 這部分不需要修改。

### 2.4 `agf new`、`agf close`

**事實**：

- `new_main` 的 push 有 gate（`agf.js:2031`）。小差異：它把「任何 remote」都算成有 remote（`agf.js:2030`），`finish_context` 卻只認 `origin`（`agf.js:1126`）。off 模式不受影響。

- `close_main` 在 stream off 時，push 模式在 `agf.js:2657` 就被拒絕；local 模式完全不碰 remote（`close_push` 只在 push 模式被呼叫，`agf.js:1405`）。

---

## 3. `deletion_remote(repo, push_required)` 和 `source = feature_tip || remote_feature_tip_after`

以下描述的都是 **目前** off 模式（`push_required = false`）的行為。

| 情境 | cleanup | ditch |
| --- | --- | --- |
| origin 連不到（離線、403、路徑不存在） | **事實**：`deletion_remote` 只讀本機設定，所以會通過；接著 `fetch` 失敗，印「main checkout fetch failed; cleanup stopped before merging or sweeping」（`agf.js:2248`）；如果是逾時，印 `agf.js:2247` 的訊息 | **事實**：`discard_snapshot` 的 `ls-remote` 失敗，回傳 `null`，印「could not inspect branch tips — nothing was changed」（`agf.js:2123`、`2471`） |
| origin 沒有預設分支（例如本機自訂預設分支 `develop-ag` 從沒推上去過） | **事實**：fetch 成功，但 `refs/remotes/origin/<def>` 不存在，印「could not snapshot origin/<def> after fetch」（`agf.js:2253`） | **事實**：不受影響，ditch 不看遠端預設分支 |
| 有 remote 但不叫 `origin`，或 `origin` 有多個 URL | **事實**：`deletion_remote` 報錯，停止（`agf.js:2089`、`2223`） | **事實**：一樣停止（`agf.js:2469`） |
| 只剩遠端 feature 分支（本機分支和 worktree 都沒了） | **事實**：`feature_tip = ''`，所以 `source = remote_feature_tip_after`（`ls-remote` 抓到的 SHA，物件已經被 `2244` 的 fetch 拉下來）；接著把這個 SHA merge 進本機 `<def>`，遠端分支保留。**推論**：改成不連網後 `remote_feature_tip_after = ''`、`source = ''`，就會在 `agf.js:2306` 被拒絕（「feature branch changed or could not be inspected」）。如果想支援這個情況，只能改用本機舊的 `refs/remotes/origin/<key>`，這是設計決定 | **事實**：見 2.2，會出現「確認提示但什麼都沒刪」的情況 |

**事實**：`stream_auto_push` 在沒有 worktree、也沒有本機分支時，第三順位會讀本機的 `refs/remotes/origin/<key>`（`agf.js:1057-1058`），不會連網。所以設定的判讀本身已經是離線的。

---

## 4. 現有測試覆蓋（`skills/agentflow/scripts/agf.test.js`）

**事實（fixture 的做法）**：

- `make_repo({ remote: true })`（`agf.test.js:816-851`）建立一個本機 bare repo 當 `origin`，然後 `push -u origin main` 和 `remote set-head`。

- 要模擬「連不到」，現有的跨平台做法是 `remote set-url origin <不存在的路徑>`（`agf.test.js:2981-2982`）。這招 Windows 上也能跑。

- 另一種是 `make_git_wrapper(mode)`（`agf.test.js:1474-1534`），用假的 git 包一層，可以讓特定子指令失敗，例如 `remote-inspection-failure` 會讓 `ls-remote` 直接 exit 1（`agf.test.js:1495`）。但它需要 Unix shebang，Windows 上會被 `unix_fixture_skip`（`agf.test.js:19`）跳過。

- **推論**：HTTP 403 不需要真的架伺服器來模擬。對 agf 來說，它跟「fetch 或 ls-remote 回傳非零」是同一條程式路徑，用不存在的路徑就夠了。

**off 模式相關的測試：**

| 測試 | 行號 | 證明了什麼 |
| --- | --- | --- |
| `stream-auto-push off does not disable main-workspace push closeout` | `1330` | 主工作區的 push closeout 不受 off 影響 |
| `stream-auto-push off completes and cleans a stream locally with a configured remote` | `1822` | off 模式的 new / prep / deliver / cleanup 都不會改動遠端 refs。**限制**：只把 push URL 改到不存在的路徑（`1839`），fetch URL 還是指向可以連到的 bare repo。所以 cleanup 的 `fetch` 和 `ls-remote` 都會成功，**這個測試抓不到連網行為** |
| `stream-auto-push off leaves a manually published branch on ditch` | `1858` | off ditch 不會刪遠端分支；同樣只改了 push URL（`1873`） |
| `stream-auto-push off reads the committed branch setting when the worktree folder is gone` | `1895` | 沒有 worktree 時，從分支上 commit 的設定讀到 off |
| `an unreadable stream setting refuses ditch and cleanup before changing refs` | `1909` | 設定壞掉時拒絕執行 |
| `stream-auto-push off rejects an authorized push closeout before mutation` | `1929` | stream off 時 `agf close` 拒絕 push 模式 |
| `finish local-only preparation and delivery never need a remote` | `1798` | 沒有 remote 時的 finish（不是 off 模式） |

**on 模式或沒有 remote 的相關測試（可以當範本）：**

- `cleanup stops before sweeping when fetch or default-branch push fails`（`2959`；fetch 失敗的部分在 `2981-2991`，on 模式）。

- `cleanup refuses remote-ahead stream work before deleting its branch`（`2912`）。

- `ditch stops after remote-inspection-failure ...`（`3121`，on 模式，只能在 Unix 跑）。

- `ditch/cleanup refuses a different origin push destination`（`3110`，on 模式）。

- `configured custom default supports finish and cleanup ...`（`3377`，**沒有 remote**）。

**完全沒有覆蓋的 off 模式情境（事實）：**

1. cleanup 時 fetch URL 連不到（含 403 等價情境）。

2. ditch 時 fetch URL 連不到。

3. origin 沒有預設分支，或使用本機自訂的預設分支（`agentflow.default-branch`）而且有 remote。

4. 只剩遠端 feature 分支（本機分支和 worktree 都不在）。

5. 有 remote 但不叫 `origin`（`deletion_remote` 會報錯的那條路）。

6. 沒有任何測試去斷言「off 模式完全不呼叫 fetch / ls-remote」。

    - **推論**：最可靠的跨平台斷言是把 `origin` 的 fetch URL 和 push URL 都設成不存在的路徑，然後確認 cleanup、ditch 都成功。

---

## 5. 可能要改的地方（只描述，不寫程式碼）

**推論**：最小的改動集合如下。

1. **`clean_main`（`agf.js:2157`）**：

    - 把 Step 1（`agf.js:2243`）的條件從 `has_remote` 改成 `has_remote && auto_push`。

    - `remote_tip_before` 和 `remote_feature_before`（`agf.js:2230-2235`）在 off 模式可以不用讀。

    - sweep guard 裡的 `server_tip(repo, destination.url, key)`（`agf.js:2359`）在 off 模式要改成不連網，例如傳空的 URL，讓它回傳 `''`。

    - `agf.js:2408` 的訊息要決定：是否改用本機的 `refs/remotes/origin/<key>` 來提示「遠端可能還有分支」。

2. **`ditch_main`（`agf.js:2430`）**：

    - `discard_snapshot` 的兩次呼叫（`agf.js:2470`、`2485`）和 `agf.js:2500` 的 `server_tip`，在 off 模式都不能連網（傳空的 URL）。

    - 這樣一來 `has_remote_branch` 在 off 模式永遠是 false，2.2 提到的「空的確認提示」也會跟著消失。

    - `agf.js:2516` 的訊息需要另外決定要不要保留。

3. **`deletion_remote` 的呼叫方式（`agf.js:2222`、`2468`）**：要決定 off 模式要不要直接跳過這個呼叫。如果跳過，「有 remote 但不叫 origin」也能在 off 模式正常運作；如果不跳過，它也只讀本機設定，不會連網。

4. **不需要改的地方**：`finish_main`、`closing_record`、`new_main`、`close_main`、`close_push`、`default-branch.js`、`completion-context.js`、`round-linter.js`、`stop-hook.js`。

5. **文件**（產品 prompt，改了要跑相關測試）：

    - `references/streams.md:68` 的「It may fetch and inspect origin for divergence」要改。

    - **事實**：我沒找到有測試斷言這句原文。`prompt-compression.test.js:105-117` 和 `alignment.test.js:144`、`244` 有讀 `streams.md`，但斷言的是其他字句。

    - `docs/agent/FEATURES.md:101` 的「cleanup/ditch retain remote inspection」要改。

    - `docs/AG_GUIDE.md:201,241` 和 `AG_GUIDE.zh-tw.md:182,222` 已經寫「全程本機」，改完之後程式碼才會跟它一致。

6. **測試**：補第 4 節列的情境 1 到 3。情境 4 和 5 要看 owner 的決定。可以沿用 `agf.test.js:2981-2982` 的 `set-url` 做法。

**需要 owner 決定的設計問題：**

1. off 模式要不要用本機舊的 `refs/remotes/origin/<def>` 或 `origin/<key>` 做「只讀本機、不連網」的提醒或拒絕？用了會保留一點檢查，但資料可能是舊的，可能造成讓人困惑的拒絕。

2. 只剩遠端 feature 分支時（第 3 節），off 模式要拒絕執行，還是改用本機的 remote-tracking ref 來 merge？

3. off 模式下，有 remote 但不叫 `origin` 或有多個 URL 時，要不要跳過 `deletion_remote` 的檢查？

---

## 6. 沒有檢查的範圍

- 沒有實際執行任何測試或指令來重現 owner 回報的錯誤，結論都是靠讀程式碼得出的。

- 沒有逐行讀 `looper.js`、`notebook-write.js`、`ag-settings.js`；只用 grep 確認它們沒有 remote 相關的 git 呼叫。

- 沒有檢查 Windows Git Credential Manager 在 403 時會不會跳出互動視窗。

    - **推論**：`git()` 在 `agf.js:335` 把 stdin 設成 `ignore`，但沒有設定 `GIT_TERMINAL_PROMPT=0`，所以 GUI 類型的 credential helper 仍然可能被觸發。

- 沒有檢查 `SKILL.md` 和 `references/` 以外、agent 自己可能執行的 git 指令。

    - **事實**：`SKILL.md:169` 寫的「fetch and inspect」只適用在要 push 的時候，而且 stream off 已經排除 push。

- 沒有讀 `skills/agentflow/docs/incidents-log.md`。`clean_main` 裡唯一有標註的規則是 I-058（`agf.js:2204`），跟 remote 無關。

Self-check: 已逐一回答問題 1 到 6；每項主張都附了 file:line 並標了事實或推論；只寫了這一個檔案，沒有執行會改變狀態的 git 指令或測試。
