---
status: accepted
---

# 地図表示と逆ジオコーディングにGoogle Maps Platformを採用する

地図上のスポット表示、検索半径の変更、地図中心の住所表示に、Google Maps JavaScript APIとGoogle Geocoding APIを採用する。地図描画ライブラリ、背景地図の配信元、逆ジオコーディングを組み合わせて比較し、実装のシンプルさを優先して、地図・マーカー・円・住所取得をGoogleの機能で揃える。課金設定と住所データの利用条件を受け入れ、キャッシュは自前のスポット検索結果を対象に必要に応じて検討する。

## 判断基準

- 必須機能である2D地図、マーカー、半径変更、地図中心の住所表示を実装できること。
- 無料枠で開発・動作確認を進められ、起動に必要な設定が明確であること。
- 高頻度の住所更新と、呼び出し抑制・キャッシュを扱いやすいこと。
- 導入と運用の負担が小さいこと。
- 日本語の住所表示が「今どこを見ているか」を理解できる品質であること。各サービスの品質比較は未実測。

## 比較した構成

料金・利用条件は2026-09-06に公式資料を確認した。各社の無料枠は地図ロード、API呼び出し、クレジットなど計量単位が異なるため、数値の大小だけで比較しない。

| 構成                                               | 利点                                                                                                           | 制約・確認事項                                                                                                                                                | 今回の評価                                                                                                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Maps JavaScript API＋Google Geocoding API   | 地図、マーカー、メートル単位の円、JavaScriptからの住所取得を同じ提供元で揃えられる                             | 課金設定とAPIキーが必要。Dynamic MapsとGeocodingにはそれぞれ月10,000件の無料枠があるが、超過分は従量課金。住所キャッシュには制約がある                        | 採用。必要な地図機能を揃えやすく、実装をシンプルにできる点を優先                                                                                         |
| Leaflet＋Geoapifyの地図タイル・逆ジオコーディング  | 2D地図の用途に合う。地図配信と住所取得をGeoapifyにまとめられ、住所結果の保存・キャッシュが公式に許可されている | APIキーが必要。無料枠は日3,000クレジット、カード登録不要。住所取得だけでなく地図タイル等も枠を消費する。無料利用には出典表示が必要                            | 見送り。住所キャッシュの自由度は利点だが、キャッシュ対象はスポット検索結果にもでき、アプリ側の実装も別途必要。今回はGoogleで必要な機能を揃える利点を優先 |
| MapLibre GL JS＋MapTilerの地図・逆ジオコーディング | オープンソースのベクトル地図描画と、同一提供元の地図・住所取得を組み合わせられる                               | APIキーが必要。無料プランには用途・使用量の制限がある。直接MapLibreを使う場合とMapTiler SDKを使う場合で使用量の計測が異なる。住所キャッシュの許可範囲は未確認 | 見送り。今回、その表現力を必要とする要件がなく、Googleより優先する理由がない                                                                             |
| Mapbox GL JS＋Mapbox Geocoding API                 | 地図と住所取得を同じ提供元で揃えられ、地図スタイルの表現力がある                                               | トークンが必要。地図ロードは月50,000回まで無料、住所取得は別に計量。標準のTemporary結果はキャッシュ不可。Permanentには保存用の設定と支払い情報等が必要        | 見送り。利用可能だが、高度な地図表現を求めない今回の要件でGoogleより優先する理由がない                                                                   |
| Leaflet＋OSM標準タイル＋公開Nominatim              | 公開エンドポイントの利用にキー・課金登録は不要。住所キャッシュが推奨される                                     | 公開Nominatimはアプリ全体で最大1リクエスト/秒。利用ポリシー、識別情報、出典表示、切替要求への対応が必要。公開タイルにはSLAがない                              | 見送り。高頻度の住所更新と複数利用者への対応で、共有レート制限への対処が増える                                                                           |

## 選定に影響する点

- Google案もLeaflet＋Geoapify案も、アプリ用の住所キャッシュや呼び出し抑制を自動で実装してくれるわけではない。Geoapifyの保存・再利用の許可と、キャッシュ機構の提供を区別する。
- Googleの住所取得は呼び出し頻度を抑制する。自前のNestJS＋PostGISのスポット検索結果は、必要に応じてキャッシュする。選定時に未決定だったスポット検索のキャッシュ方式は[Issue #7](https://github.com/otaki0413/spot-finder/issues/7)、住所取得の間隔と結果の保持方針は[Issue #8](https://github.com/otaki0413/spot-finder/issues/8)の合意事項を参照する。
- Next.jsのキャッシュ機構はGoogleの住所データの利用条件を変更しない。また、ブラウザで呼ぶGeocoderにNext.jsのサーバー側キャッシュが自動適用されるわけではない。
- LeafletとMapLibre自体は描画ライブラリであり、地図配信や住所取得まで無制限に無料になるわけではない。
- Google Geocodingの現行規約6.3.2の住所保存例外には、追加呼び出しの代替にしないこと、利用者間で共有しないこと等の条件がある。住所を座標別に共有キャッシュして呼び出しを減らせる前提にはしない。Google案でも、自前のスポット検索結果のキャッシュと住所取得頻度の抑制は検討できる。
- Googleの非EEA向けサービス別規約では、Google Geocodingの結果を非Google地図と組み合わせることに制限がある。LeafletやMapLibreにGoogleの住所取得だけを足す案は採用候補にしない。
- Geoapifyの逆ジオコーディングは1回1クレジット。無料枠を住所専用の3,000回と見積もらず、地図利用も含めて検証する。無料枠には利用量・レートの制約があり、無制限利用は前提にしない。
- 公開Nominatimのレート上限は利用者ごとではない。各ブラウザで1秒間隔にするだけでは、アプリ全体の上限を守れない。これは公開サービスの制約であり、Nominatimソフトウェア全般の制約ではない。
- どの案でもCSVの保存と半径検索は既存のNestJS＋PostGISが担当する。Google Places等の外部施設検索で置き換えない。
- 複数地図ライブラリへの同時対応や、将来の交換用の共通化は行わない。採用した構成に沿って実装する。

## 残る設計・検証事項

- 採用したGoogleについて、提供CSV周辺の複数地点で日本語住所の内容と応答を確認する。市街地、郊外、住所が得にくい地点を含め、未測定の品質を他社に対する優位性として主張しない。
- 地図とNext.jsの接続方法は[Issue #7](https://github.com/otaki0413/spot-finder/issues/7)、住所取得の呼び出し経路・頻度・結果の保持・失敗時表示は[Issue #8](https://github.com/otaki0413/spot-finder/issues/8)の合意事項に従う。住所取得に必要なキー設定と起動手順は、実装時に動作確認する。
- サービスの選定は確定。周辺検索APIの契約・構成・検証方針はIssue #6、地図との接続はIssue #7、住所取得の具体的な設計はIssue #8で管理する。

## 参考

- [Googleの円描画](https://developers.google.com/maps/documentation/javascript/shapes#circles)、[Geocodingサービス](https://developers.google.com/maps/documentation/javascript/geocoding)、[料金表](https://developers.google.com/maps/billing-and-pricing/pricing)、[サービス別規約](https://cloud.google.com/maps-platform/terms/maps-service-terms)
- [Leaflet](https://leafletjs.com/)、[Geoapify地図タイル](https://www.geoapify.com/map-tiles/)、[逆ジオコーディングとキャッシュ](https://www.geoapify.com/reverse-geocoding-api/)、[料金](https://www.geoapify.com/pricing/)、[出典表示等の利用条件](https://www.geoapify.com/terms-and-conditions/)
- [MapLibre GL JS](https://maplibre.org/projects/gl-js/)、[MapTiler料金](https://www.maptiler.com/cloud/pricing/)、[使用量の計測](https://docs.maptiler.com/guides/account/sessions-vs-requests/)、[利用条件](https://www.maptiler.com/terms/cloud/)
- [Mapbox料金](https://www.mapbox.com/pricing)、[Geocoding APIと結果保存](https://docs.mapbox.com/api/search/geocoding/)
- [OSM標準タイル利用ポリシー](https://operations.osmfoundation.org/policies/tiles/)、[公開Nominatim利用ポリシー](https://operations.osmfoundation.org/policies/nominatim/)
