# Spot Finder

Next.js / NestJS / PostgreSQL の開発環境です。現在は Web から API・DB の接続状態を確認できます。

## 起動

Docker と Docker Compose を用意し、Docker を起動してからリポジトリのルートで実行します。ホストへの Node.js / pnpm のインストールや `.env` の作成は不要です。

```sh
docker compose up
```

初回はイメージの取得と依存関係のインストールを行います。DB のヘルスチェックが通ると API が起動し、API コンテナの起動後に Web が起動します。

- Web: <http://localhost:3000>
- API: <http://localhost:3001/health>

Web で「API・DBに接続できました」と表示されれば起動完了です。API の準備中に失敗表示になった場合は、少し待って「再確認する」を押してください。ポート 3000 / 3001 は事前に空けてください。

バックグラウンドで起動する場合は次を使います。`--wait` は DB の正常性と API・Web コンテナの起動まで待ちます。アプリの準備が完了したかは、ブラウザで確認してください。

```sh
docker compose up -d --wait
docker compose ps
docker compose logs -f
```

## 構成

```text
ブラウザ → web (Next.js / Tailwind CSS)
             → api (NestJS / TypeORM)
                 → db (PostgreSQL)
```

| 場所           | 役割                                                                |
| -------------- | ------------------------------------------------------------------- |
| `apps/web`     | App Router の接続確認画面。サーバーから API に問い合わせる          |
| `apps/api`     | `GET /health` で DB に `SELECT 1` を実行する                        |
| `Dockerfile`   | Node.js 24 と pnpm 11、workspace の依存関係を用意する開発用イメージ |
| `compose.yaml` | サービスの起動順、接続先、ポート、ボリュームを定義する              |

pnpm workspace で管理し、言語は TypeScript、lint は Oxlint、formatter は Prettier を共通で使います。Web の開発・ビルドは標準の Turbopack です。

コンテナ間は `web → http://api:3001`、`api → db:5432` で接続します。ホストへの公開は Web / API の localhost のみです。DB の接続情報は `compose.yaml` 内の開発用固定値で、本番向けの構成ではありません。

## 開発時の変更反映

`apps/web/src`・`apps/web/public`・`apps/api/src` はホストのファイルを読み取り専用でマウントします。ソースをホストで編集すると、Web は画面を更新し、API は再コンパイル・再起動します。

依存関係、設定ファイル、`apps/api/test` など上記以外を変更した場合は、イメージを再ビルドしてください。

```sh
docker compose up --build -d --wait
```

依存関係の追加・lockfile の更新には、ホストで Node.js 24（24.15.0 以上）と `package.json` 指定の pnpm 11.25.0 を使います。`node_modules` とビルド出力はホストからコンテナに持ち込まず、イメージ／コンテナ内に保持します。

## チェック

起動後、ホストに Node.js がなくてもコンテナ内で実行できます。

```sh
docker compose exec api pnpm exec oxlint apps/api
docker compose exec api pnpm exec prettier --check apps/api
docker compose exec api pnpm --filter @spot-finder/api typecheck
docker compose exec api pnpm --filter @spot-finder/api test
docker compose exec api pnpm --filter @spot-finder/api test:e2e
docker compose exec web pnpm exec oxlint apps/web
docker compose exec web pnpm exec prettier --check apps/web
docker compose exec web pnpm --filter @spot-finder/web typecheck
docker compose exec web pnpm --filter @spot-finder/web build
```

アプリの生成手順と個別コマンドは [Web の README](apps/web/README.md)・[API の README](apps/api/README.md) を参照してください。

## 停止とデータ

前面で起動した場合は `Ctrl+C` で停止できます。コンテナとネットワークも削除する場合は次を使います。

```sh
docker compose down
```

DB データは名前付きボリューム `postgres_data` に保存され、通常の停止・再起動・再ビルドで保持されます。現在は業務テーブルや seed は作成しません。

DB データもすべて破棄して初期化する場合だけ、次を実行します。

```sh
docker compose down --volumes
```

起動後に DB が停止すると API は 503 を返し、Web の再確認で失敗表示になります。DB を復旧して再確認すると成功表示に戻ります。
