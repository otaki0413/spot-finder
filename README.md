# Spot Finder

Next.js / NestJS / PostgreSQL + PostGIS を使った周辺スポット検索アプリです。起動時に提供CSVを自動で取り込み、Google Mapsの地図と一覧で検索結果を表示します。

## 環境構築

Docker と Docker Compose v2 以降を用意し、Docker を起動してください。ポート 3000 / 3001 を使用します。

ホストへのNode.js / pnpmのインストールは不要です。地図の表示にはGoogle MapsのAPIキーが必要です。

1. Google CloudでMaps JavaScript APIとGeocoding APIを有効にし、請求先を設定したプロジェクトのブラウザ用APIキーを用意します。
2. ルートの `.env.example` を `.env` にコピーし、`GOOGLE_MAPS_API_KEY` を設定します。
3. キーのウェブサイト制限に `http://localhost:3000/*` を登録し、API制限でMaps JavaScript APIとGeocoding APIを許可します。別のホスト名・ポートで使う場合は、そのURLも許可します。

```sh
cp .env.example .env
```

`GOOGLE_MAPS_MAP_ID` はAdvancedMarkerに必要なMap IDです。開発用にはGoogle公式の `DEMO_MAP_ID` を初期設定し、自分のJavaScript用Map IDにも変更できます。[Googleの設定手順](https://developers.google.com/maps/documentation/javascript/advanced-markers/start)

このキーはブラウザでGoogle Mapsを読み込むために使われる公開前提のキーです。上記の制限を設定し、サーバー専用キーとは分けてください。キーを含む `.env` はGit・Dockerイメージに含めません。キー未設定でもWeb・API・DBは起動しますが、地図には設定案内を表示します。

PostGISの提供イメージは `linux/amd64` 向けです。Apple SiliconではDockerのエミュレーションを使うため、初回起動に時間がかかる場合があります。

## 実行手順

リポジトリのルートで実行します。

```sh
docker compose up
```

- Web: <http://localhost:3000>
- API: <http://localhost:3001/health>

Webに東京駅周辺の地図が表示され、半径5km以内のスポットが一覧に表示されれば起動完了です。API・DBの接続状態は `/health` で確認できます。

環境変数を変更した場合は `docker compose up -d web` でWebコンテナを作り直し、ページを再読み込みしてください。地図用の設定はリクエスト時に読み込むため、キーをイメージのビルド時に埋め込む必要はありません。

DBの初回初期化でスポットを取り込み、DBの起動完了後にAPIを起動します。

停止は `Ctrl+C`、コンテナの削除は `docker compose down` で行います。DB データは保持されます。**DB データも削除する場合だけ** `docker compose down --volumes` を使ってください。

## 地図と一覧の操作

- 地図の中心が移動すると古いマーカーと一覧を隠し、移動が止まった時点で検索します。中心が変わらないズーム操作では再検索しません。
- 検索半径はkm単位で入力し、Enterキーまたはフォーカスを外す操作で確定します。正の有限値と小数を受け付け、不正入力では適用済みの半径を維持します。
- 地図と一覧は同じ検索結果を使い、一覧には半径内の全件を地図中心から近い順に表示します。画面外のスポットも一覧に残ります。表示項目は名称・住所・地図中心からの距離です。
- 半径変更時は円と結果を更新し、ズームを維持します。PCは地図と一覧を横並び、狭い画面では縦並びにします。
- 検索中・0件・失敗を区別し、検索失敗時は「再試行」で同じ条件を再検索できます。地図自体の読み込み失敗時はブラウザの再読み込みを案内します。
- 地図のすぐ上に地図中心の住所を表示します。Googleが返す先頭候補の日本語住所をそのまま使い、移動中も最大1秒に1回取得します。停止後は最終地点へ追従し、中心が変わらないズームや半径変更では再取得しません。
- 住所の取得待ちは直前の住所と「更新中」を表示します。住所候補0件と取得失敗は区別し、どちらも古い住所を隠します。失敗時は住所欄の「再試行」を使えます。各問い合わせは10秒でタイムアウト扱いにし、自動リトライは行いません。

## 使用した主要ライブラリと選定理由

- `@vis.gl/react-google-maps`: 地図・AdvancedMarker・CircleとReactとの同期、イベント登録解除を任せ、アプリの検索状態の管理に集中するために採用しました。
- TanStack Query: 検索条件ごとのキャッシュ、通信の中断、取得状態をまとめて管理します。
- TypeORM / PostgreSQL + PostGIS: 既存のスポットデータを地表上の距離で絞り込みます。採用理由は [ADR](docs/adr/0001-use-postgis-for-spot-locations.md) を参照してください。

## 実装時に特に工夫した点・技術的な判断

- ブラウザの `/api/spots/nearby` をNext.jsの `rewrites` でNestJSへ転送し、検索処理をAPIに集約しています。ページはServer Component、地図・入力・検索状態はClient Componentに分けています。
- Google Mapsのイベントが続けて発生しても最新の条件を参照し、移動開始・半径変更で進行中の検索を中断します。中断前の成功・失敗が遅れて届いても表示を上書きしません。
- 中心座標と半径が完全一致する結果を5分間再利用します。座標は丸めず、未使用となったキャッシュは5分後に削除します。時間経過だけで表示中の結果は消しません。
- スポット検索の通信は初回の地図停止・条件変更・手動再試行から開始します。タブ復帰、再接続、自動リトライ、定期更新による検索通信を行いません。
- このキャッシュは自前の周辺検索結果だけを対象にしています。具体的な合意事項と比較は [Issue #7](https://github.com/otaki0413/spot-finder/issues/7) に記録しています。
- 住所はブラウザのGeocoderから取得し、停止後に動くスポット検索とは独立して制御します。1秒の待機中に続いた移動は最新中心へまとめ、微小な移動も丸めずに取得します。応答待ちでも新しい中心を問い合わせ、成功・失敗・0件を通して問い合わせ順に結果を採用することで、連続移動中の更新と古い応答の無視を両立します。
- Googleの住所は画面表示に必要な結果だけをメモリに保持し、履歴キャッシュや永続保存は作りません。過去の地点へ戻った場合は再取得します。合意事項と利用条件への配慮は [Issue #8](https://github.com/otaki0413/spot-finder/issues/8) に記録しています。

## 簡略化した箇所・今後の改善点

- Geocoderの通信自体はキャンセルできないため、10秒を過ぎた応答と画面破棄後の応答をアプリ側で無視します。住所の取得頻度の制限は各画面単位です。
- 海上などではGoogleが住所文字列としてPlus Code（位置を表すコード）を返す場合があり、その場合も加工せず表示します。
- マーカーと一覧のクリックによる選択連動、現在地取得、モバイル専用の開閉パネルは実装していません。
- 地図のAPIキー認証失敗を網羅する独自判定や、自動復旧処理は実装していません。キーの有効性と利用制限は設定時に確認してください。

## スポットの初期データ

提供された [landit_coding_test_seed.csv](db/seed/landit_coding_test_seed.csv) の200件を使用します。課題本文の「約500件」とは件数が異なりますが、提供ファイルの内容をそのまま同梱しています。

- SQLとCSVをDBコンテナに読み取り専用でマウントします。PostGISイメージによる拡張の有効化後に、[初期化SQL](db/init/20-init-spots.sql)を実行します。
- PostgreSQL標準の `COPY` でCSVを読み込み、スポットテーブルの作成・全件の保存・空間インデックスの作成を1つのトランザクションで行います。
- 初期化SQLはDBのデータディレクトリが空の初回だけ実行されます。ボリュームを保持した再起動では既存のデータとIDを保持します。
- 必須項目の空欄、不正なCSV形式、範囲外・非数値の座標などがあれば、部分的なデータを残さず初期化に失敗します。原因は `docker compose logs db` で確認できます。`COPY` 中のエラーにはCSVの行番号も出力されます。
- CSVは固定の初期データとして扱います。差し替え時の更新・削除同期や、手動で削除された一部データの補完は行いません。

APIはTypeORMのEntityで既存テーブルを利用し、スキーマの変更やCSVの取込は行いません。取込完了テーブルやマイグレーション履歴テーブルも作成しません。

既存ボリュームには、SQLやCSVを変更しても反映されません。また、初期化途中で失敗した場合も、再起動だけでは初期化SQLが再実行されません。開発用データをすべて削除してよい場合に限り、原因を修正したうえで `docker compose down --volumes` → `docker compose up` で作り直してください。

座標は `geography(Point, 4326)` に保存し、半径検索に使用します。用語は [CONTEXT.md](CONTEXT.md)、PostGISの採用理由は [ADR](docs/adr/0001-use-postgis-for-spot-locations.md) を参照してください。

CSV内のカンマ・引用符・改行は、PostgreSQLのCSV形式に沿って扱います。

## 周辺検索API

```sh
curl 'http://localhost:3001/spots/nearby?latitude=35.6812&longitude=139.7671&radiusKm=1.5'
```

緯度（−90〜90）、経度（−180〜180）、検索半径（km）をすべて指定します。半径は正の有限数値で、小数も使えます。mへの変換後に非有限となる値は受け付けません。未指定・空欄・不正値・重複・未知のパラメータは400を返します。ただし、NestJS標準Pipeが検証前に除去する特殊キーは、この拒否条件の対象外です。

地表上の距離が半径以下のスポットを全件、距離の昇順・同距離ならIDの昇順で返します。応答は `id`・`name`・`category`・`address`・`latitude`・`longitude`・`distanceMeters` を持つオブジェクトの配列です。距離はメートル単位で、表示用の丸めは行いません。該当なしは200と `[]`、DB検索の失敗は503と `Spot search unavailable` を返します。

## 開発コマンド

ホストで Node.js 24（24.15.0 以上）と pnpm 11.25.0 を用意し、リポジトリのルートで実行します。

```sh
pnpm install --frozen-lockfile
pnpm lint          # lint
pnpm format:check  # 整形チェック
pnpm format        # 自動整形
pnpm typecheck     # 型チェック
pnpm test          # API の単体テスト・Web の検索ロジックのテスト
pnpm test:e2e      # API の HTTP テスト
pnpm test:integration # 実DBでの初期化・取込・周辺検索テスト（Dockerが必要）
pnpm build         # API / Web のビルド
```

APIの単体・HTTPテストはDB接続をモックに差し替えています。Webのテストは検索半径の値、検索状態・通信中断・キャッシュに加え、住所取得の頻度、連続移動中の更新、応答順、失敗・0件・再試行、タイムアウト、画面破棄時の後処理を確認します。Vitest・React Testing Libraryの `renderHook` でロジックを確認し、単体テストでは画面表示・DOM操作・Google Mapsの描画を扱わず、実ネットワークにも接続しません。地図操作中の住所の追従とPC・スマートフォンの表示は実ブラウザで確認します。`test:integration` はTestcontainersでテスト専用のPostGISコンテナを起動し、DB単独での取込・Entity経由の保存内容・DB再起動時のデータ保持・不正データによる初期化の取消に加え、HTTP経由の周辺検索で距離境界・並び順・座標・距離・0件を確認します。開発用DBは使用しません。

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
- pre-push: Web・API の型チェック、Web の検索ロジック、API の単体・HTTP テストを実行します。
- lint は警告がある場合も失敗します。導入済みの `.agents/skills/` は整形・lint の対象外です。

GitHub Actions は `main` 向け PR と `main` への push で、lint・整形・型チェック・
API テスト・実DBテスト・ビルドを実行します。別ジョブでは空の DB から Docker Compose で起動し、
DB単独でのスポット200件の取込、API の DB 接続成功、DB・API再起動前後の件数・IDの一致、Web の HTTP 200 を確認します。
この起動確認は画面操作のテストを含みません。
