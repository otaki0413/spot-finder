# API

Nest CLI 12.0.0 の `nest new` で ESM / Vitest を選択して生成したアプリです。

```sh
npm exec --package=@nestjs/cli@12.0.0 -- nest new api --directory apps/api --package-manager pnpm --skip-git --skip-install --no-observe
```

生成された Controller / Service とテスト構成を使い、PostgreSQL への疎通確認を追加しています。依存関係はルートの pnpm workspace、lint / formatter はルートの Oxlint / Prettier で管理します。

## 実行と確認

リポジトリのルートから実行します。

```sh
pnpm --filter @spot-finder/api start:dev
pnpm --filter @spot-finder/api build
pnpm --filter @spot-finder/api typecheck
pnpm --filter @spot-finder/api test
pnpm --filter @spot-finder/api test:e2e
pnpm lint
pnpm format:check
```

API の起動には PostgreSQL が必要です。接続先は `DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD` で指定します。既定値はローカルの Compose 開発環境向けです。API のポートは `PORT` で指定し、既定値は `3001` です。

`GET /health` は TypeORM 経由で `SELECT 1` を実行します。成功時は HTTP 200 と `{ "status": "ok", "database": "ok" }`、DB に接続できない場合は内部情報を含まない HTTP 503 を返します。テーブルの作成やデータの投入は行いません。

テストでは DB 接続を差し替えるため、PostgreSQL を起動せずに単体テストと HTTP テストを実行できます。

## 生成後の調整

- TypeScript 6.0.3 と選定済みの NestJS / TypeORM のバージョンに固定。
- ESM の型解決に合わせ、Supertest の型 import に `.js` を指定。
- TypeScript 5 向けの依存を持つパス解決プラグインを、Vite 8 の `resolve.tsconfigPaths` に置き換え。
- アプリ固有の lint / formatter 設定と、今回使用しないデプロイ用コマンド・依存を削除。
