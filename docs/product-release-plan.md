# Picture Score 製品化の方針

## 合意した提供内容

- Web版は無料。描画・現在の音色と画材・作品帳・バックアップ・音つき共有を使える。
- Google Play版はフリーミアム。基本の描画・保存・音つき共有を無料とし、追加の音色・画材・作品の飾り方を有料にする。
- 運営者は madowaku、問い合わせ先は raindrum909@gmail.com。公開Web URLは未定。
- 既存の無料機能を後から購入必須にする実装は行わない。今回、購入画面や課金処理は追加していない。

## 最初の製品化段階で実装したもの

1. インストール用マニフェスト、ホーム画面アイコン、アプリ・画像・効果音のオフラインキャッシュ。
2. ホームのインストール案内と更新操作。描画中に更新を強制せず、利用者が更新を押したタブだけを再読み込み。下書きを保存できない場合は更新しない。
3. 作品帳の一括JSONバックアップと復元。既存作品を上書きせず、衝突した作品は別IDで追加。同じバックアップの再読み込みは重複を避ける。処理は一つのIndexedDBトランザクションで全件成功または全件取り消し。
4. 公開URLをSNS投稿文・ホームの紹介リンク・canonical/OGタグに反映できる設定。未設定時やlocalhostを共有文に混ぜない。
5. 日本語・英語のプライバシーと保存の説明ページ。実際の外部通信であるGoogle Fontsも記載。

## 無料Web公開まで

- 公開URLを決め、.env.local に VITE_PUBLIC_WEB_URL を設定。専用のHTTPSオリジン直下を想定する。
- npm run build:release で公開用の dist を生成。URLが未設定・開発用アドレスならこのコマンドは停止する。通常の npm run build はローカル検証用に引き続き使える。
- dist の内容を同一オリジンで配信。sw.js、index.html、manifest.webmanifest は毎回再検証できるCache-Controlにし、ハッシュ付きassetsは長期キャッシュ可能。古い利用者のため配信時のファイルを一括置換し、古いハッシュ付きassetsも一定期間保持する。
- privacy.html は直接開ける静的ページとして配信。フォントは現在Google Fontsへ接続する。外部通信を減らす次の候補はライセンスを確認したフォントの同梱。
- 実機Android Chrome・iPhone Safariで描画、音声開始、ホーム追加、再起動後のオフライン、録画、SNSへの実際のファイル受け入れを確認する。
- 共有先に強制投稿せず、現在どおり端末の共有画面で本人が選ぶ。

公開はまだ実行していない。キャッシュは作品のバックアップではない。ブラウザデータ削除や端末紛失に備え、作品帳のバックアップを案内する。

## Google Play版の実装順

### 1. Androidアプリの土台

候補は [CapacitorのAndroid構成](https://capacitorjs.com/docs/android)。同じWeb実装を端末内に同梱し、外部サイトの読み込みに依存しない起動にする。アプリID、署名、Play Consoleの登録情報は実際の公開者情報に合わせて設定する。Android用ビルドではWeb用サービスワーカーを切り離す。音声中断・バックグラウンド・戻る操作・ファイルの保存と共有を実機で確認する。

### 2. 最初の有料パック

候補は「音色パック」（木琴・オルゴール等）、「画材パック」（質感の違うペン等）、「飾りパック」（フレーム等）。初回は一つのパックに絞る。買い切りか定期購入か、価格、具体的な内容は未決定。追加表現以外に購入を要求しない。

購入前に音や見た目を試せる導線を作り、購入済みの作品を開いたときに音や絵が失われない仕様を先に決める。購入の呼びかけで描画体験を遮らない。

### 3. 購入と復元

標準案はGoogle Play Billingを使う。購入状態はPlayによる検証を根拠とし、localStorageのフラグだけでは解放しない。保留・キャンセル・返金・購入の復元を扱い、再インストールでも購入済み表現を戻せるようにする。秘密鍵やサービスアカウントはアプリに同梱しない。

公式資料：[Payments](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en)、[課金のセキュリティ](https://developer.android.com/google/play/billing/security)。地域ごとの例外・選択肢があるため、実際の配信地域を決めてから課金方式を確定する。

### 4. 子供を含む対象者に合わせた公開準備

対象年齢の申告を実際の体験と一致させ、[Familiesポリシー](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en)に沿って共有や購入への導線を設計する。現在のWeb版に広告・分析SDKはない。追加SDKや購入機能を導入したら、[Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)と[プライバシーポリシー](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)を実装に合わせて更新する。対象APIやテスト要件は申請時点の公式要件を確認する。

## 確認済みと残っていること

2026-09-21：117件の単体テスト、本番ビルド、Chromiumでのオフライン描画・演奏・保存・動画作成・説明ページ、バックアップの復元と原子性を確認。別タブを強制再読み込みしない手動更新も検証した。

未実施：公開ドメインへの配布、Androidアプリのパッケージ化、課金実装、Play Consoleへの申請、実機SNSへの投稿受け入れ確認。これらは上の順序で進める。

## 再実行

通常：npm test、npm run build、npm run dev、npm run preview -- --port 4173。

- scripts/verify-product-backup.cjs：5173で一括バックアップ・衝突・再読み込み・不正ファイル・容量不足時の全件取り消し。
- scripts/verify-product-offline.cjs：4173でオフライン再起動・描画・保存・動画・privacy.html。
- 更新：専用のPlaywright CLIセッションで4173を開き、scripts/prepare-product-update.cjsを実行。node scripts/product-update-fixture.cjs prepare、scripts/verify-product-update.cjs、node scripts/product-update-fixture.cjs restore の順で検証。配布前に必ず復元する。

PWAは [vite-plugin-pwa](https://vite-pwa-org.netlify.app/guide/prompt-for-update) のキャッシュ生成を使用し、再読み込みはアプリ側で明示操作のみに限定している。
