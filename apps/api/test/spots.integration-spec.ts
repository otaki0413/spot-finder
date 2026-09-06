import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Test } from "@nestjs/testing";
import { TypeOrmModule } from "@nestjs/typeorm";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { App } from "supertest/types.js";
import { DataSource } from "typeorm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseOptions } from "../src/database/database-options.js";
import { SpotsModule } from "../src/spots/spots.module.js";
import { StandardSchemaValidationPipe } from "@nestjs/common";
import type { NearbySpot } from "../src/spots/spots.service.js";

const image =
  "postgis/postgis:18-3.6@sha256:60f6ad1d21ea86a67d47780b9a0d1e1d200500f62b19293fa834d0dea80b8677";

describe("周辺検索HTTPと実PostGIS", () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication<App>;
  let database: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(image)
      .withPlatform("linux/amd64")
      .withStartupTimeout(90_000)
      .start();
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          ...createDatabaseOptions(),
          host: container.getHost(),
          port: container.getPort(),
          username: container.getUsername(),
          password: container.getPassword(),
          database: container.getDatabase(),
          retryAttempts: 0,
        }),
        SpotsModule,
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();
    database = app.get(DataSource);
    await database.query(`CREATE TABLE spots (
      id integer PRIMARY KEY, name text NOT NULL, category text NOT NULL,
      address text NOT NULL, location geography(Point,4326) NOT NULL
    )`);
    await database.query(
      `CREATE INDEX spots_location_idx ON spots USING gist(location)`,
    );
    // 東向きに既知の距離を進めた点で、表示丸めに依存しない境界を検証する。
    await database.query(`INSERT INTO spots
      SELECT id, 'spot-' || id, 'cafe', '住所',
        ST_Project(ST_SetSRID(ST_MakePoint(139.7671,35.6812),4326)::geography, meters, pi()/2)
      FROM (VALUES (5,1000.4), (4,999.6), (3,500.0), (2,500.0), (1,0.0)) AS fixtures(id,meters)`);
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  async function search(
    radiusKm: number,
    latitude = 35.6812,
    longitude = 139.7671,
  ): Promise<NearbySpot[]> {
    const response = await request(app.getHttpServer())
      .get("/spots/nearby")
      .query({ latitude, longitude, radiusKm })
      .expect(200);
    return response.body as NearbySpot[];
  }

  it("半径内だけを距離順・同距離ID順に返し、7項目の型と座標と距離を保持する", async () => {
    const rows = await search(1);
    expect(rows.map((row) => row.id)).toEqual([1, 2, 3, 4]);
    expect(rows[0]).toEqual({
      id: 1,
      name: "spot-1",
      category: "cafe",
      address: "住所",
      latitude: 35.6812,
      longitude: 139.7671,
      distanceMeters: 0,
    });
    expect(rows[1]!.distanceMeters).toBeCloseTo(500, 6);
    expect(rows[3]!.distanceMeters).toBeCloseTo(999.6, 6);
    expect(rows[1]!.longitude).toBeGreaterThan(139.7671);
    expect(rows[1]!.latitude).toBeCloseTo(35.6812, 5);
    expect(
      rows.every(
        (row) =>
          Object.keys(row).length === 7 &&
          Object.values(row).every(
            (value) => typeof value === "string" || typeof value === "number",
          ),
      ),
    ).toBe(true);
  });

  it("同じ座標の正の最小半径でも境界の中心点を含む", async () => {
    expect((await search(Number.MIN_VALUE)).map((row) => row.id)).toEqual([1]);
  });

  it("境界距離の前後で結果が切り替わる", async () => {
    expect((await search(0.499999)).map((row) => row.id)).toEqual([1]);
    expect((await search(0.500001)).map((row) => row.id)).toEqual([1, 2, 3]);
  });

  it("赤道上の経度1度分の境界を含む", async () => {
    // WGS84の長半径から赤道上の1度の距離を求める。投影の往復誤差を避ける。
    const radiusKm = (6378137 * Math.PI) / 180 / 1000;
    await database.query(
      `INSERT INTO spots VALUES (6, 'equator', 'cafe', '住所', ST_SetSRID(ST_MakePoint(1,0),4326)::geography)`,
    );
    try {
      expect((await search(radiusKm, 0, 0)).map((row) => row.id)).toEqual([6]);
      expect(await search(radiusKm - 0.000001, 0, 0)).toEqual([]);
    } finally {
      await database.query("DELETE FROM spots WHERE id = 6");
    }
  });

  it("該当なしは空配列、広い半径では全件を返す", async () => {
    expect(await search(1, 0, 0)).toEqual([]);
    expect((await search(30000)).map((row) => row.id)).toEqual([1, 2, 3, 4, 5]);
  });
});
