import type { DataSourceOptions } from "typeorm";
import { Spot } from "../spots/spot.entity.js";

export function createDatabaseOptions() {
  return {
    type: "postgres",
    host: process.env.DB_HOST ?? "db",
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? "spot_finder",
    username: process.env.DB_USER ?? "spot_finder",
    password: process.env.DB_PASSWORD ?? "spot_finder",
    entities: [Spot],
    synchronize: false,
    // スキーマと拡張はDBコンテナの初回起動時に用意する。
    installExtensions: false,
    connectTimeoutMS: 1000,
    extra: {
      query_timeout: 1000,
    },
  } satisfies DataSourceOptions;
}
