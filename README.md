# Picture Score v0.6.1 — CLEARING

**Growth frames the drawing, never covers it.** 育つほど、絵に居場所ができる。

指やマウスで描いた絵を、左から右へ読む小さな楽器。AIやサーバーなしで動く、アイデア検証用のブラウザプロトタイプです。

## 起動

Node.js 22.12以上（開発確認: 24）を使用します。

```sh
npm ci
npm run dev
```

http://127.0.0.1:5173 を開きます。音声は最初の描画またはPLAYで有効になります。

```sh
npm test
npm run build
npm run preview
```

## できること

- v0.6.1 CLEARING：画像生成した芽・草・種・星・花が、絵の周りで育つ。作品ごとの余白を守り、関係の道もその縁につながる。[実装と生成素材・検証](docs/clearing-implementation.md)

- v0.6 ALIVE：実際の発音に合わせて線画が歌い、跳ね、ひらく。長押しSpotlight、WONDERの局所的な光、水彩の地面と育つ足元。[実装と生成素材・検証](docs/alive-implementation.md)

- v0.5 WONDER：閉じる・なぞる・交差・左右対称から音が変わり、Gardenの一列・三角形で音が巡る。6色の線と短い反応、答えを明かさない日英ヒント。[実装と検証](docs/wonder-implementation.md)

- Garden v0.4 PLAYGROUND：触れる、置く、動かすたびに短い音の返事。作品のタップ試聴、4拍のSpotlight、リスナーの軌跡、関係の糸、次に描きたくなる形のヒント。[実装と検証](docs/playground-implementation.md)
- Garden v0.3 GROW：聴いた音が小さな葉や道として庭に残る。停止・非表示・オフラインでは育たず、元の作品はそのまま。[実装と検証](docs/grow-implementation.md)
- 画面上部の「日本語 / English」で表示言語を切り替え。選択はこのブラウザに保存され、絵・作品名・演奏中の状態はそのまま保持
- DRAW / GARDENを切り替え、作品を最大12個まで音の庭へ配置。耳を動かすと近くの作品が共通の拍で鳴る
- Garden v0.2 ENSEMBLE：作品同士を近づけると掛け合い・和音の支え・リズムの合いの手へ。演奏中に動かしても時計を止めず、選んだ作品の関係だけをそっと表示
- マウス・ペン・タッチで描画。筆圧とタイムスタンプを元の線に保持
- 描画時の縦横比を保存。画面サイズ変更やPNG保存でも絵を引き伸ばさない
- 描画中は速度に応じたペンタトニック音。指を離すと音符が220msで順に吸着し、その一本だけが短く返事
- X＝時間、Y＝音高。縦線は和音、描画順と無関係に左から右へ再生
- Drawing / Balance / Musicで演奏の圧縮量を調整。表示音符と元の線は保持
- 曲線はフレーズへ、水平線はロングトーンへ、縦線は最大3〜6音のコードへ
- スライダーに「visual → play」の実数。濃い音符が演奏の代表点、薄い音符も絵に残る
- 5つの合成音色、テンポ変更、絵のある小節を支える控えめな伴奏
- 再生ヘッド、音符の点灯、終了時のささやかな発光と「次は何を鳴らす？」の好奇心の種
- 線単位の消しゴム、Undo / Redo、新しいキャンバス、Heart / Wave / Cat の見本
- ブラウザへの自動保存、作品JSONの保存・読み込み
- PNG画像、WAV音声、2トラックMIDIの書き出し

SpaceでPLAY / STOP、Dで描画、Eで消しゴム、Ctrl/⌘ ZでUndo、Shiftを加えてRedo。

## 形状を優先する設計

`Stroke IR → Visual Notes / Play Notes → Music IR → Renderer`

| 層        | 内容                                                 | 実装                              |
| --------- | ---------------------------------------------------- | --------------------------------- |
| Stroke IR | x / y / pressure / time / id。1000 × 420の正規化座標 | `src/music/types.ts`              |
| Visual Notes | 一定密度の音符、元の線・位置・サンプル順、吸着後の表示位置 | `src/music/score.ts` |
| Play Notes | フレーズ圧縮、持続時間、コード、対応する表示音符ID | `src/music/interpret.ts` |
| Music IR  | Cペンタトニック、テンポ、4/4、Visual / Play / Support | `src/music/score.ts` |
| Renderer  | Web Audio、MIDI、WAV、PNG                            | `src/music/audio.ts`, `export.ts` |

元の線を置き換えず、表示音符の移動はXで最大約8、Yで最大14（正規化座標）に制限。最右端にも約8の内向き余白があります。演奏は独立したPlay Notesから生成し、スライダー右ほどフレーズを間引いて長くつなぎます。水平線は左端でも一つの持続音です。伴奏ONなら右へ動かすほど控えめに加わり、DRAWING端は無伴奏になります。PNGはVisual Notes、Web Audio / WAV / MIDIは共通のPlay Notesを使います。作品JSONは従来のversion 1を引き続き読み書きします。

音声イベントはAudioContextの時計で先読み予約。再生ヘッドも同じ時計を参照します。タブを離れると再生を停止します。画像・音声処理はブラウザ内で完結し、作品を外部へ送信しません。フォントのみGoogle Fontsから取得し、取得できない場合はローカルの代替フォントで動作します。

## 現在の制約

- 初期版は4小節、Cメジャーペンタトニック。スケール・曲尺編集はまだありません。
- 音色は軽い加算合成です。Pianoは生ピアノのサンプル音源ではありません。
- 音符は近い安全な音高を表しますが、厳密な五線譜記譜ではありません。
- 自動保存は同じブラウザ内の最新1作品。別ブラウザへはJSONで持ち運べます。
- 伴奏はルールベースの和音選択。AI生成、MusicXML/ABC、動画書き出しは未実装です。
- 実機iOS/Android、スクリーンリーダーによる描画代替、長時間・大量描画は引き続き検証が必要です。

## 参考にしたOSS・資料

- [Tone.js](https://github.com/Tonejs/Tone.js) / [Accurate Timing](https://github.com/Tonejs/Tone.js/wiki/Accurate-Timing): 音声時計を基準にする予約・同期設計の参考。ライブラリやソースコードは取り込まず、必要な小さな音声エンジンを独自実装。
- [YuE2](https://github.com/multimodal-art-projection/YuE): 楽譜を中間表現として分離する生成パイプライン、将来のSupport Layer接続の参考。モデル・学習データは同梱していません。
- [Lucide](https://github.com/lucide-icons/lucide): UIアイコンに利用（ISC License）。
- [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds): Music Magnetの着地音に利用（CC0）。
- [React](https://github.com/facebook/react) / [Vite](https://github.com/vitejs/vite): UIとビルド（MIT License）。

設計の判断と次の検証項目は [docs/product-notes.md](docs/product-notes.md) に記録しています。

v0.2の設計・検証・スマホ実機チェックは [docs/make-it-sing.md](docs/make-it-sing.md)、v0.3のコール＆レスポンス設計は [docs/feel-the-line.md](docs/feel-the-line.md) を参照してください。

Garden v0.1の操作・保存形式・共通時計・距離ミキサーと検証方法は [docs/garden.md](docs/garden.md) を参照してください。

Garden v0.2の実装・距離と編曲のルール・検証方法は [docs/ensemble-implementation.md](docs/ensemble-implementation.md) を参照してください。

日英の文言は `src/i18n/messages.ts` に集約しています。ブラウザ検証は専用セッションで `npx @playwright/cli -s=language run-code --filename scripts/verify-language.cjs` を実行します（先に同じセッションで開発URLを `open`）。
