* _2026-10-07 15:08:03 +0800 (claude-opus-5-5/inherited)_

# A-004 explore：`stream-auto-push: off` 完全本機化的風險與未知數

**TL;DR**

- **可以改，而且不會弄丟資料。** 關閉時 Agentflow 從來不改遠端，只會刪本機已確認合併過的分支；遠端檢查只負責「擋下來」，不負責保護資料。拿掉之後最壞的結果是「本機和遠端越差越多」，不是工作消失。

- **只剩兩個地方還會連網路：** `agf cleanup`（`git fetch` 加 `ls-remote`）和 `agf ditch`（`ls-remote`）。建立、`finish --prep`／`--deliver`、`agf close` 在關閉時已經完全不連線。

- **要注意的風險：** 一是隊友推到遠端功能分支的 commit 不會被發現；二是本機主分支會和遠端越分越開；三是 cleanup 完之後，主工作區下一輪的推送規則仍可能把合併結果推上去，或再撞到 403。第三點不在這次 issue 範圍內，需要 owner 決定。

- **需要 owner 決定的事：** 「存取遠端」的定義、要不要用本機快取的遠端資訊發警告、只有遠端分支時要不要拒絕，以及文件要怎麼改。建議的預設值放在最後一節。

---

## 1. 可行性：關閉時能不能完全只看本機？

**結論：可以，沒有哪個步驟非得知道遠端狀態才會正確。**

- **事實：** 現在關閉時還會連網路的只有 cleanup 和 ditch。

  - cleanup：只要有 origin 就 `git fetch`（`skills/agentflow/scripts/agf.js:2243-2250`），而且要求 `origin/<def>` 存在（`agf.js:2251-2254`）。

  - cleanup 還會在兩個地方用 `ls-remote` 查遠端功能分支：`agf.js:2268` 和清理前的再確認 `agf.js:2359`。這兩處都沒有看 `auto_push`。

  - ditch：`discard_snapshot` 一律呼叫 `server_tip`，也就是 `ls-remote`（`agf.js:2120-2121`）。確認後重查一次（`agf.js:2485`），刪除前再查一次（`agf.js:2500`）。

- **事實：** 其他流程在關閉時已經不連線。

  - `agf new` 讀主專案 `ag.json` 的設定決定要不要推（`agf.js:2030-2038`）。

  - `finish --prep`／`--deliver` 全部由 `has_remote && auto_push` 控制（`agf.js:1758`、`1780`、`1806`）。

  - `agf close` 遇到關閉的 stream 會拒絕推送模式（`agf.js:2657-2658`）。

- **事實：** owner 回報的兩個錯誤訊息，都能在原始碼裡逐字找到。

  - `could not snapshot origin/develop-ag after fetch` 來自 `agf.js:2253`。我在 scratchpad 做了實驗：主分支只存在本機時，`git fetch` 成功（exit 0），但 `refs/remotes/origin/develop-ag` 不存在，`rev-parse` 回傳 1，重現了這個錯誤。

  - `main checkout fetch failed` 來自 `agf.js:2248`。另外，ditch 遇到 403 時，`server_tip` 會回傳 `null`，畫面顯示 `could not inspect branch tips — nothing was changed`（`agf.js:2123`）。後者是**推論**，沒有實際重現。

- **事實：** cleanup 的「讓主分支跟上伺服器」那一步，其實從來不會移動本機主分支。

  - 原因：程式先確認 `origin/<def>` 是本機主分支的祖先，不是就拒絕（`agf.js:2256-2260`）。通過之後才做 `merge --ff-only`（`agf.js:2285`），這時一定是 `Already up to date`。

  - 意思是：關閉時跳過整段，失去的只是「拒絕」的能力，不會少掉任何一次資料移動。

- **推論：** 只要所有改動都放在 `!auto_push` 的分支裡，開啟（on）時的行為可以完全不變。

  - 現有的開啟模式測試會守住這點，例如 `agf.test.js:2912`（遠端超前就拒絕）和 `agf.test.js:2959`（fetch 失敗就停）。

- **事實：** 改動時要順便處理兩個本機程式碼的卡點。

  - `deletion_remote(repo, false)` 會要求 origin 只有一個 fetch URL，否則報錯（`agf.js:2086-2089`）。如果有 remote 但不叫 `origin`，也會報錯。完全本機時這個檢查應該跳過，不然無法達成「不需要遠端設定正確」。

  - `const source = feature_tip || remote_feature_tip_after`（`agf.js:2305`）。沒有本機分支時，現在會改成合併遠端分支。完全本機時這條路沒有資料來源，要另外決定怎麼處理（見第 2 節情境 C）。

## 2. 關閉時跳過遠端檢查，會失去哪些保護？

前提事實：關閉時 cleanup／ditch 永遠不刪遠端分支（`agf.js:2388`、`agf.js:2504` 都要求 `auto_push`）。本機分支只在「合併後的主分支已包含它」時才刪（`agf.js:2332-2334`、`delete_local_tip` 用 `update-ref` 比對舊值，`agf.js:2147-2155`）。所以下面每個情境，遠端那份都還在。

**情境 A：有人手動推過功能分支，隊友又在遠端加了 commit，接著執行 cleanup**

- 現在：`origin/<key>` 比本機新，就拒絕（`agf.js:2270-2276`）。

- 完全本機之後：照常合併本機版本，然後刪掉本機分支和 worktree。

- 嚴重度：**不便，不會掉資料。** 隊友的 commit 還在 `origin/<key>`，因為關閉時不刪遠端；也可能還在本機的 `refs/remotes/origin/<key>`，因為 cleanup 不 prune。真正的風險是 owner 以為功能已經完整收尾，其實漏了隊友的部分。

- 只看本機的緩解做法：如果本機快取的 `refs/remotes/origin/<key>` 存在，而且不在合併結果裡，就**警告但不擋**，並說明「這是上次 fetch 時的資料」。結尾照現有的 `origin/<key> remains` 訊息提醒遠端還留著（`agf.js:2408`）。

**情境 B：`origin/<def>` 往前走了，本機主分支和遠端越差越多**

- 現在：拒絕（`agf.js:2257-2260`），或遠端歷史改寫時拒絕（`agf.js:2261-2266`）。

- 完全本機之後：照樣在本機合併。之後 owner 手動推送時，可能被拒絕（non-fast-forward），得自己 merge 或 rebase。

- 嚴重度：**不便。** 遠端和本機都沒有東西不見。

- 緩解做法：如果本機快取的 `refs/remotes/origin/<def>` 存在，而且不是本機主分支的祖先，就警告一次。owner 的 `develop-ag` 只存在本機時，就安靜跳過。

**情境 C：只有遠端功能分支，本機沒有這個分支**

- 現在：用 `ls-remote` 拿到遠端那一版，直接合併（`agf.js:2305`）。

- 完全本機之後：沒有遠端資料可用。可以選「拒絕」，或「合併本機快取的 `refs/remotes/origin/<key>`」。

- 嚴重度：**合併快取的話可能合到舊版本**，因為快取可能過期，但遠端仍完整保留。拒絕的話只是不方便。

- 補充事實：`known_keys` 會把 `refs/remotes/*` 也算成已知名稱（`agf.js:594-597`、`agf.js:617-621`）。所以只有快取分支時，cleanup 會通過名稱檢查，然後才在 `agf.js:2306` 停下，訊息寫的是「feature branch changed」，讓人看不懂。

- 建議：**拒絕**，並給清楚的指示，例如「這個功能只剩遠端副本；請自己 fetch，或用 `git branch <key> origin/<key>` 建本機分支」。

**情境 D：本機的 `refs/remotes/origin/*` 和伺服器實際狀態不一致**

- 完全本機之後，agf 不會再更新這些快取（現在的 fetch 會順便更新，`agf.js:2244`）。

- 這些快取可能落後，所以「沒有警告」不等於「遠端沒有新東西」，會漏報。也可能遠端分支早就刪了，快取卻還在，所以會誤報。

- 嚴重度：只影響警告準不準，不影響資料。警告文字要寫明「依上次 fetch 的結果」。

**情境 E：ditch（捨棄）**

- 現在：用 `ls-remote` 判斷遠端分支在不在，結果只拿來顯示訊息和比對前後（`agf.js:2479`、`2516`）。

- 完全本機之後：改用本機快取判斷，或乾脆不顯示。

- 嚴重度：無。關閉時本來就不刪遠端。

- 順帶發現（**推論**，屬於相鄰行為）：關閉時如果只剩遠端分支，現在的 ditch 會列出空的刪除清單、照樣問「are you sure?」，最後什麼都沒刪。改成完全本機後，會變成 `nothing to ditch`（`agf.js:2475`），反而比較合理。

**總結：** 找不到任何「拿掉遠端檢查後會讓工作真的消失」的情境。失去的都是「提早攔住、避免後續麻煩」的保護。

## 3. 「存取遠端」到底包含什麼？

- **事實：** 以下操作只讀本機，不會連網路。

  - `git remote`、`git remote get-url`：讀 `.git/config`（`agf.js:2083-2086`）。

  - `rev-parse refs/remotes/origin/*`：讀本機快取（`agf.js:2230-2235`）。

  - `default-branch.js` 的 `symbolic-ref refs/remotes/origin/HEAD`（`skills/agentflow/scripts/default-branch.js:17`）。檔案註解直接寫 `Selection is read-only and offline`。

  - `stream_auto_push` 的第三順位來源 `refs/remotes/origin/<key>`（`agf.js:1057-1059`）。

- **事實：** scratchpad 實驗顯示，就算 URL 是本機路徑（`../missing.git`），fetch 也會試著連過去並失敗。所以測試可以用「指向不存在的路徑」來證明程式沒有連線。

- **建議定義：** 「存取遠端」指任何會連到 remote 的 Git 傳輸動作，不管 URL 是網址還是本機路徑。

  - 包含：`fetch`、`pull`、`push`、`ls-remote`、`remote update`、不加 `-n` 的 `remote show`、`remote set-head -a`、`clone`、`archive --remote`。

  - 不包含：讀 `.git/config`、讀 `refs/remotes/*` 和 `origin/HEAD` 這些本機快取。

  - 附帶條件：關閉時可以讀快取，但**不能要求快取存在**，也**不能寫入快取**。

## 4. 相關 incident 與 I-NNN 規則

- **I-058**（`streams.md:62`、`agf.js:2203-2205`，不能在目標 worktree 裡執行 cleanup）：和這次改動無關，可以完整保留。**不衝突。**

- **I-032**（在 `incidents-log.md:199-203`，推送後才 commit 的收尾紀錄，因為刪分支而變成孤兒）：

  - 本機這邊的保護在 `agf.js:2332-2334` 和 `delete_local_tip`，和遠端無關，會保留。

  - 關閉時不刪遠端分支，所以遠端也不會出現孤兒。

  - 在 `streams.md` 裡沒有直接標 `— I-032` 的規則。**不衝突。**

- **I-034**（在 `incidents-log.md:211-215`，能清的沒清）：完全本機後，cleanup 在離線或 403 時也能完成，方向一致。**不衝突。**

- **I-018／I-031／I-035**（`streams.md:7`，stream 觸發和別人未提交的檔案）：和這次改動無關。

- **事實：** `streams.md:68` 那段「It may fetch and inspect origin for divergence」**沒有** I-NNN 標記。它是 A-003（5480558）刻意保留的設計：devlog `.agentflow/devlog.md:219` 寫著「Cleanup/ditch still inspect remote state for safety」。所以這次改動是推翻 owner 先前接受的設計，不是違反 incident 規則。

- **文件和原始碼的落差：** brief 寫這段在 `streams.md` 約第 232 行，但目前 HEAD 的 `streams.md` 只有 78 行，那句話在**第 68 行**。

## 5. 文件與測試合約的風險

**事實：哪些文件需要改**

- `skills/agentflow/references/streams.md:68`：「It may fetch and inspect origin for divergence」這句必須改。

- `docs/agent/FEATURES.md:101`：「cleanup/ditch retain remote inspection and safety checks」必須改。

- `skills/agentflow/SKILL.md:177`：目前寫 `off` keeps … from changing remote refs。這句不算錯，只是沒有承諾「不連網路」。

- `skills/agentflow/docs/AG_GUIDE.md:201`、`:241` 和 `AG_GUIDE.zh-tw.md:182`、`:222`：已經寫「全程只留在本機」「完整流程只修改本機 Git」。使用者讀了會以為完全不連線，這正是 owner 期待落空的原因。改完程式後，這幾處反而變得正確，可以不改，或只補一句「不連線」。

- `skills/agentflow/scripts/README.md:158`：只講 close，不需要改。

**事實：哪些測試在守這些文字**

- 我 grep 了所有 `*.test.js`（排除 `agf.test.js`、`ag-settings.test.js`、`round-linter.test.js`），沒有任何測試斷言「may fetch」「remote inspection」「leaves the remote」這些字。

- 會讀 `streams.md` 的測試，斷言的都是其他字串：

  - `prompt-compression.test.js:109-120` 檢查 `finish --prep` 和 `finish --deliver`。

  - `alignment.test.js:244-260` 檢查 `merge --continue` 等字串。

  - `ag-settings.test.js:20-24`、`:40` 檢查舊語法，例如 `` `feature: ``。改寫時要避免寫出反引號後面接 `feature:` 的寫法。

- `SKILL.md` 目前是 **36691 bytes**，超過 `prompt-compression.test.js:26-33` 設定的 32 KiB（32768 bytes）上限，所以**這個測試在改動前就已經失敗**。

  - 建議不要動 `SKILL.md`，非動不可就讓位元組數不增加，避免讓已經失敗的預算更糟。

- `agf.test.js` 會受影響：

  - `:1858` 的 ditch 測試，和 `:1895` 的 worktree 已刪除後 ditch 的測試，都斷言 `origin/login-page was left unchanged`。這個訊息現在由 `ls-remote` 觸發。

  - 這兩個測試都在 worktree 裡執行 `git push origin login-page`，所以本機快取 `refs/remotes/origin/login-page` 會一起更新。**推論：** 如果改用本機快取來判斷，這兩個測試可以不改。

  - `:1822` 在關閉時跑完整流程，只斷言 `merge remains local`，預期仍會通過。

- 需要新增的測試：

  - origin URL 指向不存在的路徑時，cleanup 和 ditch 都要成功。

  - 主分支只存在本機。

  - 功能分支只存在本機。

  - `refs/remotes/origin/*` 在執行前後完全沒變。

  - 遠端 bare repo 的 refs 完全沒變。

## 6. 其他未知數

- **Windows 和 Azure DevOps 的帳密提示（未知，開啟模式才有）：**

  - **事實：** `git()` 執行時把 stdin 設成 `ignore`，但**沒有**設定 `GIT_TERMINAL_PROMPT=0` 或 `GCM_INTERACTIVE`（`agf.js:335-366`；grep 找不到這些設定）。

  - **事實：** 本機 `credential.helper=manager`，來源是 `C:/Program Files/Git/etc/gitconfig`；Git 版本是 2.54.0.windows.1。逾時預設 30000 ms（`agf.js:32`、`ag-settings.js:15`）。

  - **未知：** Git Credential Manager 會不會跳出圖形視窗。如果會，agf 會卡到逾時才結束，而且 GCM 子程序可能沒有跟著結束。實驗時剛好碰到公司 proxy 回 `CONNECT tunnel failed, response 403`，無法驗證。

  - 完全本機化之後，關閉模式完全不會遇到這個問題；開啟模式照舊。建議另外開議題處理。

- **主專案和 stream 的 `ag.json` 設定不同：**

  - **事實：** `agf new` 讀主專案的設定（`agf.js:2031`）。之後 finish、cleanup、ditch 讀 stream 旁邊的設定，順序是 worktree → 本機分支 → 本機快取的遠端分支（`agf.js:1029-1063`）。

  - 建議：一律以 stream 自己的設定為準，也就是維持現狀，並在文件寫清楚。

- **stream 進行到一半才改設定（先 on、推過，再改 off）：**

  - **推論：** 因為推過，遠端已有 `origin/<key>`，也設好了 upstream。改 off 之後完全本機，就看不到隊友後來的 commit（情境 A），但遠端分支會一直留著，不會掉資料。

  - **事實：** `delete_local_tip` 用的是 `update-ref -d`，不會清掉 `branch.<key>.*` 的 upstream 設定。這是現有行為，開啟模式也一樣，和這次無關，放到之後再處理。

- **主工作區後續推送的缺口（重要，超出這次範圍）：**

  - **事實：** stream 設成 off 不影響主工作區（`agf.test.js:1330`，`SKILL.md:169`）。

  - **推論：** cleanup 之後，主工作區下一輪 `godev` 記錄結果時，會照 `SKILL.md:169` 推送主分支：有 remote 就推，第一次推之前先 fetch 檢查 `HEAD..origin/<branch>`。

  - 結果：owner 的 `develop-ag` 可能被推上去（遠端原本沒有這個分支），或者又撞到 403。也就是說，stream 這邊完全本機了，主工作區還是可能連線。

- **`SKILL.md:169` 的「第一次推送前先 fetch」：** 只在真的要推的時候才適用。stream 設成 off 時不推，所以不會觸發。**不衝突。**

- **環境事實：** 這台機器有全域 pre-push hook（`core.hooksPath=C:/Users/user/.git-hooks`，在 scratchpad 實驗時擋下了 push）。它只擋 push，**不擋** fetch 和 ls-remote，所以不能當成「不連線」的保證。

## 7. 風險排序

1. **中：主工作區下一輪仍會推送或 fetch。** stream 完全本機了，整體卻不是。owner 預期「全部只在本機」，實際上可能落空，或再撞到 403。

2. **中：隊友推到遠端功能分支的 commit 不會被發現（情境 A）。** 不會掉資料，但功能可能被誤認為已經收尾。

3. **低到中：只有快取分支時（情境 C），如果選擇合併快取，可能合到舊版本。** 選擇拒絕就沒有這個風險。

4. **低：本機和遠端越分越開（情境 B）。** 之後手動推送時要自己處理分歧。

5. **低：本機快取過期，造成警告漏報或誤報（情境 D）。**

6. **低：測試和文件要一起改。** `agf.test.js` 的 ditch 訊息、`streams.md:68`、`FEATURES.md:101`。`SKILL.md` 的位元組預算在改動前就已經超標。

## 8. owner 要決定的事（附建議預設）

1. **「存取遠端」的定義**

   - 建議：照第 3 節。不能有任何 Git 傳輸動作；可以讀本機快取，但不要求快取存在，也不寫入。

2. **關閉時要不要用本機快取發警告**

   - 建議：情境 A 和 B 都**只警告、不擋**，文字寫明「依上次 fetch 的資料」。

3. **只有遠端或快取分支、沒有本機分支時 cleanup 怎麼做**

   - 建議：**拒絕**，並告訴 owner 怎麼自己建本機分支。

4. **ditch 怎麼判斷遠端分支**

   - 建議：用本機快取 `refs/remotes/origin/<key>` 決定要不要顯示「遠端仍保留」的提示，不再呼叫 `ls-remote`。

5. **`deletion_remote` 的 URL 檢查**

   - 建議：關閉時整個跳過，沒有 origin 或有多個 URL 都不擋。

6. **主工作區推送缺口要不要一起處理**

   - 建議：**這次不處理**，另外開提案。這次範圍只限 stream 生命週期。

7. **文件怎麼改**

   - 建議：改 `streams.md:68` 和 `FEATURES.md:101`；`AG_GUIDE` 兩份最多補一句；不動 `SKILL.md`。

8. **開啟模式下帳密提示可能卡住的問題**

   - 建議：這次不處理，只記錄成未知數。

Self-check: 已回答 brief 第 1–7 題；所有行號都在目前 HEAD 5480558 的檔案上核對過；brief 寫的 `streams.md` 約 232 行與實際第 68 行不符，已在第 4 節註明；沒有執行專案測試，只在 scratchpad 跑了 Git 實驗，沒有改動 repository 的 refs、config、worktree 或其他檔案；`SKILL.md` 的 32 KiB 測試在改動前就失敗，是看檔案大小推得，沒有實際執行該測試。
