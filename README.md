# Spot Finder

Next.js / NestJS / PostgreSQL + PostGIS の開発環境です。起動時に提供CSVを自動で取り込み、Web から API・DB の接続状態を確認できます。

## 環境構築

Docker と Docker Compose v2 以降を用意し、Docker を起動してください。ポート 3000 / 3001 を使用します。

アプリの起動には、ホストへの Node.js / pnpm のインストールや `.env` の作成は不要です。

PostGISの提供イメージは `linux/amd64` 向けです。Apple SiliconではDockerのエミュレーションを使うため、初回起動に時間がかかる場合があります。

## 実行手順

リポジトリのルートで実行します。

```sh
docker compose up
```

- Web: <http://localhost:3000>
- API: <http://localhost:3001/health>

Web に「API・DBに接続できました」と表示されれば起動完了です。準備中の場合は、少し待って「再確認する」を押してください。

DBの初回初期化でスポットを取り込み、DBの起動完了後にAPIを起動します。

停止は `Ctrl+C`、コンテナの削除は `docker compose down` で行います。DB データは保持されます。**DB データも削除する場合だけ** `docker compose down --volumes` を使ってください。

## スポットの初期データ

提供された [landit_coding_test_seed.csv](db/seed/landit_coding_test_seed.csv) の200件を使用します。課題本文の「約500件」とは件数が異なりますが、提供ファイルの内容をそのまま同梱しています。

- SQLとCSVをDBコンテナに読み取り専用でマウントします。PostGISイメージによる拡張の有効化後に、[初期化SQL](db/init/20-init-spots.sql)を実行します。
- PostgreSQL標準の `COPY` でCSVを読み込み、スポットテーブルの作成・全件の保存・空間インデックスの作成を1つのトランザクションで行います。
- 初期化SQLはDBのデータディレクトリが空の初回だけ実行されます。ボリュームを保持した再起動では既存のデータとIDを保持します。
- 必須項目の空欄、不正なCSV形式、範囲外・非数値の座標などがあれば、部分的なデータを残さず初期化に失敗します。原因は `docker compose logs db` で確認できます。`COPY` 中のエラーにはCSVの行番号も出力されます。
- CSVは固定の初期データとして扱います。差し替え時の更新・削除同期や、手動で削除された一部データの補完は行いません。

APIはTypeORMのEntityで既存テーブルを利用し、スキーマの変更やCSVの取込は行いません。取込完了テーブルやマイグレーション履歴テーブルも作成しません。

既存ボリュームには、SQLやCSVを変更しても反映されません。また、初期化途中で失敗した場合も、再起動だけでは初期化SQLが再実行されません。開発用データをすべて削除してよい場合に限り、原因を修正したうえで `docker compose down --volumes` → `docker compose up` で作り直してください。

座標は `geography(Point, 4326)` に保存し、後続の半径検索に使用します。用語は [CONTEXT.md](CONTEXT.md)、PostGISの採用理由は [ADR](docs/adr/0001-use-postgis-for-spot-locations.md) を参照してください。

CSV内のカンマ・引用符・改行は、PostgreSQLのCSV形式に沿って扱います。

## 開発コマンド

ホストで Node.js 24（24.15.0 以上）と pnpm 11.25.0 を用意し、リポジトリのルートで実行します。

```sh
pnpm install --frozen-lockfile
pnpm lint          # lint
pnpm format:check  # 整形チェック
pnpm format        # 自動整形
pnpm typecheck     # 型チェック
pnpm test          # API の単体テスト
pnpm test:e2e      # API の HTTP テスト
pnpm test:integration # 実DBでの初期化・取込テスト（Dockerが必要）
pnpm build         # API / Web のビルド
```

単体・HTTPテストはDB接続をモックに差し替えています。`test:integration` はTestcontainersでテスト専用のPostGISコンテナを起動し、DB単独での取込・Entity経由の保存内容・DB再起動時のデータ保持・不正データによる初期化の取消を確認します。開発用DBは使用しません。

`apps/web/src`・`apps/api/src` の変更は自動反映されます。依存関係・設定・`apps/api/test` など、それ以外の変更は再ビルドしてください。

```sh
docker compose up --build -d
```

ログは `docker compose logs -f` で確認できます。

## コード品質のチェック

ホストで `pnpm install` を実行すると、Lefthook が Git hooks を設定します。
既存の `node_modules` を再利用して hooks が設定されない場合は、
`pnpm exec lefthook install` を実行してください。

- pre-commit: ステージしたファイルを Prettier で自動整形し、Oxlint で検査します。
- pre-push: Web・API の型チェック、API の単体・HTTP テストを実行します。
- lint は警告がある場合も失敗します。導入済みの `.agents/skills/` は整形・lint の対象外です。

GitHub Actions は `main` 向け PR と `main` への push で、lint・整形・型チェック・
API テスト・実DBテスト・ビルドを実行します。別ジョブでは空の DB から Docker Compose で起動し、
DB単独でのスポット200件の取込、API の DB 接続成功、DB・API再起動前後の件数・IDの一致、Web の HTTP 200 を確認します。
この起動確認は画面操作のテストを含みません。
