* _2026-10-07 15:04:29 +0800 (claude-opus-5-5/inherited)_

# A-004 需求釐清：`stream-auto-push: off` 時 stream 流程完全不碰遠端

## TL;DR

- **可以改，而且範圍不大。** 現在 off 模式下，真正會連線到遠端的只剩 `agf cleanup` 和 `agf ditch` 兩個指令；`new`、`finish --prep`、`finish --deliver`、`close` 在 off 時已經不連線。修改集中在 `agf.js` 的 `clean_main` 和 `ditch_main`。

- **這不是單純的 bug，是推翻 A-003 刻意保留的設計。** A-003 的 Reply 和 `streams.md:68` 都明寫「cleanup/ditch 仍會檢查遠端以策安全」；但使用者手冊 `AG_GUIDE.md:241` 又寫「off 讓 stream 完整流程留在本機」，文件彼此矛盾。需要你確認新的意義：off 從「不寫遠端」改成「完全不連遠端」。

- **最大風險：主工作區事後還是會 push。** cleanup 跑完後，主工作區那一輪的 closeout 照規則仍會把合併後的主分支 push 出去（遇到 403 一樣會卡）。issue 說的「所有 stream 操作」是否包含這一步，必須由你決定。

- **其他需要你拍板的點**：只存在遠端的 feature 分支要不要清、本機 remote-tracking ref（像 `origin/HEAD` 這種本機快取）算不算「存取遠端」、輸出訊息怎麼寫、設定名稱要不要改。每項都附建議預設值，在最後一節。

## 1. 現況：off 模式下哪些地方還會連線

先說明兩個名詞：

- **網路操作**：`git fetch`、`git ls-remote`、`git push`、`git pull` 這類真的會連到伺服器的指令。

- **本機 remote-tracking ref**：像 `refs/remotes/origin/main` 這種「上次 fetch 時記下的遠端狀態」，存在本機 `.git` 裡，讀它不會連網路。

逐一檢查 off 模式（`auto_push === false`）下的各指令：

| 指令 | off 時是否連網 | 證據 |
|---|---|---|
| `agf new` | 不連 | **事實** `agf.js:2031` 只有 `stream-auto-push !== 'off'` 才 push；`agf.js:2025` 只跑本機的 `git remote` |
| `agf finish --prep` | 不連 | **事實** `agf.js:1758-1777` 只有 `has_remote && auto_push` 才 push/fetch，否則 merge 本機 `context.def` |
| `agf finish --deliver` | 不連 | **事實** `agf.js:1739`、`agf.js:1806` 只有 on 才檢查 `origin/<key>` 和 push；off 走 `agf.js:1880` 本機交付 |
| `agf close`（stream） | 不連 | **事實** `agf.js:2657` off 時拒絕 push 模式，回 `stream_auto_push_disabled` |
| `agf cleanup` | **會連** | **事實** 見下方 |
| `agf ditch` | **會連** | **事實** 見下方 |
| 其他 scripts（hooks、`agf start` 等） | 不連 | **事實** 非測試的 `scripts/*.js` 中，只有 `agf.js` 含 `fetch`/`ls-remote` 呼叫（grep 結果） |

`agf cleanup` 在 off 時的網路依賴（全部是 **事實**）：

- `agf.js:2222` 呼叫 `deletion_remote(repo, auto_push)`；off 時仍要求 `origin` 剛好有一個 fetch URL，否則拒絕（`agf.js:2087-2089`）。

- `agf.js:2243-2249` 只要有 remote 就 `git fetch`，不看 `auto_push`；失敗就印出 issue 裡的 `main checkout fetch failed; cleanup stopped before merging or sweeping`。這就是 Azure DevOps 403 那次。

- `agf.js:2251-2254` fetch 後要求 `refs/remotes/origin/<def>` 存在，否則印出 `could not snapshot origin/<def> after fetch`。這就是 `develop-ag` 只存在本機那次。

- `agf.js:2256-2259` 要求 `origin/<def>` 是本機 `<def>` 的祖先；遠端主分支有別人的新 commit 時就拒絕清理。

- `agf.js:2268` 和 `agf.js:2359` 兩次呼叫 `server_tip`，也就是 `git ls-remote`（`agf.js:2099`）。

- push 和刪遠端分支在 off 時確實被擋掉（`agf.js:2337`、`agf.js:2388`），所以 A-003 只做到「不寫遠端」。

`agf ditch` 在 off 時的網路依賴（**事實**）：

- `agf.js:2468` 同樣呼叫 `deletion_remote(repo, auto_push)`。

- `discard_snapshot` 呼叫 `server_tip`（`agf.js:2121`），確認前、確認後各一次（`agf.js:2470`、`agf.js:2485`），刪分支前再一次（`agf.js:2500`）。

- off 時遠端分支不會被刪，也不會列進確認清單（`agf.js:2479`、`agf.js:2504`），`ls-remote` 的結果只用來印一行「origin/<key> 保留不動」（`agf.js:2516`）。**推論**：ditch 的 `ls-remote` 在 off 時對安全沒有實質貢獻，拿掉的風險很低。

現有測試只證明「off 不會 push」，沒證明「off 不連線」：

- **事實** `agf.test.js:1822-1856` 只把 push URL 改壞（`set-url --push`），fetch URL 仍可連，所以 cleanup 的 fetch 照樣成功。

- **事實** 沒有任何測試涵蓋「origin 連不上 / 403」或「預設分支只在本機」的 cleanup。

## 2. 和現有文件、規則的衝突

這個 issue 和下列已記錄的設計直接衝突：

- **事實** `references/streams.md:68`：「off 時 cleanup 只合併、移除本機 ref 和 worktree。It may fetch and inspect origin for divergence」。

- **事實** `docs/agent/FEATURES.md:101`：「cleanup/ditch retain remote inspection and safety checks」。

- **事實** A-003 Reply（`.agentflow/devlog.md:221`）：「Cleanup/ditch still inspect remote state for safety.」。commit `5480558` 訊息也只承諾「leave remote refs unchanged」。

- **事實** `ag-settings.js:2057` 的設定說明寫「controls Agentflow pushes for feature streams」，只講 push。

但也有文件支持 issue 的期待：

- **事實** `docs/AG_GUIDE.md:201`「a feature stream that stays local throughout」，`docs/AG_GUIDE.md:241`「off keeps a stream's full lifecycle local」。

- **事實** `docs/AG_GUIDE.zh-tw.md:182`「全程只留在本機」，`:222`「完整流程只修改本機 Git」。

- **事實** A-003 你原本的要求只有「若為 off，則不會自動 push」（`.agentflow/devlog.md:173-174`）；「cleanup 仍檢查遠端」是實作者自己加的安全取捨，不是你指定的。

結論：

- **推論**：這是**刻意推翻 A-003 的實作設計**，不是單純修 bug。但從使用者手冊的承諾來看，現在的行為確實讓人誤會，所以也帶有修正文件與行為不一致的性質。

- **推論**：沒有任何 `— I-NNN` 事故規則要求 cleanup 必須 fetch。最接近的是 I-032（`docs/incidents-log.md:199-203`，結案紀錄在 push 之後才 commit 而遺失），但它保護的是「刪分支前工作有被保存」；off 模式下工作合併進本機主分支後才刪本機分支，這個保護仍然成立。

- 改動 `streams.md`、`SKILL.md` 時要注意：它們是給其他 agent 讀的產品 prompt，`prompt-compression.test.js:109-127`、`alignment.test.js:144`、`alignment.test.js:244`、`ag-settings.test.js:23` 會檢查內容（**事實**，只確認有讀取這些檔案，未逐條比對受影響的斷言）。

## 3. 需求清單

標記說明：**明確** = issue 已講清楚，可直接驗收；**待決** = 需要你決定，見第 5 節。

### R-1 off 時 cleanup 不連線（明確）

- 內容：stream 設定為 off 時，`agf cleanup` 不執行 `fetch`、`ls-remote`、`push`、`pull`。

- 通過範例：origin URL 設成不存在的路徑（例如 `git remote set-url origin /nonexistent.git`），`agf cleanup login-page` 成功結束，本機主分支多一個 `merge: login-page — feature closed (agf cleanup)` commit，worktree 和本機分支都被移除。

- 失敗範例：輸出 `main checkout fetch failed` 或 `could not inspect the remote feature branch`。

### R-2 off 時 cleanup 不要求遠端分支或 origin 設定格式（明確）

- 內容：不要求 `origin/<def>`、`origin/<key>` 存在；也不要求 origin 只有一個 fetch URL（現在 `agf.js:2087-2089` 會擋）。

- 通過範例：預設分支 `develop-ag` 只在本機（`agentflow.default-branch=develop-ag`），遠端沒有這個分支，cleanup 成功。

- 失敗範例：輸出 `could not snapshot origin/develop-ag after fetch` 或 `origin must have one fetch destination`。

### R-3 off 時 cleanup 保留所有本機安全檢查（明確）

- 內容：以下現有檢查一個都不能少（全部是 **事實**）：主工作區必須在預設分支（`agf.js:2173-2186`）、key 必須精確對應（`agf.js:2188-2194`）、不能從目標 worktree 內執行，I-058（`agf.js:2202-2209`）、worktree 只能有可辨識的本機檔案（`agf.js:2211-2220`）、主工作區不能有未保存變更（`agf.js:2293-2301`）、交付不能覆蓋未追蹤檔（`agf.js:2307-2315`）、合併衝突會 abort（`agf.js:2316-2330`）、合併結果必須包含 feature tip（`agf.js:2333`）、刪除前重新比對 worktree 與本機 tip（`agf.js:2359`）、本機檔案先保存再刪（`agf.js:2363-2385`）、本機分支用 compare-and-delete 刪除（`agf.js:2150-2152`）。

- 通過範例：off 且離線時，worktree 裡有未 commit 的檔案，cleanup 仍拒絕並印出 `still has unsaved changes — nothing was changed`。

### R-4 off 時 ditch 不連線（明確）

- 內容：`agf ditch` 在 off 時不執行 `ls-remote`，確認清單只列本機 worktree 和本機分支；確認前後的比對改用本機狀態。

- 通過範例：origin 連不上，`agf ditch login-page` 回答 Y 後成功刪除 worktree 和本機分支。

- 失敗範例：輸出 `could not inspect branch tips — nothing was changed`（`server_tip` 回傳 null 時的訊息，`agf.js:2123`）。

### R-5 其餘生命週期指令維持不連線，並補回歸測試（明確）

- 內容：`new`、`finish --prep`、`finish --deliver`、stream 的 `close` 現在 off 時已不連線（第 1 節表格），只需在「origin 連不上」的情境補測試鎖住。

- 通過範例：origin 指向不存在路徑時，完整走一次 `new` → `finish --prep` → 本機 closing commit → `finish --deliver` → `cleanup`，每一步都成功。

### R-6 off 時不改遠端 refs，也不改本機 remote-tracking refs（明確）

- 內容：遠端 refs 本來就不改；拿掉 fetch 之後，本機 `refs/remotes/origin/*` 也不會被更新。

- 通過範例：cleanup 前後 `git for-each-ref refs/remotes/origin` 輸出完全相同，遠端 `ls-remote` 結果也相同。

### R-7 on 模式行為不變（明確）

- 內容：on 模式仍 fetch、檢查分歧、push、刪遠端分支，失敗訊息不變。

- 通過範例：現有 `agf.test.js` 中所有 on 模式的 cleanup/ditch/finish 測試不修改就通過。

### R-8 設定來源規則不變（明確）

- 內容：沿用 `stream_auto_push`（`agf.js:1029-1061`）的判斷順序：有 worktree 讀 worktree 的 `ag.json`；沒有就讀 stream 分支上 commit 的設定，再來是已交付的副本，最後是本機 `refs/remotes/origin/<key>`。設定讀不到就拒絕（`agf.js:2198-2199`、`agf.test.js:1907-1926`）。

- **推論**：這個判斷只讀本機資料，不連網路，可以保留。

### R-9 只有遠端 feature 分支的 stream（待決，見 D-3）

- **事實** 現在 `agf.js:2305` 用 `feature_tip || remote_feature_tip_after` 當合併來源；本機分支不存在時會改合併 `ls-remote` 查到的遠端 tip。

- 離線後 `remote_feature_tip_after` 永遠是空字串，本機分支不存在時會落到 `agf.js:2306` 的 `feature branch changed or could not be inspected`，訊息會讓人看不懂。

### R-10 off 時的輸出訊息（待決，見 D-5）

- 內容：要清楚說「沒有連線到遠端、遠端沒被更動、本機主分支可能與遠端不同步」，不能暗示已發布。`streams.md:68` 已要求「不要把本機結果說成已發布」。

### R-11 主工作區事後的 push（待決，見 D-1）

- 見第 4 節第一點。

### R-12 文件同步（明確，但用詞待決）

- 需要同步修改：`references/streams.md:68`、`docs/agent/FEATURES.md:101`、`SKILL.md:177`（目前寫「不改遠端 refs」）、`ag-settings.js:2057` 的設定說明、`docs/AG_GUIDE.md:201,241`、`docs/AG_GUIDE.zh-tw.md:182,222`。

- 改 `ag-settings.js:2057` 的顯示文字可能影響 `ag-settings.test.js` 的斷言（**推論**，未逐條確認）。

## 4. 範圍邊界的模糊點

### 4.1 主工作區的 closeout push 算不算「stream 操作」

- **事實** `SKILL.md:169`：Git repo 裡每個有意義的單位都要 commit，「有 remote 就 push，除非 active stream 是 off」。主工作區沒有 active stream，所以照樣 push。

- **事實** `agf.test.js:1330-1344` 明確測試「off 不影響主工作區 push closeout」；`AG_GUIDE.md:241` 也寫 off「does not change main-workspace delivery」。

- **事實** `streams.md:72` 規定 cleanup 後由主工作區 session 記錄合併與刪除，那一輪 closeout 就是主工作區 closeout。

- **推論**：cleanup 離線成功後，主工作區那一輪 closeout 會把含有 stream 合併結果的主分支 push 到 origin。這樣一來，(a) stream 內容還是被發布了；(b) 遇到 403 時，closeout 一樣卡住，只是卡的位置從 cleanup 移到 closeout。issue 的驗收條件「off 模式下所有 stream 操作均不發出遠端請求」如果包含這一步，修改範圍會擴大到 host 規則和 round linter。

### 4.2 讀本機 remote-tracking ref 算不算「存取遠端」

- **事實** 下列地方會讀本機 `refs/remotes/...`，但都不連網路：`default-branch.js:17`（`origin/HEAD`，檔頭註明 offline，`default-branch.js:4`）、`known_keys` → `branch_names`（`agf.js:594-597`、`agf.js:617-621`）、`stream_auto_push` 的最後備援（`agf.js:1057`）、cleanup 的 `remote_tip_before` / `remote_feature_before`（`agf.js:2230-2235`）。

- **事實** `git remote`、`git remote get-url` 只讀本機設定，不連網路。

- **推論**：issue 列的都是網路指令，讀本機快取應該不算違反；但需要你確認（D-2）。

### 4.3 只存在遠端的 feature 分支

- **事實** `known_keys` 會把只存在於本機 remote-tracking ref 的分支名稱也當成「已知 stream」（`agf.js:594-597`）。

- **推論**：off 模式 cleanup 刪掉本機分支後，如果之前有人手動 push 過 `origin/<key>`，本機快取還留著；下次再對同一個 key 跑 cleanup，會通過「名稱存在」的檢查，接著卡在 `agf.js:2306` 的含糊訊息。

- 另一種情況：這個 stream 是別台機器建立、只 push 到遠端、本機從沒有分支。off 模式下 Agentflow 是否該處理這種 stream，需要你決定（D-3）。

### 4.4 stream 設定和 root `ag.json` 不同

- **事實** `agf new` 讀的是 root 設定（`agf.js:2031`），建立後把設定複製進 stream；之後 finish/cleanup/ditch 都讀 stream 自己的設定（`agf.js:1131`、`agf.js:2198`、`agf.js:2464`），`streams.md:68` 和 `AG_GUIDE.md:201` 也說 stream 可獨立調整。

- **推論**：root 是 on、stream 改成 off，cleanup 就依 stream 走離線；反過來也一樣。這部分規則已經清楚，不需改。

### 4.5 stream 進行中切換設定

- **on → off**（建立時已 push 過）：離線 cleanup 會刪本機分支，遠端 `origin/<key>` 保留。**推論**：如果別人在這段期間往 `origin/<key>` 推了新 commit，離線 cleanup 不會發現，stream 被標成已結案但遠端還有沒合併的工作。遠端資料不會遺失，但可能被遺忘。

- **off → on**：回到現有 on 行為（fetch、push 主分支、刪遠端分支）。**推論**：若遠端從沒有這個分支，`remote_feature_tip_after` 是空字串，`agf.js:2388` 不會嘗試刪除，行為正常。

### 4.6 git 自己可能偷偷連線的情況

- **推論**：若 repo 是 partial clone（例如 `--filter=blob:none`），`git show <ref>:<path>` 或 merge 讀到本機沒有的物件時，Git 會自動向 promisor remote 補抓。這時即使 Agentflow 沒有下 fetch，仍會發出網路請求。是否要處理（例如設定禁止 lazy fetch 的環境變數），需確認你的 repo 是否用 partial clone（U-4）。

- **推論**：使用者自己設定的 git hooks（例如 `post-merge`）若有連網行為，Agentflow 無法控制，不應列入驗收。

### 4.7 少了遠端分歧檢查的後果

- **事實** 現在 cleanup 會在 `origin/<def>` 比本機新或分岔時拒絕（`agf.js:2256-2259`）。

- **推論**：拿掉後，本機主分支可能和遠端分岔。之後你手動 push 時 Git 會拒絕非 fast-forward，不會覆蓋遠端，所以**不會遺失資料**，只是要自己 pull/merge。這正是 off 模式「發布由你手動處理」的預期代價。

## 5. 需要你決定的事項（每項附建議預設值）

- **D-1 主工作區事後的 push 要不要一起停？**
  - 建議預設：**這次不動**。issue 指的是 `agf` 的 stream 指令，主工作區 push 是另一套規則，而且有測試鎖住（`agf.test.js:1330`）。在 cleanup 的輸出和文件中明講「主工作區下一輪 closeout 仍會依規則 push 主分支」。若你要主工作區也離線，建議另開一個設定，不要擴大 `stream-auto-push` 的意義。

- **D-2 讀本機 remote-tracking ref 算不算存取遠端？**
  - 建議預設：**不算**。只禁止網路指令（`fetch`、`ls-remote`、`push`、`pull`、`remote update` 等）。`default-branch.js` 和 `stream_auto_push` 的本機讀取維持現狀。

- **D-3 本機沒有 feature 分支、只有遠端（或本機快取）有時怎麼辦？**
  - 建議預設：**off 時拒絕，並給清楚訊息**，例如「stream-auto-push is off — only the local branch can be cleaned; no local branch <key> exists」。不要拿過期的本機快取當合併來源。

- **D-4 離線 cleanup 要不要用本機快取提醒可能的遠端差異？**
  - 建議預設：**不阻擋，只提醒**。若本機 `refs/remotes/origin/<key>` 有本機分支沒有的 commit，印一行提醒（純本機比對，不連網路）；不因此拒絕清理。若想最小改動，也可以完全不提醒。

- **D-5 off 時的輸出訊息怎麼寫？**
  - 建議預設：一行說清楚「stream-auto-push is off — origin was not contacted; remote refs and local remote-tracking refs are unchanged」。保留現有「merge remains local」字樣，避免動到現有測試斷言（`agf.test.js:1851`、`agf.js:2354`）。

- **D-6 設定名稱要不要改？**
  - 建議預設：**不改名**，擴充 `off` 的意義為「stream 生命週期完全不連遠端」，同步更新 `ag-settings.js:2057` 的說明文字。改名會牽動設定驗證、遷移和所有文件，超出這次範圍。

- **D-7 版本與 CHANGELOG 要不要一起處理？**
  - 建議預設：**這次不發版**。`FEATURES.md:101` 標示此設定仍是 unreleased，延續 A-003 的做法，只改程式、測試和文件。

## 6. 未知數

- **U-1** 你的 `develop-ag` 是用 `agentflow.default-branch` 指定，還是來自 `origin/HEAD`？如果是後者，代表本機快取指向一個遠端已不存在的分支，屬於另一個問題。目前無法從 repo 確認。

- **U-2** 出事的 stream 有沒有手動 push 過 feature 分支？這影響 D-3、D-4 的實際需求。

- **U-3** 那兩次失敗後，主工作區的 closeout push 是否也遇到 403？這決定 D-1 是否其實也是你的痛點。

- **U-4** 你的 repo 是否使用 partial clone？若是，「完全不發出遠端請求」需要額外處理（見 4.6）。

- **U-5** 你的環境是否有 `origin` 以外的 remote？**事實** `agf new` 只要有任何 remote 就算 `has_remote`（`agf.js:2030`），`finish_context` 只看 `origin`（`agf.js:1126`），`deletion_remote` 先看任何 remote 再取 `origin`（`agf.js:2085-2086`）。off 模式離線後這個差異影響不大，但若你要求「on 模式完全不變」，就不應順手統一。

## 7. 可行性與影響評估

- **推論**：程式改動集中在兩處。`clean_main` 的 step 1（`agf.js:2242-2292`）、`server_tip` 呼叫（`agf.js:2268`、`agf.js:2359`）和 `deletion_remote` 呼叫（`agf.js:2222`）在 off 時跳過；`ditch_main` 的 `deletion_remote`（`agf.js:2468`）在 off 時不再要求 origin URL，讓 `discard_snapshot` 拿到空 URL（`server_tip` 遇到空 URL 會直接回傳空字串，`agf.js:2098`）。`auto_push` 在兩個函式中都已經比網路操作更早算好（`agf.js:2200`、`agf.js:2466`），所以不需要調整判斷順序。

- **推論**：測試需要新增「origin 指向不存在路徑」的 cleanup / ditch / 完整生命週期案例，以及「預設分支只在本機」的 cleanup 案例。現有 `agf.test.js:1822` 等 off 測試應維持通過。

- **推論**：文件要改的地方在 R-12 列出；其中 `streams.md`、`SKILL.md` 屬於產品 prompt，改完要跑對應測試。

Self-check: 已逐一確認 off 模式下 new/finish/deliver/close 不連線、cleanup 與 ditch 會連線（agf.js 行號已核對）；A-003 原始要求與 Reply 已讀；主工作區 push 規則與測試已核對；未修改任何其他檔案、未執行測試、未執行會改變狀態的 git 指令；partial clone 與使用者環境相關內容標為推論或未知數。
