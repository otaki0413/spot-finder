import { DataSource } from "typeorm";
import type { DataSourceOptions } from "typeorm";
import { createDatabaseOptions } from "./database-options.js";

export async function initializeDatabase(
  options: DataSourceOptions = createDatabaseOptions(),
): Promise<DataSource> {
  // PostGISの初期化に必要な待ち時間を、通常リクエストの接続に持ち込まない。
  const migrations = new DataSource({
    ...options,
    migrationsRun: true,
    extra: { ...options.extra, query_timeout: 30_000 },
  });
  try {
    await migrations.initialize();
  } finally {
    if (migrations.isInitialized) await migrations.destroy();
  }

  return new DataSource({ ...options, migrationsRun: false }).initialize();
}
