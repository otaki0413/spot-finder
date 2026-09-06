import { describe, expect, it } from "vitest";
import { parseSpotCsv } from "./parse-spot-csv.js";

const header = "name,category,lat,long,address";
const validRow = [
  "東京タワー",
  "観光名所",
  "35.6586",
  "139.7454",
  "東京都港区",
];

function csvWithRow(values: string[]) {
  return `${header}\n${values.join(",")}`;
}

describe("parseSpotCsv", () => {
  it("preserves the spot information and puts longitude before latitude", () => {
    expect(parseSpotCsv(csvWithRow(validRow))).toEqual([
      {
        name: "東京タワー",
        category: "観光名所",
        address: "東京都港区",
        location: { type: "Point", coordinates: [139.7454, 35.6586] },
      },
    ]);
  });

  it("accepts quoted commas, escaped quotes, line breaks, BOM and CRLF", () => {
    const csv = `\uFEFF${header}\r\n"名称,""別名""",分類,35,139,"住所\r\n建物"\r\n`;
    expect(parseSpotCsv(csv)[0]).toMatchObject({
      name: '名称,"別名"',
      address: "住所\r\n建物",
    });
  });

  it.each([
    ["lat", 2],
    ["long", 3],
    ["name", 0],
    ["category", 1],
    ["address", 4],
  ] as const)(
    "rejects an empty or whitespace-only %s with its line number",
    (column, index) => {
      for (const emptyValue of ["", '"  "']) {
        const row = [...validRow];
        row[index] = emptyValue;
        expect(() => parseSpotCsv(csvWithRow(row))).toThrow(
          `CSV 2行目: ${column} は必須です`,
        );
      }
    },
  );

  it.each([
    ["lat", 2, "90.00001"],
    ["lat", 2, "-90.00001"],
    ["long", 3, "180.00001"],
    ["long", 3, "-180.00001"],
    ["lat", 2, "NaN"],
    ["lat", 2, "Infinity"],
    ["long", 3, "-Infinity"],
    ["long", 3, "139east"],
    ["lat", 2, "0x20"],
    ["lat", 2, "1e999"],
  ] as const)("rejects invalid %s at column %s: %s", (column, index, value) => {
    const row = [...validRow];
    row[index] = value;
    expect(() => parseSpotCsv(csvWithRow(row))).toThrow(`CSV 2行目: ${column}`);
  });

  it.each([
    ["90", "180"],
    ["-90", "-180"],
    ["0", "0"],
  ])("accepts coordinate boundaries lat=%s, long=%s", (latitude, longitude) => {
    const row = [...validRow];
    row[2] = latitude;
    row[3] = longitude;
    expect(parseSpotCsv(csvWithRow(row))[0].location.coordinates).toEqual([
      Number(longitude),
      Number(latitude),
    ]);
  });

  it("reports the source line when a later record has an invalid coordinate", () => {
    expect(() =>
      parseSpotCsv(`${header}\n${validRow.join(",")}\n地点,分類,999,139,住所`),
    ).toThrow("CSV 3行目: lat");
  });

  it("keeps separate rows even when names or coordinates match", () => {
    expect(
      parseSpotCsv(`${header}\n${validRow.join(",")}\n${validRow.join(",")}`),
    ).toHaveLength(2);
  });

  it("rejects missing or unexpected header columns", () => {
    expect(() => parseSpotCsv("name,lat,long\n地点,35,139")).toThrow(
      "CSV 1行目",
    );
    expect(() =>
      parseSpotCsv(csvWithRow(validRow).replace("lat,long", "long,lat")),
    ).toThrow("CSV 1行目");
  });

  it("rejects malformed CSV with the source line", () => {
    expect(() => parseSpotCsv(`${header}\n地点,分類,35,139`)).toThrow(
      "CSV 2行目: CSV形式が不正です",
    );
    expect(() => parseSpotCsv(`${header}\n"閉じていない引用符`)).toThrow(
      "CSV 2行目: CSV形式が不正です",
    );
  });

  it.each(["", header])("rejects CSV with no spot records", (csv) => {
    expect(() => parseSpotCsv(csv)).toThrow("スポットデータがありません");
  });
});
