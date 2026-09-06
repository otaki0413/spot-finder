# Spot Finder

Next.js / NestJS / PostgreSQL の開発環境です。現在は Web から API・DB の接続状態を確認できます。

## 環境構築

Docker と Docker Compose v2 以降を用意し、Docker を起動してください。ポート 3000 / 3001 を使用します。

アプリの起動には、ホストへの Node.js / pnpm のインストールや `.env` の作成は不要です。

## 実行手順

リポジトリのルートで実行します。

```sh
docker compose up
```

- Web: <http://localhost:3000>
- API: <http://localhost:3001/health>

Web に「API・DBに接続できました」と表示されれば起動完了です。準備中の場合は、少し待って「再確認する」を押してください。

停止は `Ctrl+C`、コンテナの削除は `docker compose down` で行います。DB データは保持されます。**DB データも削除する場合だけ** `docker compose down --volumes` を使ってください。

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
pnpm build         # API / Web のビルド
```

現在のテストは DB 接続をモックに差し替えており、実 DB や Compose 全体の疎通は検証しません。

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
API テスト・ビルドを実行します。別ジョブでは空の DB から Docker Compose で起動し、
API の DB 接続成功と Web の HTTP 200 を確認します。
この起動確認は画面操作のテストを含みません。
