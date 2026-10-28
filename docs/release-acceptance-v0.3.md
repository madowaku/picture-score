# MDE Polish v0.3 公開前受入

対象: [Issue #65](https://github.com/madowaku/picture-score/issues/65)。調査日: 2026-10-28 (JST)。
基準 main: `67489dc780bebbf4d1f38762300a2170d68e25b4`。
ここでいう v0.3 は MDE Polish の受入であり、package.json / README の作品体験 v0.7 をダウングレードするものではない。

## 判定

**公開は HOLD。クラウドの機能受入は GO、アクセシビリティは REVIEW / HOLD、Android実機項目は要実機確認。**
保存・復帰・描画等の機能試験9項目は成功。日英・キーボード操作は成功したが、axeで指摘があり10番目の項目を REVIEW とした。
生成MP4の実codecは **VP9 + Opus**。H.264 + AACでも、SNS互換性確認済みでもない。
GitHub Actions の成功だけで Issue #65 の Android・SNS・PWA 受入を PASS にしない。
このPRは公開、デプロイ、mainへのマージを行わない。

## 確定した実行証跡

- 検証コードSHA: `3e4d985e36db1369ca8ce3806403959df8719ab6`。以後の受入結果追記は文書のみ。
- [クラウド受入 Run 40636021074](https://github.com/madowaku/picture-score/actions/runs/40636021074): 2026-10-28 14:06–14:11 JST、成功。Ubuntu 24.04.5、Node 22.23.4、Chromium 141.0.7390.37、ffprobe 6.1.1-3ubuntu5。
- [既存CI Run 40636021077](https://github.com/madowaku/picture-score/actions/runs/40636021077): 118単体テスト、型検査・ビルド、Garden保存・満杯救済・共有フォーカスの3回帰試験が成功。
- [証跡ZIP](https://github.com/madowaku/picture-score/actions/runs/40636021074/artifacts/12793058564): 動画、フレーム、画面、結果JSON。期限は2026-11-11 14:11 JST。期限後もこの受入表とActionsログに測定結果を残す。
- 初回 Run 40635766965 はnpmのQAツール導入時に `edgesOut` エラーで停止。製品試験の失敗ではない。`--package-lock=false` を外し、上記Runで全件を再実行した。
- 作品消失・主要操作不能・失敗後の生成復帰不能は今回の条件では未検出。製品コードの修正は0件。

## 調査した資料と保護対象

- [製品化計画](product-release-plan.md): 公開URL、手動更新、バックアップ、実機でのオフライン受入。
- [作品帳と共有](sketchbook-sharing.md): 保存の同一性、録画・キャンセル・フォールバック。
- [Recovery & Polish](recovery-sprint-v0.1.md): 9/21公開版と統合前mainの違い。過去の測定は今回の結果と区別する。
- [#62](https://github.com/madowaku/picture-score/pull/62): 12作品の庭で選んだ作品だけ休ませる、取消・離脱時に復元。
- [#63](https://github.com/madowaku/picture-score/pull/63): 共有を閉じた同じ処理内で開いたボタンへフォーカスを戻す。
- [#64](https://github.com/madowaku/picture-score/pull/64): ぷち音符・発光・再生ヘッド。元の線、動画比率、録音経路を保持。

製品の `src/`、素材、依存定義は変更しない。既存の3本の `qa-*` と118単体テストを維持する。
`verify-share-edge-cases.cjs` は React が共有可否を判定する前に Web Share のテストダブルを設定する。
旧 `verify-language.cjs` は旧 DRAW 画面前提のため今回の根拠に使わず、新しい現行画面の試験で補う。
`verify-garden-release.cjs` は本番URLを参照するため今回実行しない。

## クラウド再現条件

- GitHub Actions `v0.3 cloud acceptance`、Ubuntu 24.04、Node 22、Playwright 1.56.1 / 同梱 Chromium、axe 4.10.2。
- `npm ci` → `npm test` → `npm run build`。本番向け dist を localhost:4173 で配信。モジュールを利用する旧試験と画面検査は開発サーバー localhost:5173 を使う。
- 共有動画の復帰試験・正方形/縦長の実録画・PWA再起動は dist に対して行う。公開URL未設定のビルドであり、`build:release` / 本番オリジン更新の受入ではない。
- 全て隔離したコンテキスト／一時プロファイルの合成作品。利用者の作品・ブラウザプロファイルを使わない。
- 画面幅320/360/390/844/1280px。既存モバイル試験の375/760px、CDPタッチも実行。端末CPU・GPU、ソフトキーボード、TalkBack、Android Chromeではない。
- MP4候補をネイティブAPIで選択。WebM試験だけ対応形式をWebMに絞る。成功時のエンコーダ・音声合成は実物。
- Web Shareはテストダブル。`AbortError` / `NotAllowedError` を注入し、実際のOS共有・SNS通信は行わない。
- 生成失敗はconstructor / recorder error / empty blob / 60秒タイムアウトの短縮注入。非表示は `document.hidden` と `visibilitychange` の注入。実機のプロセス終了やOSメモリ圧迫の代替にはしない。
- 保存の容量不足はIndexedDB書き込み例外を注入する。ディスクを実際に満杯にしない。
- PWAはSW制御を確認 → 下書き・作品帳・庭へ保存 → ブラウザプロセス終了 → **配信サーバー停止を確認** → 同じ一時プロファイルでプロセス起動、ネットワークoffline → SW経由の応答・保存内容の一致・描画・保存・動画を確認。

再実行:

```sh
npm ci
npm test
npm run build
npm install --no-save playwright@1.56.1 @axe-core/playwright@4.10.2
npx playwright install --with-deps chromium
# ffmpeg/ffprobe、日本語フォントが必要（CIで導入）
node scripts/qa-garden-navigation.mjs
node scripts/qa-garden-full-planting.mjs
node scripts/qa-share-focus.mjs
node scripts/qa-release-acceptance.mjs
node scripts/qa-release-media.mjs
```

`QA_ONLY=video-recovery` などで単独調査可能。ただし部分実行を全件成功とは扱わない。
Windowsの補助実行では `PLAYWRIGHT_BROWSERS_PATH` をインストール先に合わせる。

## リリース受入表

| 項目 | クラウド試験・根拠 | 結果 | 残る実機条件 |
| --- | --- | --- | --- |
| 主要体験・色・線幅 | creation-flow、Undo/Redo、完成・試聴・作品帳・庭 | PASS（クラウド） | 指描画、実スピーカー、低性能端末 |
| 満杯の庭 #62 | qa-garden-full-planting、取消・復元・12件保持 | PASS（クラウド） | 実タッチ・スクロール |
| フォーカス #63 | qa-share-focus、Studio/作品帳/完成画面、閉じる/Escape | PASS（クラウド） | TalkBackの読み上げ順 |
| 動画 #64 | 正方形720×720、縦長720×1280、ぷち音符、フレーム証跡 | PASS。実ファイルの2秒フレームで音符・発光・再生ヘッドを目視 | 端末再生・性能・知覚的な音声同期 |
| 実コーデック | ffprobeでcontainer/video/audioを別々に取得、全フレームとPCMをdecode | 解析PASS。MP4=VP9/Opus、WebM=VP8/Opus。SNSは未合格 | 対象SNSへの取り込み可否 |
| 生成失敗・復帰 | 7条件それぞれ失敗後にネイティブ再生成・再生、track/context/URL解放 | 7/7 PASS（注入条件） | OS中断・復帰、メモリ不足 |
| 動画・代替保存 | downloadイベントと実ファイル、WebM、非対応時PNG/WAV | PASS。共有取消・失敗から保存への案内も成功 | Androidの保存先、ファイルアプリからの再生 |
| 作品保存 | 再読込、同一ID更新、失敗時保持、再試行、backup衝突・原子性 | PASS（IndexedDB例外注入を含む） | 実容量不足、ブラウザ消去、更新時の保存保持 |
| PWAオフライン再起動 | サーバー停止、実ブラウザプロセス再起動、SW応答、3種保存保持 | PASS（desktop Chromium） | インストール、ホーム起動、強制終了後の再起動 |
| モバイル画面 | 日英×5画面サイズ×4画面、横overflow・ナビ遮蔽、既存タッチ試験 | PASS（エミュレーション） | キーボード、端末safe area、向き変更 |
| アクセシビリティ | axe WCAG A/AA、Tab/Shift+Tab、Escape、フォーカス復帰 | キーボードPASS、axe REVIEW / HOLD（下記） | TalkBack、描画代替、実利用での操作 |
| 日本語・英語 | html lang、名前/元線/保存不変、演奏状態維持、言語保持、共有画面 | PASS。単数形の軽微な文言所見あり | OS共有・PWA名のローカライズ |

## 実ファイルの測定

| ファイル | コンテナ / 映像 / 音声 | 寸法 | 動画尺 / PCM音声尺 | peak / RMS |
| --- | --- | --- | --- | --- |
| square.mp4 | MP4 / VP9 / Opus | 720×720 | 8.369600 / 8.20秒 | 0.1394 / 0.0349 |
| portrait.mp4 | MP4 / VP9 / Opus | 720×1280 | 8.348967 / 8.20秒 | 0.1396 / 0.0349 |
| offline.mp4 | MP4 / VP9 / Opus | 720×720 | 10.732933 / 10.60秒 | 0.2137 / 0.0316 |
| sketchbook-fallback.webm | WebM / VP8 / Opus | 720×720 | ヘッダーに尺なし / 8.28秒 | 0.1874 / 0.0306 |

MP4の開始時刻は映像/音声とも0。WebMは映像0、音声0.034秒。全映像をdecodeでき、音声は非無音かつpeak<1だった。これだけで知覚的同期やSNS取り込みを合格にしない。
このChromiumでは `video/mp4;codecs=avc1.42E01E,mp4a.40.2` は非対応、汎用 `video/mp4` は対応。ファイル拡張子や過去のH.264/AAC記録から今回のcodecを推定できないことを実測で確認した。

## 証跡の読み方

Actions artifact `v03-acceptance-<SHA>`（14日保持）に `acceptance.json`、`media.json`、`axe.json`、生成動画・PNG・スクリーンショットを保存する。失敗時も途中までの結果を残す。一時ブラウザプロファイルはアップロードしない。

- `acceptance.json`: 実行日時、OS、Node、Chromium、コミットSHA、各試験の成功/失敗。
- `media.json`: コンテナ・映像/音声コーデック、寸法、尺、音声peak/RMS、開始時刻。`h264aac=false` をSNS互換性PASSとしない。
- `axe.json`: 自動検査の違反と人による確認が必要な項目。ブラウザジョブの成功はWCAG適合宣言ではない。
- painter画像は描画の静止証跡。`*-frame.png` は実ファイルから切り出す。自動的な意味判断や実機での知覚的同期は保証しない。

## アクセシビリティ・表示の所見

クラウドとWindows補助実行（Chromium 141.0.7390.37、axe 4.10.2）の両方で同じ指摘を確認。日英10画面の走査で2種類のルール・16ノード（言語重複を含む）、`incomplete` は各画面に残った。

| 対象 | 所見 | 判定材料 |
| --- | --- | --- |
| Studio「できた！」、消しゴムの文字 | contrast 4.11 / 3.32 | axe `color-contrast`、通常文字4.5:1を満たさない |
| 作品帳の日付、複製・JSON操作 | contrast 3.91 / 4.09 | 同上。日英とも再現 |
| 共有ダイアログの1:1 / 9:16 | contrast 3.43 / 3.93 | 同上 |
| `.garden-clock` | roleのないspanにaria-label | axe `aria-prohibited-attr`。読み上げ意味づけの再確認が必要 |
| 複雑な背景上の文字 | 自動測定不能の `incomplete` | 自動検査を通過したとは数えない |
| 英語の単数表示 | `1 creations` / `1 strokes` | 軽微な文言。機能・作品名の保持に影響しない |

axe上の影響分類は `serious`。WCAG A/AA受入は未合格として **REVIEW / HOLD** にする。
これは作品消失・操作不能などの動作上の重大障害と同一の判定ではない。主要操作はキーボードで到達でき、共有中に背面の操作へフォーカスが移らないこと、閉じた直後の復帰を確認した。
ネイティブdialogのTab循環ではブラウザUIにフォーカスが移る場合があり、これは背面のアプリ要素への流出と区別している。
今回は「重大不具合の場合のみ小さく修正」という範囲に従い、既存の配色・ARIA・文言の一括改修は行わない。公開前のアクセシビリティ基準と修正範囲を別途判断する。

## 残る試験の境界

成功した録画は数秒〜十数秒の固定曲尺。長時間の連続描画、60,000点付近の大規模作品、OSメモリ圧迫、実ディスク容量不足の性能受入は未実施。
音声の非無音とデコード成功はファイルで確認するが、スピーカー出力や知覚的な映像・音の同期には実機での視聴が必要。
ホーム追加の実インストール、PWAのmanifest名の言語切替、本番オリジン更新も今回の成功範囲に含めない。

## GO / HOLD / 要実機確認

**クラウド範囲のGO条件**: 全必須試験が成功、保存消失・操作不能・生成から復帰不能がない。生成ファイルの実codecとアクセシビリティ所見をレビュー済み。

**HOLD条件**: 保存の破壊、主要操作不能、継続的な無音/動画生成不能、重大なアクセス障壁、必須試験失敗が未説明。クラウド試験が未完了の場合も未合格とする。重大不具合が再現した場合に限り、小さな修正と失敗を再現する回帰テストをセットにする。

**要実機確認**: A401OPの端末名・Android/Chrome・画面寸法・日時・SHAを記録し、Issue #65 の手順でUSB localhostから検証。サーバーを停止してホームからPWAを起動し、作品保持・描画・実発音を確認。正方形/縦長動画を端末へ保存・再生し、実codecを記録。対象SNSに取り込み投稿直前のプレビューまで確認する（投稿は不要）。OS共有の取消・復帰、背景遷移、TalkBackも記録する。

**公開GO**: 上記クラウド結果と実機結果を揃え、公開責任者が判断する。元のNetlifyオリジン上の旧版→新版更新・既存作品保持は別の公開手順で確認する。今回のlocalhost新規プロファイルだけでは証明できない。
