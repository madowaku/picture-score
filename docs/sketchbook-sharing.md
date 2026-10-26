# 作品帳と音つき共有

## 使い方

1. スタジオで描き、右上の「できた！」から作品に名前をつけて「作品帳に残す」。保存後は試聴・音つき共有・作品帳へ進める。絵と音色・テンポ・伴奏・絵と音楽のバランスを一緒に保存する。
2. 下の「作品帳」から作品を聴く、開く、名前を変える、複製する。開いた作品は「作品帳を更新」で同じ作品へ保存する。
3. スタジオまたは作品帳の「音つきで共有」でプレビューを開く。正方形／縦長を選び「音つき動画をつくる」。一曲分の時間をかけて、端末内で作成する。
4. 動画を再生して確認し、端末の共有画面へ渡すかダウンロードする。投稿文もコピーできる。

作品帳から外した直後は「元に戻す」で復元可能。削除の取り消しは作品帳画面を離れるまで、直近一作品が対象。

## 保存と作品の同一性

- IndexedDB `picture-score:sketchbook` の `artworks` に、UUID・作成日時・更新日時・従来と互換の Project を保存。
- 保存ボタンは明示的な保存。スタジオの下書き自動保存とは独立し、共有画面は開いた時点のスナップショットを使う。
- 更新は元のUUIDを保持。複製・新しいキャンバス・見本への切り替え・JSON読み込みは別作品として扱い、元の保存作品を上書きしない。
- 下書きと編集対象IDの対応には内容の照合値を持たせる。ストレージへの部分的な書き込みや外部からの下書き変更で、別作品を更新対象にしない。
- IndexedDBのトランザクションがコミットされてから成功を表示。容量不足や失敗では既存作品を保持し、作品JSONの保存を案内する。
- 別端末への同期は行わない。ブラウザデータの削除で作品帳も消えるため、各作品から互換JSONをバックアップできる。

## 動画

- Canvas 720×720 / 720×1280、30fpsを要求。実際のフレームレートは端末負荷に依存する。
- 原画の縦横比を維持して余白へ収める。作品名、演奏中の線の発光、演奏位置、小さなブランド表記。
- `projectMusic` はスタジオと同じ解釈とWONDERを使用。WAVと動画は同じ `renderAudioBuffer` で音を生成する。
- 音声クロックを基準にCanvasを描き、音声ストリームと合わせてMediaRecorderで録画。マイクや画面の取得は不要。
- MP4/H.264＋AACを優先し、MediaRecorderの対応形式に応じてWebMへ切り替える。ファイルの実MIMEから拡張子を決める。WebMの場合は共有画面に形式と投稿先の対応確認を案内する。
- 録画非対応ならPNGとWAVを保存可能。共有非対応でも動画を保存可能。
- キャンセル、閉じる操作、画面の非表示、タイムアウトでは録画を止めてストリーム・AudioContextを解放し、不完全な動画を公開しない。プレビュー用Object URLも解放する。
- Web Shareは生成済みFileについて対応を確認し、別のボタンクリックで呼ぶ。共有キャンセルは正常な操作として扱う。共有先へ渡したこととSNSへの投稿完了は区別する。

## 検証

開発サーバーを起動し、専用のPlaywright CLIセッションから実行する。検証スクリプトは新しいブラウザコンテキストを使い、実際の作品を変更しない。

```sh
npm test
npm run build
npx @playwright/cli -s=sketchbook open http://127.0.0.1:5173/
npx @playwright/cli -s=sketchbook run-code --filename scripts/verify-sketchbook.cjs
npx @playwright/cli -s=sketchbook run-code --filename scripts/verify-share-edge-cases.cjs
npx @playwright/cli -s=sketchbook run-code --filename scripts/verify-share-fallback.cjs
```

確認対象：

- 保存・再読み込み・音設定の復元・更新・複製・改名・削除取り消し、保存失敗時の既存作品保持。
- 空の作品、スマホ幅320/360/390/760px、共有ダイアログのキーボード操作とフォーカス復帰。
- 正方形・縦長のMP4生成と再生、WebMへの切り替え、非対応時のPNG/WAV、共有キャンセル・共有失敗、録画のキャンセル・画面非表示。
- 生成MP4はffprobeでH.264＋AAC・サイズ・尺、ffmpegで音声信号を確認。
- 日本語・英語。共有APIはテスト用に差し替え、外部SNSへは投稿しない。

スクリーンショットと検証用動画は `output/playwright/sketchbook-*`。

実機iOS/Androidの録画性能・共有シート・各SNSへの投稿受け入れは別途実機での確認が必要。今回の共有はファイル共有。作品をWeb上で再生する共有URL、クラウド保管、公開ギャラリーは含まない。

## 参照したブラウザAPI

- [MediaRecorder.isTypeSupported](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)
- [Canvas.captureStream](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream)
- [AudioContext.createMediaStreamDestination](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamDestination)
- [Web Shareとダウンロードの代替経路](https://web.dev/articles/files/share-files)

2026-09-20の確認結果：Vitest 93件成功、本番ビルド成功。上記3本のブラウザ検証成功。正方形MP4 720×720（約8.33秒）、縦長MP4 720×1280（約8.34秒）、WebMはVP8＋Opusを確認。正方形MP4の音声ピークは約−16.3dBで、無音・クリッピングなし。スマホ表示はデスクトップChromiumのビューポートで検証した。

## 色と線の太さ・完成の流れ

- 「いろ・ふとさ」から6色と3段階の線幅を選ぶ。次に描く線に適用し、既存の線は変更しない。
- Stroke の任意フィールド `color`（6桁HEX）と `width`（表示px、1〜8）に保持。UIは1.5 / 2.8 / 5px。旧形式は各表示の既定値を使用する。音の解釈は変えない。
- Undo・再編集・作品帳・ホーム・庭・PNG・動画・JSONに色と太さを引き継ぐ。
- 「できた！」の保存はIndexedDBのコミット成功後に完了を表示。失敗時はダイアログで再試行できる。閉じるとスタジオへ戻る。
- 下書きの自動保存は作品帳への保存とは別。「… / ほかの保存方法」にPNG・WAV・MIDI・JSONの書き出しと読み込みを置く。
- `scripts/verify-creation-flow.cjs` は隔離ブラウザでパレット・描画・Undo/Redo・完成・試聴・動画作成・保存失敗と再試行・再読み込み・各画面の色と幅を検証。

2026-09-21の確認結果：Vitest 108件成功、本番ビルド成功。新しい完成導線・モバイルレイアウト・共有の例外処理・英語とWebMのブラウザ検証が成功。保存失敗からの再試行、色と太さのUndo/Redo・再読込・作品帳・ホーム・庭への保持、PNG/動画の描画ピクセルも確認。最小360×480pxでもキャンバス高124pxを確保。画像は output/playwright/creation-*。実機SNSへの投稿は行っていない。
