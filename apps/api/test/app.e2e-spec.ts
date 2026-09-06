import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { App } from "supertest/types.js";
import { DataSource } from "typeorm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppController } from "../src/app.controller.js";
import { AppService } from "../src/app.service.js";

describe("AppController (e2e)", () => {
  let app: INestApplication<App>;
  const dataSource = { query: vi.fn() };

  beforeEach(async () => {
    dataSource.query.mockReset();
    const moduleFixture = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: DataSource, useValue: dataSource }],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it("DBクエリが成功した場合はGET /healthが200を返す", async () => {
    dataSource.query.mockResolvedValue([{ result: 1 }]);

    await request(app.getHttpServer())
      .get("/health")
      .expect(200)
      .expect({ status: "ok", database: "ok" });
    expect(dataSource.query).toHaveBeenCalledExactlyOnceWith("SELECT 1");
  });

  it("DBクエリが失敗した場合はGET /healthが内部情報を含まない503を返す", async () => {
    dataSource.query.mockRejectedValue(
      new Error("Internal database error details"),
    );

    await request(app.getHttpServer()).get("/health").expect(503).expect({
      message: "Database connection unavailable",
      error: "Service Unavailable",
      statusCode: 503,
    });
  });

  afterEach(async () => {
    await app.close();
  });
});
