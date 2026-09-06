import { Injectable, Logger } from "@nestjs/common";
import type { OnApplicationBootstrap } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { importSpotSeed } from "./import-spot-seed.js";

@Injectable()
export class SpotSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SpotSeedService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const result = await importSpotSeed(this.dataSource);
      this.logger.log(
        result.status === "imported"
          ? `スポット初期データを${result.count}件取り込みました`
          : `スポットが${result.count}件存在するため、初期データの取込をスキップしました`,
      );
    } catch (error) {
      this.logger.error(
        error instanceof Error
          ? error.message
          : "スポット初期データの取込に失敗しました",
      );
      throw error;
    }
  }
}
