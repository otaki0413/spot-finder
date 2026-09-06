import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Logger } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { parse } from "csv-parse/sync";
import request from "supertest";
import { DataSource } from "typeorm";
import type { MigrationInterface, QueryRunner } from "typeorm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { AppController } from "../src/app.controller.js";
import { AppService } from "../src/app.service.js";
import { createDatabaseOptions } from "../src/database/database-options.js";
import { initializeDatabase } from "../src/database/initialize-database.js";
import { importSpotSeed, spotSeedFile } from "../src/spots/import-spot-seed.js";
import { Spot } from "../src/spots/spot.entity.js";
import { SpotSeedService } from "../src/spots/spot-seed.service.js";

const postgisImage =
  "postgis/postgis:18-3.6@sha256:60f6ad1d21ea86a67d47780b9a0d1e1d200500f62b19293fa834d0dea80b8677";

describe("spot seed with PostgreSQL and PostGIS", () => {
  let container: StartedPostgreSqlContainer;
  let admin: DataSource;
  let dataSource: DataSource;
  let temporaryDirectory: string;
  let app: INestApplication<Server> | undefined;

  beforeAll(async () => {
    temporaryDirectory = await mkdtemp(
      join(tmpdir(), "spot-finder-seed-test-"),
    );
    container = await new PostgreSqlContainer(postgisImage)
      .withPlatform("linux/amd64")
      .withStartupTimeout(90_000)
      .start();
    admin = await new DataSource({
      type: "postgres",
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
    }).initialize();

    // イメージ側でPostGISが有効化されていないDBからマイグレーションを検証する。
    await admin.query("CREATE DATABASE spot_seed_test TEMPLATE template0");
    dataSource = await initializeDatabase({
      ...createDatabaseOptions(),
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: "spot_seed_test",
    });
  });

  beforeEach(async () => {
    await dataSource.query("TRUNCATE TABLE spots RESTART IDENTITY");
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    if (dataSource?.isInitialized) {
      await dataSource.query(
        "DROP FUNCTION IF EXISTS fail_seed_insert() CASCADE",
      );
    }
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (admin?.isInitialized) await admin.destroy();
    await container?.stop();
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  async function fixtureFile(csv: string): Promise<URL> {
    const file = join(temporaryDirectory, "seed.csv");
    await writeFile(file, csv, "utf8");
    return pathToFileURL(file);
  }

  async function createApplication(): Promise<INestApplication<Server>> {
    const module = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        SpotSeedService,
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    return app;
  }

  it("creates the geography column and spatial index, and skips applied migrations", async () => {
    expect(
      await dataSource.query(
        "SELECT extname FROM pg_extension WHERE extname = 'postgis'",
      ),
    ).toEqual([{ extname: "postgis" }]);
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
    await expect(dataSource.runMigrations()).resolves.toEqual([]);
  });

  it("allows migrations longer than one second but keeps runtime queries within one second", async () => {
    class SlowMigration1788672000001 implements MigrationInterface {
      async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("SELECT pg_sleep(1.2)");
      }
      async down(): Promise<void> {}
    }

    const runtime = await initializeDatabase({
      ...dataSource.options,
      migrations: [SlowMigration1788672000001],
    });
    try {
      await expect(runtime.showMigrations()).resolves.toBe(false);
      await runtime.undoLastMigration();
      const started = performance.now();
      await expect(runtime.query("SELECT pg_sleep(3)")).rejects.toThrow(
        "Query read timeout",
      );
      expect(performance.now() - started).toBeLessThan(2500);
    } finally {
      await runtime.destroy();
    }
  });

  it("fails startup and closes the migration connection when a migration fails", async () => {
    class FailedMigration1788672000002 implements MigrationInterface {
      async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("SELECT * FROM missing_migration_table");
      }
      async down(): Promise<void> {}
    }

    await expect(
      initializeDatabase({
        ...dataSource.options,
        migrations: [FailedMigration1788672000002],
        extra: {
          ...dataSource.options.extra,
          application_name: "spot-finder-failed-migration-test",
        },
      }),
    ).rejects.toThrow('relation "missing_migration_table" does not exist');
    await expect
      .poll(async () =>
        admin.query(
          "SELECT pid FROM pg_stat_activity WHERE application_name = $1",
          ["spot-finder-failed-migration-test"],
        ),
      )
      .toEqual([]);
  });

  it("imports all 200 source records with generated IDs and exact coordinates", async () => {
    await expect(importSpotSeed(dataSource)).resolves.toEqual({
      status: "imported",
      count: 200,
    });
    const csv = parse<Record<string, string>>(
      await readFile(spotSeedFile, "utf8"),
      { columns: true },
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
  });

  it("preserves the existing rows and IDs after reconnecting, without rereading the CSV", async () => {
    await importSpotSeed(dataSource);
    const before = await dataSource
      .getRepository(Spot)
      .find({ order: { id: "ASC" } });
    const reconnected = await initializeDatabase(dataSource.options);
    try {
      const missingFile = pathToFileURL(
        join(temporaryDirectory, "missing.csv"),
      );
      await expect(importSpotSeed(reconnected, missingFile)).resolves.toEqual({
        status: "skipped",
        count: 200,
      });
      expect(
        await reconnected.getRepository(Spot).find({ order: { id: "ASC" } }),
      ).toEqual(before);
    } finally {
      await reconnected.destroy();
    }
  });

  it("imports only once when two startup attempts overlap", async () => {
    const results = await Promise.all([
      importSpotSeed(dataSource),
      importSpotSeed(dataSource),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([
      "imported",
      "skipped",
    ]);
    expect(await dataSource.getRepository(Spot).count()).toBe(200);
  });

  it("does not save valid earlier rows when a later CSV row is invalid", async () => {
    const file = await fixtureFile(
      "name,category,lat,long,address\n正常,分類,35,139,住所\n不正,分類,91,139,住所",
    );
    await expect(importSpotSeed(dataSource, file)).rejects.toThrow(
      "CSV 3行目: lat",
    );
    expect(await dataSource.getRepository(Spot).count()).toBe(0);
  });

  it("fails without saving anything when the seed file is missing", async () => {
    const file = pathToFileURL(join(temporaryDirectory, "missing.csv"));
    await expect(importSpotSeed(dataSource, file)).rejects.toThrow("ENOENT");
    expect(await dataSource.getRepository(Spot).count()).toBe(0);
  });

  it("allows separate source rows with identical names and coordinates", async () => {
    const file = await fixtureFile(
      "name,category,lat,long,address\n同名,分類,35,139,住所\n同名,分類,35,139,住所",
    );
    await importSpotSeed(dataSource, file);
    const spots = await dataSource
      .getRepository(Spot)
      .find({ order: { id: "ASC" } });
    expect(spots.map(({ id }) => id)).toEqual([1, 2]);
  });

  it("finishes the import before the API starts accepting HTTP requests", async () => {
    const application = await createApplication();
    await application.listen(0, "127.0.0.1");
    expect(await dataSource.getRepository(Spot).count()).toBe(200);
    await request(application.getHttpServer()).get("/health").expect(200);
  });

  it("rolls back a failed insert and does not start the API", async () => {
    await dataSource.query(`
      CREATE FUNCTION fail_seed_insert() RETURNS trigger AS $$
      BEGIN
        IF NEW.id = 2 THEN
          RAISE EXCEPTION 'simulated seed insert failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await dataSource.query(`
      CREATE TRIGGER fail_seed_insert BEFORE INSERT ON spots
      FOR EACH ROW EXECUTE FUNCTION fail_seed_insert()
    `);
    const logError = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => {});
    const application = await createApplication();
    await expect(application.listen(0, "127.0.0.1")).rejects.toThrow(
      "simulated seed insert failure",
    );
    expect(application.getHttpServer().listening).toBe(false);
    expect(await dataSource.getRepository(Spot).count()).toBe(0);
    expect(logError).toHaveBeenCalledWith("simulated seed insert failure");
  });

  it("can revert and reapply the table migration without removing PostGIS", async () => {
    await dataSource.undoLastMigration();
    expect(
      await dataSource.query("SELECT to_regclass('spots') AS name"),
    ).toEqual([{ name: null }]);
    expect(
      await dataSource.query(
        "SELECT extname FROM pg_extension WHERE extname = 'postgis'",
      ),
    ).toEqual([{ extname: "postgis" }]);
    await dataSource.runMigrations();
    await expect(importSpotSeed(dataSource)).resolves.toEqual({
      status: "imported",
      count: 200,
    });
  });
});
