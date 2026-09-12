# Garden v0.2 — ENSEMBLE 実装メモ

Issue #2 / 要件: [garden-v02-ensemble.md](garden-v02-ensemble.md)

## 動かして編曲する

- 波のような旋律を2つ配置し、再生しながら近づけると8拍ずつの掛け合いになります。16拍のフレーズごとに先に歌う側を交代します。
- 和音は相手の歌う小節の頭へ、横線の余韻は連続した歌の区間を支える持続音へ。リズムは裏拍、きらめきはフレーズ末尾や空いている位置を使います。
- 作品間距離 .34 以上では独立、.22 で半分、.10 以下で強い関係。smoothstepで補間し、耳からほぼ聴こえない作品や役割上限で休んでいる作品は関係の対象にしません。
- 相手は距離と安定したIDで選びます。乱数は編曲に使いません。旋律ペアには排他的な窓を割り当て、支える作品は最も近い旋律を優先します。
- 選択中の作品だけに薄い関係線と短い日英の説明を表示。演奏イベントに合わせた呼吸と、配置後の最初の可聴音に一度だけ小さな着地演出があります。
- 密集した作品名は選択中のものだけを表示し、ラベルが重なるのを防ぎます。元の絵の位置は変えず、各作品のアクセシブル名は常に残ります。

## 境界と時計

`ensemble.ts` は保存せずに生成する編曲計画です。Project / Stroke IR / Score IR / Music IRを変更しません。

`gardenMixer.ts` の距離ゲイン、役割ごとの上限、合計0.75の予算はそのまま使います。

`gardenTransport.ts` は既存のAudioContext・25ms先読みスケジューラ・16拍時計を維持します。各作品に独立演奏と編曲演奏のGainNodeを一度だけ作り、次の拍で計画を更新します。動かすたびに音声グラフを作り直しません。

- 独立側 `1 - strength` と編曲側 `strength × roleWeight` を160msの時定数でクロスフェード。編曲側は担当する窓の外で静かになります。
- 距離ゲインは従来どおり120msの時定数で追従。関係がなくなると独立演奏に戻ります。
- 途中参加した持続音は残りの長さで入り、次の16拍まで待ちません。同じ持続音がまだ鳴っていれば再発音しません。
- 1作品・各レイヤー24オシレーターが上限（合計48）。休んでいる独立側も進めておくため、離したときに元のフレーズへ滑らかに戻れます。
- 止まったフレームの過去イベントは追いかけて一斉発音しません。STOP・画面離脱・開始キャンセルで予約と音声を片付けます。
- テンポ変更は従来どおり拍位置を保って古い先読みを破棄します。ドラッグではこの処理を呼びません。

保存キー・versionはいずれもv0.1のまま。リロード時のIR再生成も既存処理を使います。DRAW、MIDI/WAV/PNG、日英設定の形式に変更はありません。

## 検証

```sh
npm test
npm run build
npx @playwright/cli -s=ensemble open http://127.0.0.1:5174/
npx @playwright/cli -s=ensemble run-code --filename scripts/verify-ensemble.cjs
npx @playwright/cli -s=ensemble run-code --filename scripts/verify-ensemble-audio.cjs
npx @playwright/cli -s=ensemble run-code --filename scripts/verify-garden.cjs
npx @playwright/cli -s=ensemble run-code --filename scripts/verify-v03.cjs
npx @playwright/cli -s=ensemble run-code --filename scripts/verify-language.cjs
```

開発サーバーのURLは実際のポートに合わせてください。ブラウザスクリプトは専用QAセッションの保存データを置き換えるため、ユーザーのブラウザセッションで実行しないでください。

- 単体テスト: 閾値の連続性、掛け合いの窓と音程輪郭、下支え、隙間、決定性、12作品、分離した領域、v0.1保存互換、元データ不変。
- 実ブラウザ: 1440×900 / 390×844、20–30秒の近接/分離ドラッグ、時計・Context・GainNodeの同一性、初音と着地、日英文言、タッチ、STOP、リロード、DRAW往復。
- 実Web Audio: 同じゲインで遠近を比較し、2つの診断チャンネルが交代することを波形で確認。持続音の途中参加と分離、開始キャンセル、12作品×3フレーズの音量上限も確認。
- 画面証跡は `output/playwright/ensemble-*.png`（git対象外）。

実機iOS/Androidでの音質・音切れ・長時間バッテリー消費、主観的な聴き心地の調整は引き続き必要です。実装はルールベースで、絵の意味認識やAI編曲は含みません。
