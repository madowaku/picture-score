# MDE Polish v0.3 公開前受入

対象: [Issue #65](https://github.com/madowaku/picture-score/issues/65)。調査日: 2026-10-28 (JST)。
基準 main: `67489dc780bebbf4d1f38762300a2170d68e25b4`。
ここでいう v0.3 は MDE Polish の受入であり、package.json / README の作品体験 v0.7 をダウングレードするものではない。

## 判定

**公開は HOLD。クラウド試験は実行・集計中。Android実機項目は要実機確認。**
GitHub Actions の成功だけで Issue #65 の Android・SNS・PWA 受入を PASS にしない。
このPRは公開、デプロイ、mainへのマージを行わない。

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
npm install --no-save --package-lock=false playwright@1.56.1 @axe-core/playwright@4.10.2
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
| 主要体験・色・線幅 | creation-flow、Undo/Redo、完成・試聴・作品帳・庭 | 集計中 | 指描画、実スピーカー、低性能端末 |
| 満杯の庭 #62 | qa-garden-full-planting、取消・復元・12件保持 | 集計中 | 実タッチ・スクロール |
| フォーカス #63 | qa-share-focus、Studio/作品帳/完成画面、閉じる/Escape | 集計中 | TalkBackの読み上げ順 |
| 動画 #64 | 正方形720×720、縦長720×1280、ぷち音符、フレーム証跡 | 集計中 | 端末再生・性能・知覚的な音声同期 |
| 実コーデック | ffprobeでcontainer/video/audioを別々に取得、全フレームとPCMをdecode | 集計中 | 対象SNSへの取り込み可否 |
| 生成失敗・復帰 | 7条件それぞれ失敗後にネイティブ再生成・再生、track/context/URL解放 | 集計中 | OS中断・復帰、メモリ不足 |
| 動画・代替保存 | downloadイベントと実ファイル、WebM、非対応時PNG/WAV | 集計中 | Androidの保存先、ファイルアプリからの再生 |
| 作品保存 | 再読込、同一ID更新、失敗時保持、再試行、backup衝突・原子性 | 集計中 | 実容量不足、ブラウザ消去、更新時の保存保持 |
| PWAオフライン再起動 | サーバー停止、実ブラウザプロセス再起動、SW応答、3種保存保持 | 集計中 | インストール、ホーム起動、強制終了後の再起動 |
| モバイル画面 | 日英×5画面サイズ×4画面、横overflow・ナビ遮蔽、既存タッチ試験 | 集計中 | キーボード、端末safe area、向き変更 |
| アクセシビリティ | axe WCAG A/AA、Tab/Shift+Tab、Escape、フォーカス復帰 | 集計中 | TalkBack、描画代替、実利用での操作 |
| 日本語・英語 | html lang、名前/元線/保存不変、演奏継続、言語保持、共有画面 | 集計中 | OS共有・PWA名のローカライズ |

## 証跡の読み方

Actions artifact `v03-acceptance-<SHA>`（14日保持）に `acceptance.json`、`media.json`、`axe.json`、生成動画・PNG・スクリーンショットを保存する。失敗時も途中までの結果を残す。一時ブラウザプロファイルはアップロードしない。

- `acceptance.json`: 実行日時、OS、Node、Chromium、コミットSHA、各試験の成功/失敗。
- `media.json`: コンテナ・映像/音声コーデック、寸法、尺、音声peak/RMS、開始時刻。`h264aac=false` をSNS互換性PASSとしない。
- `axe.json`: 自動検査の違反と人による確認が必要な項目。ブラウザジョブの成功はWCAG適合宣言ではない。
- painter画像は描画の静止証跡。`*-frame.png` は実ファイルから切り出す。自動的な意味判断や実機での知覚的同期は保証しない。

## GO / HOLD / 要実機確認

**クラウド範囲のGO条件**: 全必須試験が成功、保存消失・操作不能・生成から復帰不能がない。生成ファイルの実codecとアクセシビリティ所見をレビュー済み。

**HOLD条件**: 保存の破壊、主要操作不能、継続的な無音/動画生成不能、重大なアクセス障壁、必須試験失敗が未説明。クラウド試験が未完了の場合も未合格とする。重大不具合が再現した場合に限り、小さな修正と失敗を再現する回帰テストをセットにする。

**要実機確認**: A401OPの端末名・Android/Chrome・画面寸法・日時・SHAを記録し、Issue #65 の手順でUSB localhostから検証。サーバーを停止してホームからPWAを起動し、作品保持・描画・実発音を確認。正方形/縦長動画を端末へ保存・再生し、実codecを記録。対象SNSに取り込み投稿直前のプレビューまで確認する（投稿は不要）。OS共有の取消・復帰、背景遷移、TalkBackも記録する。

**公開GO**: 上記クラウド結果と実機結果を揃え、公開責任者が判断する。元のNetlifyオリジン上の旧版→新版更新・既存作品保持は別の公開手順で確認する。今回のlocalhost新規プロファイルだけでは証明できない。
