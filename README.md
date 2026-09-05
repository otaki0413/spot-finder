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
