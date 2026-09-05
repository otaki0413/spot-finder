# Web

`create-next-app` 16.3.4 で TypeScript / Tailwind CSS / App Router / src ディレクトリを指定して生成したアプリです。

```sh
npm exec --package=create-next-app@16.3.4 -- create-next-app apps/web --ts --tailwind --app --src-dir --use-pnpm --skip-install --disable-git --import-alias '@/*' --no-eslint --no-react-compiler --agents-md
```

依存関係はルートの pnpm workspace、lint / formatter はルートの Oxlint / Prettier で管理します。

開発・ビルドともに Next.js 標準の Turbopack を使用します。

## ローカルでの起動

API と PostgreSQL を起動したうえで、リポジトリのルートから実行します。

```sh
API_URL=http://localhost:3001 pnpm --filter @spot-finder/web dev
```

[http://localhost:3000](http://localhost:3000) に API・DB の接続状態を表示します。「再確認する」でページを再読み込みし、その時点の状態を確認できます。

`API_URL` は Next.js サーバーから接続する API のベース URL です。既定値は Compose 向けの `http://api:3001` で、ブラウザには公開しません。

API への問い合わせはリクエストごとに行い、3秒でタイムアウトします。API が停止している場合や、DB に接続できない場合も、画面に確認できなかったことを表示します。

## 確認コマンド

```sh
pnpm --filter @spot-finder/web typecheck
pnpm --filter @spot-finder/web build
pnpm lint
pnpm format:check
```

型チェック時は `next typegen` で Next.js の型を生成してから `tsc` を実行します。ビルド時に API・DB の起動や外部フォントの取得は必要ありません。
