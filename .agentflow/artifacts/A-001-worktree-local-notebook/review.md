* _2026-10-02 15:03:17 +0800 (inherited/inherited)_

# Worktree-local notebook 實作審查

- **結果符合要求。** 手動建立的 linked worktree 可由第一則 `godev worktree-local-notebook: on` 初始化，之後 startup、capture、progress、compact、close 使用同一本本地 notebook，Git 功能保留。未發現本次範圍內的阻擋問題。

- **完整 suite 尚未全綠。** 新功能 20/20 PASS，真實 Windows PTY 流程 PASS；完整 suite 的 39 個失敗均有 baseline 對照或受控重現，154 個 skipped 不視為通過。被 ignore 的 notebook 無法建立 close commit，仍是設計明確保留的限制。

- Host 可繼續做最後的交付檢查；本報告只判定凍結的實作符合設計，沒有替 host 執行 closeout、commit 或 push。

Reviewed commit: eee1e12b87906ad86523db18996b16330abf5ea4

Plan commit: `bd9b2f7`

Original baseline: `efcc300cf03acd118dc7beced1f23fa7bb94c148`

Outcome: PASS

Minimality: PASS

Conformance: PASS

## 要求與實作

- 直接從 `.agentflow/devlog.md` 的 A-001 重建要求：實作外部 `C:/Projects/Development_CBM_ui/.agentflow/artifacts/worktree-local-notebook/design.md` 全部內容。已讀完整 design 與答案：Q1 接受 `on`／`true`、保存為 `on`；Q2 拒絕既有 canonical stream notebook；Q3 不改 `agf init`。本地 task design 與 `journey.md` 符合這些決定，AC-14 不在本次範圍。

- 設計 §4.1–4.2：`ag-settings.js` 的 optional switch、驗證、canonical serialization 與 help 已整合；省略設定即不啟用。`worktree-local.js:parse_worktree_local_request` 支援同行／獨立行、`+ `、`/godev`、大小寫及空白，並追蹤 fence 的字元與長度。`prepare_request` 在任何 pair 寫入前拒絕 canonical stream notebook，既有設定由原始 JSON 保存，只更新新 switch；`persist_migration: false` 防止額外保存 legacy metrics migration。

- 設計 §4.3–4.4／INV-2：`notebook-owner.js:worktree_local_paths` 對 root `ag.json` 與設定的 notebook 同時檢查 canonical safe path、未追蹤、Git ignore，拒絕 `<workspace>/features/` 下的 notebook。`worktree_local_notebook` 在每次解析重新檢查；不安全時明確指出路徑與 I-039，沒有退回 stream 規則繼續寫。已讀 I-039 narrative，確認防護仍針對 root 歷史誤入 feature branch 的事故。

- 設計 §4.5／INV-4：`agf.js:start_main` 先準備啟用、記錄 bootstrap 前後檔案身分，再使用 root config 與 local notebook。`stop-hook.js` 只解析、不初始化；`notebook-owner.js:guard` 拒絕其他 notebook；`ag-settings.js:active_config_path` 保持 root config。現有 writer、close 與 compact 已經經過 guard／verify，不必增加第二套寫入流程。

- 設計 §4.5(4)／INV-6：`resume-intake.js:stream_decision` 只省略 local worktree 的非預設分支理由，active stream、未證明來源的變更及 interrupted startup 判斷仍保留。首次建立的 config／notebook 有 bootstrap provenance。Local startup 跳過根目錄 `.gitignore` 與 hook 安裝，避免新增 Git 可見檔案；既有 input receipts 的 `.tmp/.gitignore` 會排除自身及暫存內容。

- INV-1／INV-3／INV-5 與 Q3：未啟用的 linked worktree 保留原錯誤；實際 `agf new` fixture 驗證正常 stream startup。主 checkout 與無 Git 資料夾忽略 request／saved-on 路由，保留 config bytes。Diff 沒有改 `linked_worktree`、`stream_doc`、`init_main`、`new_main`、`finish_main`、`clean_main`、`ditch_main`、`devlog-guard.js` 或 incident history。

## 最小化與文件一致性

- 新增概念都有 owner 要求：request parser 對應第一則訊息；共用安全判斷對應 I-039；local bootstrap 對應自動初始化與既有 config 保存；start／hook／guard／active config／intake 的接點對應單一 notebook。Git 可見 setup 的跳過由 INV-6 授權。Tests、PTY journey、使用說明與 v8.5.0 metadata 分別對應驗收、正常終端流程及設計 §4.5(7)。沒有新增依賴或鄰近修復。

- 獨立比較了兩個可刪減方案：直接重用 `initialize_project` 會拒絕「config 已存在、notebook 尚未建立」，而 canonical serialization 不能保留原始 metrics／安全 fallback 值；直接重用 `fast-lane.js` parser 沒有可用的通用 export，且不處理 `godev` 同行設定或 fence 字元／長度。保留小型 helper 能滿足現有要求；為了共用而改這兩個既有流程反而增加範圍。只改 startup 則無法讓 capture／guard 通過。

- 重新計算 `select_cross_check_plan(review-facts.json)`：`valid=true`、`level=full`；19 files／558 changed lines 與 shared routing／trust boundary 支持 full review。以下六項 inventory 已逐項讀取並核對。

| 檔案 | 判定 |
| --- | --- |
| `skills/agentflow/SKILL.md` | changed：optional switch、首次啟用與 ignore 條件符合實作。 |
| `skills/agentflow/references/streams.md` | changed：canonical stream 規則新增有限例外，I-039 防護與原 stream lifecycle 保留。 |
| `skills/agentflow/references/ag.md` | checked-no-change：工作路由與 artifact 規則未新增 layout 假設；設定／notebook 由既有解析與 guards 承接。 |
| `skills/agentflow/references/looper.md` | checked-no-change：queue、completion、ownership 與 lifecycle 契約未改；本次沒有新增 looper 行為承諾。 |
| `skills/agentflow/docs/AG_GUIDE.md` | changed：手動 worktree 的操作與拒絕條件準確。 |
| `skills/agentflow/docs/AG_GUIDE.zh-tw.md` | changed：與英文 guide 及 owner 選擇一致。 |

- `.claude-plugin/plugin.json`、`SKILL.md`、兩份 README 與 `CHANGELOG.md` 都使用 v8.5.0；更新的 `docs/agent/FEATURES.md`／`FLOWS.md` 保持英文，與 current source 相符。`git diff --check bd9b2f7 eee1e12` 通過。

## 驗證與限制

- 重用 host 在精確實作執行的 suite 與 focused evidence，沒有重跑完整 suite 或新增測試。`worktree-local.test.js` 的 20 個測試涵蓋 AC-1～13、較嚴格 fence、config metrics 保存、自訂 workspace、saved-on main／no-Git 與後續安全重新檢查。

- 已讀正常 journey 與實際執行腳本：host Windows PTY session `53655`，stdin／stdout／stderr 都為 TTY，script exit 0；start → 第二則 capture → progress → compact → close 使用 `.agentflow/devlog.md`，Git status 相同。Close validation PASS、Reply 已保存，`notebook_not_changed` 的 commit error／state／exit status 與同樣 exclude 的 main checkout 相同，符合 AC-7。

- Current 完整 scripts suite：1420 tests，1227 pass、39 fail、154 skipped。已讀 `.agentflow/.tmp/worktree-local-suite.log`；baseline failed-name batch 為 55 tests，18 pass、37 fail，沒有 baseline-only 差異。另兩個 install-hook 差異在 baseline 使用隔離 global Git config 與空 hooks fixture 重現為 2/2 fail，見 `.agentflow/.tmp/baseline-hooks-pair.log`／`baseline-hooks.gitconfig`。因此沒有把未核對的失敗宣稱為既有問題。

- baseline 失敗包括 Windows symlink `EPERM`、既有設定／Git fixture 差異及 SKILL.md 32 KiB budget。SKILL.md baseline 為 33,244 bytes，current 為 33,650 bytes，兩者均超過該既有測試；本次沒有放寬測試或順便壓縮 prompt。環境 skipped 與 baseline 失敗仍限制全套驗證，PASS 不代表完整 suite 全綠。

- 既有 hook tests 讀寫使用者的 global `core.hooksPath=C:/Users/user/.git-hooks`。Host 已確認目前 pre-commit 是可辨識的 Agentflow guard；缺少執行前 bytes snapshot，不能宣稱已復原原內容。本次 reviewer 未操作該目錄，測試 fixture 的 global-path 干擾應保留為後續提案。

- 本審查由 separate native reviewer 直接完成，`fork_turns=none` 提供 fresh context；與 host／實作者同 model family、共享 filesystem permissions，沒有強制 read-only sandbox。沒有啟動 Agentflow、再委派、修改 source／config／notebook、commit 或 push；唯一寫入是本報告。這些事實提供分開檢查的證據，不能宣稱異模型或 filesystem 隔離。

Self-check: 已由原始 Ask、完整 design／Q1–Q3、normal journey、精確 diff、source、六項 inventory 與 reconciled baseline 核對結果；無 substantive blocking finding，三個 verdict 各出現一次，限制未被當成通過。
