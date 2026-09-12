# Picture Score v0.3 — FEEL THE LINE

**Every stroke answers back.**

v0.2のStroke IR、Visual Notes / Play Notes分離、project version 1、書き出し形式を保ったまま、描く最中・離した瞬間・全体再生後の報酬を追加した。

## 体験の流れ

1. 描画中は現在のCメジャー・ペンタトニックへ吸着した音が鳴る。速度が遅いほど滑らかに長く、速いほど短く軽い。
2. pointerup直後、Visual Notesが最大120msの時差を持って220msで整列する。Kenney drop_001.ogg（CC0）を最大3回、小音量で着地へ重ねる。
3. 220ms後、そのストロークだけのPlay Notesを0.55〜1.45秒へ畳み、短い返事として演奏する。伴奏は入れない。
4. PLAYは従来どおり全ストロークと任意の伴奏を一曲として演奏する。
5. 曲後はモーダルを出さず、「次は何を鳴らす？」と3つの形だけを紙面下部へ残す。描き始めると消える。

## No useless strokes

- 点は一音。
- 横線はsustain。
- 縦線は最大3〜6声のchord。
- 曲線は音高をつないだmelody。
- 筆圧はvelocityへ、描画速度はライブ音の長さと軽さへ反映。

元線は磁力、返事、全体PLAYのいずれでも変更しない。

## 検証

- npm test: 18件成功。
- npm run build: 成功。
- Playwright: 1440×900と390×844。一本の原線保持、吸着アニメーション、Stroke Answer、全体PLAY後の3提案、横はみ出しなしを確認。
- Stroke Answerの表示開始はpointerupから実測273ms。
- public/sfx/magnet-drop.oggのHTTP 200と、ブラウザコンソールにエラー・警告がないことを確認。

再実行:

    npm run dev
    npx @playwright/cli -s=picture-v03 open http://127.0.0.1:5173
    npx @playwright/cli -s=picture-v03 run-code --filename scripts/verify-v03.cjs
