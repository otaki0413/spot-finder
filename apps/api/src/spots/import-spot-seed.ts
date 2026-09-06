import { readFile } from "node:fs/promises";
import type { DataSource } from "typeorm";
import { parseSpotCsv } from "./parse-spot-csv.js";
import { Spot } from "./spot.entity.js";

export const spotSeedFile = new URL(
  "../../data/landit_coding_test_seed.csv",
  import.meta.url,
);

export async function importSpotSeed(
  dataSource: DataSource,
  file: URL = spotSeedFile,
): Promise<{ status: "imported" | "skipped"; count: number }> {
  return dataSource.transaction(async (manager) => {
    // 空判定と保存の間に、別の起動処理が同じCSVを取り込むことを防ぐ。
    await manager.query("LOCK TABLE spots IN SHARE ROW EXCLUSIVE MODE");
    const repository = manager.getRepository(Spot);
    const count = await repository.count();
    if (count > 0) {
      return { status: "skipped", count };
    }

    const spots = parseSpotCsv(await readFile(file, "utf8"));
    await repository.insert(spots);
    return { status: "imported", count: spots.length };
  });
}
