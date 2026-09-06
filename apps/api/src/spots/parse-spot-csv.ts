import { CsvError, parse } from "csv-parse/sync";
import type { Info } from "csv-parse/sync";
import type { Spot } from "./spot.entity.js";

const columns = ["name", "category", "lat", "long", "address"] as const;
type CsvSpot = Record<(typeof columns)[number], string>;
type ParsedRecord = { record: CsvSpot; info: Info };
export type SpotSeed = Omit<Spot, "id">;

export function parseSpotCsv(csv: string): SpotSeed[] {
  let records: ParsedRecord[];
  try {
    records = parse<ParsedRecord>(csv, {
      bom: true,
      info: true,
      columns: (header: string[]) => {
        if (
          header.length !== columns.length ||
          header.some((column, index) => column !== columns[index])
        ) {
          throw new Error(
            `CSV 1行目: ヘッダーは ${columns.join(",")} の順で指定してください`,
          );
        }
        return header;
      },
    });
  } catch (error) {
    if (error instanceof CsvError) {
      throw new Error(
        `CSV ${error.lines ?? 1}行目: CSV形式が不正です (${error.code})`,
      );
    }
    throw error;
  }

  if (records.length === 0) {
    throw new Error("CSV: スポットデータがありません");
  }

  return records.map(({ record, info }) => {
    for (const column of columns) {
      if (record[column].trim() === "") {
        throw new Error(`CSV ${info.lines}行目: ${column} は必須です`);
      }
    }

    const latitude = parseCoordinate(record.lat, "lat", info.lines, -90, 90);
    const longitude = parseCoordinate(
      record.long,
      "long",
      info.lines,
      -180,
      180,
    );

    return {
      name: record.name,
      category: record.category,
      address: record.address,
      // GeoJSON/PostGISの座標順は経度、緯度。
      location: { type: "Point", coordinates: [longitude, latitude] },
    };
  });
}

function parseCoordinate(
  value: string,
  column: "lat" | "long",
  line: number,
  min: number,
  max: number,
): number {
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
  const coordinate = Number(value);
  if (
    !decimal.test(value.trim()) ||
    !Number.isFinite(coordinate) ||
    coordinate < min ||
    coordinate > max
  ) {
    throw new Error(
      `CSV ${line}行目: ${column} は ${min}〜${max} の有限数値で指定してください`,
    );
  }
  return coordinate;
}
