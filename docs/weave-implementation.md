# Picture Score v0.7 — WEAVE 実装メモ

**Relationships become landscape.** 作品同士が実際に一緒に鳴った時間を、絵のあいだの地面として残します。

## 実装の境界

- ペアの景色は既存の GrowthState.relations（実際に可聴だった ENSEMBLE の sharedBeats）から導出します。近くに置くだけではパッチも道も増えません。
- CASCADE と ROUND の反復だけを picture-score:weave:v1 に保存します。破損したWEAVEだけを空にして、Garden v1 / Growth v1 / 作品のStroke・Score・Music IRはそのまま読み込みます。
- 形成履歴は、同じ16拍フレーズ内で全参加者の可聴イベントを受け取ったときに一度だけ加算します。CASCADEは formationIds の順、ROUNDは参加者全員（順番は回転可）を要求します。停止・非表示・中断は一時証拠を破棄します。
- ROUNDのキーは参加者IDをソートして正規化します。移動後も、現在の3つのCLEARINGの中心に導出される小さな共有パッチとして表示されます。これはv0.7 Option Aの地理履歴制限です。

## 景観

WeaveLayer は水彩背景の上、ローカルなCLEARING/GROWTHの下に置く、固定上限のSVGレイヤーです。

- ペアは役割に応じた小さな共有パッチ（flower / sprout / grass / seeds / star）と、成熟した上位8本までの穏やかな端点間パスです。
- CASCADEは最大3編成、各編成の区間に小さな種・星を最大16個まで配置します。ROUNDは三つのCLEARINGの外側に淡い中心パッチを一つ置きます。
- パスはCLEARINGの縁から始まり、二次曲線を24分割して第三作品を含む全CLEARINGとの交差を検査します。安全な経路がない場合は描画を抑制します。共有マークも矩形全体で衝突を検査します。
- pointer-events:none、決定的なIDシード、固定のパス／形成／トレイル上限を使います。元の線と作品ラベルが常に前面です。

## ALIVE

GardenLifeEvent に形成規則と参加者IDを載せ、既存の GardenLifeBridge と LifePresentation の時計を共有します。対応するパッチ・パス・CASCADE区間だけを短く明るくし、別のビートタイマーは動かしません。Reduced Motionでは移動を行わず、opacityの短い強調だけにします。

## 検証

    npm test
    npm run build
    npx --yes --package @playwright/cli playwright-cli -s=clearing run-code --filename scripts/verify-clearing.cjs --raw
    npx --yes --package @playwright/cli playwright-cli -s=clearing run-code --filename scripts/verify-weave.cjs --raw

src/garden/weave.test.ts は、全員・正順の成立、同一フレーズの重複防止、ROUNDの回転、STOP時の部分証拠破棄、破損／削除作品のprune、12作品でのパス上限とCLEARING衝突を検証します。ブラウザー検証では390×844と1440×900のペア・密集・CASCADE・ROUND・Reduced Motionシーンを確認します。