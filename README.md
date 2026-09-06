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

APIは、マイグレーションとスポットの初期データ取込を完了してからリクエストの受付を開始します。

停止は `Ctrl+C`、コンテナの削除は `docker compose down` で行います。DB データは保持されます。**DB データも削除する場合だけ** `docker compose down --volumes` を使ってください。

## スポットの初期データ

提供された [landit_coding_test_seed.csv](apps/api/data/landit_coding_test_seed.csv) の200件を使用します。課題本文の「約500件」とは件数が異なりますが、提供ファイルの内容をそのまま同梱しています。

- CSVはDockerイメージのビルド時にコピーされ、起動時にAPIが読み込みます。
- TypeORMのマイグレーションでPostGISの有効化を確認し、スポットテーブルと空間インデックスを作成します。
- スポットテーブルが空なら全件を1つのトランザクションで取り込みます。データが存在すればスキップするため、DBを保持した再起動では既存のIDも変わりません。
- 必須項目の空欄、不正なCSV形式、範囲外・非数値の座標などがあれば取込を失敗させます。CSVの行番号と原因をログに出し、部分的なデータを残さずAPIの起動を停止します。
- CSVは固定の初期データとして扱います。差し替え時の更新・削除同期や、手動で削除された一部データの補完は行いません。

取込完了専用テーブルは設けず、空テーブルの判定と保存の間をロックして二重取込を防ぎます。テーブル定義の変更履歴はTypeORMの `migrations` テーブルで管理します。

座標は `geography(Point, 4326)` に保存し、後続の半径検索に使用します。用語は [CONTEXT.md](CONTEXT.md)、PostGISの採用理由は [ADR](docs/adr/0001-use-postgis-for-spot-locations.md) を参照してください。

CSVの解析には `csv-parse` を使用し、カンマ・引用符・改行を含む値もCSVの形式に沿って扱います。

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
pnpm test:integration # 実DBでのマイグレーション・取込テスト（Dockerが必要）
pnpm build         # API / Web のビルド
```

単体・HTTPテストはDB接続をモックに差し替えています。`test:integration` はTestcontainersでテスト専用のPostGISコンテナを起動し、保存内容・再取込・同時取込・失敗時の取消とAPI起動停止を確認します。開発用DBは使用しません。

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
API の DB 接続成功、スポット200件の取込、API再起動前後の件数・IDの一致、Web の HTTP 200 を確認します。
この起動確認は画面操作のテストを含みません。
