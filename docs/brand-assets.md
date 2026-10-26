# アイコン・ファビコン・OGP画像

2026-09-21制作。添付のブランドボードとアプリ内の水彩PSロゴを共通の見た目にする。

## 成果物

- assets/brand/app-icon-master.svg: 既存の src/brand/BrandLogo.tsx から書き出したベクターマスター。
- assets/brand/app-icon-1024.png: 1024pxアプリアイコン原版。
- public/icons/picture-score-180-v2.png: Appleホーム画面用。
- public/icons/picture-score-192-v2.png、picture-score-512-v2.png: PWA用。
- public/icons/picture-score-maskable-512-v2.png: 端末による切り抜き用。PSの葉を含む主要な画素を、中心から半径約197pxに収めた。512pxの安全円の半径204.8px以内。
- public/favicon-v2.svg、public/icons/favicon-{16,32,48}-v2.png、public/favicon-v2.ico: ブラウザ用。小サイズではテクスチャを省き、線と色を濃くした。ルートの favicon.svg / favicon.ico も同じマーク。
- public/social/picture-score-og-v2.png: 1200×630pxのSNS画像。
- assets/brand/ogp-watercolor.png: OGPの背景原画。

OGPは既存ベクターと正確な日本語組版を背景に重ねて制作した。文字は画像生成に任せず、アプリと同じ M PLUS Rounded 1c で描画。OGP / X用のURL・画像寸法・画像形式・代替文をビルド時のHTMLに含める。画像は公開URLから直接取得できる。SNS画像はアプリのオフライン用事前キャッシュから除外する。

## 再生成と確認

1. npm run dev で5173を起動。
2. 専用Playwright CLIセッションで scripts/render-brand-assets.cjs を実行。
3. node scripts/package-favicon.cjs でICOを構成。
4. VITE_PUBLIC_WEB_URL=https://picture-score.netlify.app を指定して npm run build:release。
5. 本番プレビュー4173または公開サイトを開いた専用セッションで scripts/verify-brand-assets.cjs を実行。

サイズ、アルファ、maskable安全範囲、静的HTMLのOGP、各画像の取得、オフラインのファビコン取得、SNS画像をキャッシュしていないことを確認する。画像の比較シートは output/playwright/brand-assets-review.jpg。

既存端末のホーム画面アイコンとSNSサービスの既存キャッシュがいつ置き換わるかは各サービスによる。実機インストールや各SNS上のカード表示は未確認。公開画像の直接取得とHTMLメタデータを検証する。

参考：[PWAアイコンと安全領域](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons)、[Open Graph](https://ogp.me/)。

## 画像生成の記録

背景だけに組み込み image_gen ツールを使用。CLI/APIによる画像生成は使用していない。アイコンとロゴは既存SVGを再利用した。画像参照を使う最初の生成呼び出しはローカルファイル読み込みエラーで出力されず、背景を新規生成した。最初の背景案は境界が濃かったため採用せず、以下のプロンプトで再生成した背景を採用。

最終背景プロンプト（全文）：

> Create a NEW finished flat watercolor illustration of a very pale ivory sheet of paper with tiny botanical accents, wide landscape 1.91:1. This must be a fully OPAQUE rectangular image, every pixel filled with solid luminous creamy off-white (#fcf9ef) paper. NO transparency or cutouts. The whole central and upper-left 90 percent is clean uninterrupted pale ivory paper with barely visible paper fibers. At extreme lower-left, paint two very small delicate watercolor sage sprouts over a light pastel misty teal wash. At extreme upper-right, add a whisper of palest coral peach watercolor and three tiny sage leaves. At extreme lower-right a tiny very pale butter yellow wash. Keep these corner decorations peripheral and extremely light, softly feathered directly into the same uniform IVORY paper. All pigments bright and translucent, gently handmade Japanese stationery feeling. Crucial: no gray, no black, no brown, no dark edge shading, no shadow, no vignette, no holes, no translucent areas, no central shape, no logos or text. This is an entire luminous watercolor stationery paper image, not a transparent overlay.

## 公開確認

公開ID: 6ab144324549491749e8a9b6。公開URLで8画像の取得と寸法、OGPの静的HTML、maskable安全領域、オフラインのアイコン取得、ガーデン画面を確認済み。ブラウザの実行時エラーは0件。
