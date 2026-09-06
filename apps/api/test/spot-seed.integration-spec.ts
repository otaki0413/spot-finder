import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { parse } from "csv-parse/sync";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseOptions } from "../src/database/database-options.js";
import { Spot } from "../src/spots/spot.entity.js";

const postgisImage =
  "postgis/postgis:18-3.6@sha256:60f6ad1d21ea86a67d47780b9a0d1e1d200500f62b19293fa834d0dea80b8677";
const seedFile = new URL(
  "../../../db/seed/landit_coding_test_seed.csv",
  import.meta.url,
);
const initFile = new URL("../../../db/init/20-init-spots.sql", import.meta.url);
const containerSeedFile = "/seed/landit_coding_test_seed.csv";
const containerInitFile = "/docker-entrypoint-initdb.d/20-init-spots.sql";

describe("database initialization with PostgreSQL and PostGIS", () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  function connect(database = container.getDatabase()) {
    return new DataSource({
      ...createDatabaseOptions(),
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database,
    }).initialize();
  }

  beforeAll(async () => {
    container = await new PostgreSqlContainer(postgisImage)
      .withPlatform("linux/amd64")
      .withStartupTimeout(90_000)
      .withCopyFilesToContainer([
        { source: fileURLToPath(initFile), target: containerInitFile },
        { source: fileURLToPath(seedFile), target: containerSeedFile },
      ])
      .start();
    dataSource = await connect();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    await container?.stop();
  });

  it("DB単独の起動で提供データ200件を保存し、Entity経由で正確に読み出せる", async () => {
    const csv = parse<Record<string, string>>(
      await readFile(seedFile, "utf8"),
      {
        columns: true,
      },
    );
    const spots = await dataSource
      .getRepository(Spot)
      .find({ order: { id: "ASC" } });
    expect(spots).toHaveLength(200);
    expect(new Set(spots.map(({ id }) => id)).size).toBe(200);
    expect(spots.every(({ id }) => Number.isInteger(id) && id > 0)).toBe(true);
    expect(
      spots.map(({ name, category, address, location }) => ({
        name,
        category,
        address,
        location,
      })),
    ).toEqual(
      csv.map((row) => ({
        name: row.name,
        category: row.category,
        address: row.address,
        location: {
          type: "Point",
          coordinates: [Number(row.long), Number(row.lat)],
        },
      })),
    );
    expect(
      await dataSource.query(`
      SELECT format_type(atttypid, atttypmod) AS type
      FROM pg_attribute
      WHERE attrelid = 'spots'::regclass AND attname = 'location'
    `),
    ).toEqual([{ type: "geography(Point,4326)" }]);
    const indexes: { indexdef: string }[] = await dataSource.query(
      "SELECT indexdef FROM pg_indexes WHERE tablename = 'spots'",
    );
    expect(
      indexes.some(({ indexdef }) =>
        indexdef.includes("USING gist (location)"),
      ),
    ).toBe(true);
  });

  it("DBを再起動しても初期化を繰り返さず、既存データとIDを保持する", async () => {
    const before = await dataSource
      .getRepository(Spot)
      .find({ order: { id: "ASC" } });
    await dataSource.destroy();
    await container.restart();
    dataSource = await connect();
    expect(
      await dataSource.getRepository(Spot).find({ order: { id: "ASC" } }),
    ).toEqual(before);
  });

  it.each([
    [
      "範囲外の緯度",
      "正常,分類,35,139,住所\n不正,分類,91,139,住所",
      "spot_seed_lat_check",
    ],
    ["必須項目の空欄", '" ",分類,35,139,住所', "spot_seed_name_check"],
    ["非有限の経度", "不正,分類,35,NaN,住所", "spot_seed_long_check"],
    ["データ行の欠落", "", "Spot seed CSV contains no data rows"],
  ])(
    "%sがあれば初期化に失敗し、テーブル作成と保存をすべて取り消す",
    async (_, rows, error) => {
      await dataSource.query(
        "CREATE DATABASE invalid_seed TEMPLATE template_postgis",
      );
      const invalid = await connect("invalid_seed");
      try {
        await container.copyContentToContainer([
          {
            content: `name,category,lat,long,address\n${rows}`,
            target: containerSeedFile,
          },
        ]);
        const result = await container.exec([
          "psql",
          "-v",
          "ON_ERROR_STOP=1",
          "-U",
          container.getUsername(),
          "-d",
          "invalid_seed",
          "-f",
          containerInitFile,
        ]);
        expect(result.exitCode).not.toBe(0);
        expect(result.output).toContain(error);
        expect(
          await invalid.query("SELECT to_regclass('spots') AS name"),
        ).toEqual([{ name: null }]);
      } finally {
        await invalid.destroy();
        await dataSource.query("DROP DATABASE invalid_seed");
      }
    },
  );
});
