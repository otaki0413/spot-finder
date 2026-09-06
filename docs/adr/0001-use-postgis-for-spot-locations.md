# スポットの位置情報にPostGISを採用する

スポットを中心点から半径N km以内で検索するため、PostgreSQLにPostGISを導入し、位置情報を `geography(Point, 4326)` 型で保存する。緯度・経度を通常の数値列だけで保持して距離計算を自前で実装する案に対し、PostGISの導入設定が必要になるものの、メートル単位の距離判定と空間インデックスを利用できる点を優先した。

Issue #5で保存の基盤を整え、半径検索の実装はIssue #6で行う。検索には `ST_DWithin` を使用する方針とする。

参考: [PostGIS ST_DWithin](https://postgis.net/docs/ST_DWithin.html)
