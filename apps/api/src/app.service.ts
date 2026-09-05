import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class AppService {
  constructor(private readonly dataSource: DataSource) {}

  async getHealth(): Promise<{ status: "ok"; database: "ok" }> {
    try {
      await this.dataSource.query("SELECT 1");
    } catch {
      throw new ServiceUnavailableException("Database connection unavailable");
    }

    return { status: "ok", database: "ok" };
  }
}
