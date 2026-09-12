# Picture Score v0.6 — ALIVE

[Issue #6](https://github.com/madowaku/picture-score/issues/6) / [仕様](picture-score-v06-alive.md)

庭に置いた線画が、実際に出した音に合わせて歌う・ひらく・揺れる・跳ねる・きらめく。選択していない作品のカード背景とラベルを外し、水彩の地面に線と成長が残る庭にした。

## 音と動き

GardenTransport が音声を予約した直後に、AudioContext 秒・拍・役割・音高・長さ・元の点を独立した GardenLifeBridge に渡す。16ms の表示用時計が実際の発音時刻とゲインを確認し、登録した作品の DOM と Web Animations API に通知する。React の更新は選択・移動・成長・粗い拍表示に限り、各音や描画フレームでは行わない。

- 同時刻の和音・free/ensemble の重なりは一つの動きに統合。交差の点や配置順序の情報も保持する。
- 1作品あたり最大8回/秒、庭全体で最大64回/秒。予約は256件まで。150ms以上遅れたアタックは破棄する。
- 各作品のアニメーションは名前付き固定スロット。前の動きをキャンセルして置き換え、粒子のDOMは増やさない。
- 持続音の終了は世代番号を照合し、新しい音を古い終了イベントで消さない。
- STOP、画面切替、ページ非表示、アンマウントで予約・動き・長押しを解除。停止中の試聴も終了後に時計を解除する。
- 音声の音量、声数制限、編曲、共通時計、GROW集計は従来のまま。表示側の例外は音声スケジューラに伝播しない。

| 役割 | 反応 |
| --- | --- |
| うた | 最大6pxの浮き上がり、小さな傾き、元の音の点の光 |
| 和音 | X方向1.07倍の開きと輪。一つの和音で一回 |
| 余韻 | 実際の持続時間に合わせた約2度の揺れ |
| リズム | 4pxの短い跳ねと290msの回復 |
| きらめき | 元の点の短い光と一つの小さな星 |

WONDERは既存の音を観測する。LOOPは反復した音で輪郭を一巡し、THICKENは線の光がにじむ。SPARKは交点、ANSWERは左右の対応点を照らす。CASCADE／ROUNDは演奏用ノートに付けた配置情報で強調され、別の拍タイマーで先頭を推測しない。関係の光は発音した作品から相手へ短く移動する。

## 触れる庭

- タップを始めた瞬間に圧縮し、離すと実際の試聴に合わせて返事する。
- 動かさず480ms押すと4拍のSpotlight。発動後に指を動かしても移動や再タップにならない。
- 移動の閾値を超えると長押しを中止。ドラッグは元のtransportを更新し続ける。
- 選択時のSpotlightボタン、Enter／Spaceの試聴、矢印移動を維持。
- モバイルの当たり判定は74×76px、リスナーは48px。ラベルは選択／フォーカス時だけ表示する。
- reduced motionでは移動・揺れ・輪郭移動を止め、色・輪郭・光の濃さで音と関係を示す。

GROWの段階1は3つの芽、段階2は6つの形、段階3は8つの形として描く。色と線の濃さを高め、発音時には足元が短く反応する。成長閾値・カウンター・保存形式は変更していない。成熟した関係の道は最大24本、成長の形は最大96個。

## 生成素材

- [水彩の地面](../public/art/alive-watercolor-garden.webp): 1254×1254、136,866 bytes（約134KiB）。
- OpenAIの組み込み画像生成ツール `image_gen.imagegen` で新規生成。参照画像なし、生成モデルはツール既定。アプリ実行時に生成モデルは使わない。
- 生成PNGをFFmpegでWebP（quality 82）に圧縮。配信するのはWebPのみ。背景以外の線画やキャラクターは素材化せず、ユーザーが描いた線をそのまま使う。
- 生成原本のローカル控え: `output/alive-watercolor-original.png`（Git管理外）。

使用プロンプト:

> Use case: stylized-concept. Asset type: background texture for Picture Score, a touchable living musical garden web app. Create a square hand-painted watercolor garden ground, top-down abstract and flat, no perspective horizon. Warm ivory handmade paper with delicate real pigment granulation, faint sunny butter yellow washes, mint and sage meadow patches, pale aqua watery patches, a very few blush pink and lavender pigment blooms around the outer margins. Large luminous quiet open center occupying 75 percent of image so thin colorful user line drawings remain perfectly readable. Gentle organic wandering pale paths suggested only by unpainted paper. Playful Japanese picture-book printmaking sensibility, tactile, sophisticated, airy, genuinely painted rather than digital gradient. Low contrast, nuanced pale color. This is ONLY a ground/background, never a finished scene. No animals, people, characters, mascots, buildings, recognizable flowers, foreground objects, musical notes, text, labels, logos, borders, shadows, UI, buttons or watermark. Even natural paper texture all the way to edges. Finished production bitmap.

## 検証

`npm test`: 71件成功。`npm run build`: TypeScript / Vite成功。life.test.ts / lifeTransport.test.ts は時刻順・和音の統合・表示上限・終了世代・停止・例外隔離・元データ保持を検証する。

実ブラウザの専用スクリプト:

- `scripts/verify-alive.cjs`: 5役割、1440×900／390×844、実際の発音とDOMの一致、タップ／長押し／移動／キャンセル、キーボード、日英切替、reduced motion、STOP／非表示、成熟した12作品の30秒継続操作。
- `scripts/verify-alive-wonder.cjs`: 20秒の掛け合い、並び順から三角形への移動、演奏予約と光る順序の一致、LOOP／SPARK／ANSWER／THICKENの局所反応。
- 既存の DRAW、Garden、ENSEMBLE、GROW、PLAYGROUND、language、WONDER の検証と音声・保存・書き出しの回帰を実行。
- Chromiumの12作品・30秒継続操作: 204回の可視発音、最大20回/秒、予約最大確認11件、再生開始1回、音とDOMの取り違え0。観測遅れ最大30.7ms、描画フレーム間隔95パーセンタイル13.6ms（検証PCでの値、端末性能の保証ではない）。
- 20.5秒の掛け合い64発音、CASCADE47発音、ROUND48発音で順序・予約・DOMが一致。耳を移動する局所検証でLOOP7回、SPARK2回、ANSWER9回、THICKEN10回を確認。
- 過去の配置パルスを調べる検証を実発音イベントへ更新。フィクスチャを保存する前に前画面の自動保存を完了させ、静かな作品が反応しないことも維持する。
- 画面画像と結果ログは `output/playwright/alive-*.png` と `output/*-alive.log`（Git管理外）。

実機iOS／Androidの音声復帰と振動、説明なしで第三者に渡す主観的な試遊は未実施。ブラウザでのタッチエミュレーション・計測結果とは分けて扱う。
