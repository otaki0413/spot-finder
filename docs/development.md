# 開発・検証ガイド

[READMEに戻る](../README.md)

## コマンド

ホストで実行する場合はNode.js 24（24.15.0以上）とpnpm 11.25.0を用意し、ルートで `pnpm install --frozen-lockfile` を実行してください。

| コマンド                          | 内容                                                            |
| --------------------------------- | --------------------------------------------------------------- |
| `pnpm lint` / `pnpm format:check` | lint・整形の確認                                                |
| `pnpm format`                     | 自動整形                                                        |
| `pnpm typecheck`                  | Web・APIの型チェック                                            |
| `pnpm test`                       | Webの検索・住所取得ロジックのテスト                             |
| `pnpm test:e2e`                   | APIのHTTPテスト（DBはモック）                                   |
| `pnpm test:integration`           | 専用PostGISコンテナで取込・再起動・半径検索を検証。Dockerが必要 |
| `pnpm build`                      | Web・APIの本番ビルド                                            |
| `pnpm run doctor`                 | React Doctorの補助診断。指摘は報告のみ                          |

実DBテストは開発用DBを使用しません。Webの自動テストは通信間隔・キャッシュ・応答順・失敗時の処理などのロジックを対象とし、Google Mapsの描画や操作性は実ブラウザで確認します。

## 起動設定の変更とトラブル対応

| 状況                     | 対応                                                                      |
| ------------------------ | ------------------------------------------------------------------------- |
| `.env` を変更した        | `docker compose up -d web` を実行し、ページを再読み込み                   |
| 依存関係・設定を変更した | `docker compose up --build -d` で再ビルド                                 |
| 起動に失敗する           | `docker compose logs -f` で確認。CSV取込の問題は `docker compose logs db` |
| 地図が表示されない       | APIキー、Google CloudでのAPI有効化・請求先・利用制限を確認                |

`apps/web/src`・`apps/api/src` の変更は自動反映されます。Composeは開発モードで起動します。

**DBを作り直す場合のみ**、`docker compose down --volumes` → `docker compose up` を実行します。既存データはすべて削除されます。SQL・CSVの変更や初期化失敗後の修正は、既存ボリュームへの再起動だけでは反映されません。

## 自動チェック

| 実行タイミング | 内容                                                                            | 設定                                                                                     |
| -------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| commit前       | ステージしたファイルの整形・lint                                                | [lefthook.yml](../lefthook.yml)                                                          |
| push前         | 型チェック、単体・HTTPテスト                                                    | [lefthook.yml](../lefthook.yml)                                                          |
| CI             | lint・整形・型・テスト・ビルド、空DBからのCompose起動・200件取込・Web経由の検索 | [ci.yml](../.github/workflows/ci.yml)                                                    |
| React Doctor   | Webの追加診断                                                                   | [workflow](../.github/workflows/react-doctor.yml) / [設定](../apps/web/doctor.config.ts) |

Git hooksは依存関係のインストール時に設定します。有効にならない場合は `pnpm exec lefthook install` を実行してください。

通常のlintは [Oxlint](../oxlint.config.ts) が担当し、警告も失敗として扱います。React Doctorはlintを重ねずに追加診断を行います。`pnpm doctor` はpnpm自身の診断なので、`pnpm run doctor` と指定してください。
