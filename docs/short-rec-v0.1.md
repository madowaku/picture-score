# Short REC v0.1

Picture Score の Studio で、現在の作品を音つきの短尺動画として記録する機能。

## 実装

- REC は最大 15 秒
- 出力は 720 × 1280 の縦動画
- 編集 UI は録画せず、録画専用 Canvas に作品を再描画
- 元の `AudioEngine` から `MediaStreamAudioDestinationNode` に音声を分岐
- Canvas の `captureStream(30)` と音声トラックを `MediaRecorder` で結合
- WebM (VP9/VP8 + Opus) を優先
- 録画後にアプリ内プレビュー、保存、撮り直し

## フォールバック

`MediaRecorder` または `HTMLCanvasElement.captureStream` がないブラウザでは、REC 押下時に案内を出す。
初期の実機基準は Android Chrome / desktop Chrome。

## v0.1 で録画するもの

- 元のストローク
- ぷち音符
- 再生中の音符強調
- 再生ヘッド
- 作品名 / Picture Score ブランド
- 演奏音

Garden / ALIVE / WONDER の完全な動画再現は後続。
