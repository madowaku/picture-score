# ガーデンのスマホ操作と下部ナビ

2026-09-21、https://picture-score.netlify.app/ に反映。

- スマホは通常、庭・絵・耳の上から上下にスワイプしてスクロールする。配置は変わらない。
- 絵の短いタップで音を聴く。「配置を動かす」でドラッグ操作に切り替え、「配置をおわる」でスクロールに戻る。庭を離れた場合も通常操作に戻る。
- 作品の配置待ちでは短いタップだけで配置する。スワイプ、長押し、pointercancelでは配置しない。
- マウスのドラッグと矢印キーの操作は継続。
- Netlifyの built_with_badge_enabled を false に設定し、全訪問者向けにバッジを非表示にした。サイトID: 594e19db-fe34-4a8d-8041-968a028dd91e。

バッジの設定場所は Project configuration > General > Powered by Netlify badge。[公式説明](https://docs.netlify.com/manage/projects/powered-by-netlify-badge/)。端末ごとの非表示設定ではない。

## 検証

- npm test: 117件成功。公開URLを設定した npm run build:release も成功。
- scripts/verify-garden-touch.cjs: 専用Playwright CLIセッションから実行。5173でChromiumのタッチイベントを使い、庭・絵・耳のスワイプ、短いタップ、明示的な配置編集、編集終了、画面遷移、配置待ち時のスワイプとタップ、PCマウス・キー操作を確認。
- 320 / 390 / 720 / 1440px幅、日本語・英語のレイアウトを確認。
- scripts/verify-garden-release.cjs: 公開版の390 / 720 / 1440px幅で、全ナビボタンの到達性、バッジのフレームがないこと、修正の配信、タッチスクロールを確認。
- 実機iPhone / Androidでの確認は未実施。

配信ID: 6ab13d29d75d6cfba2a3b019。以前のアプリを開いたままの場合は、ホームの「作品を残して更新」から更新できる。
