import { ServiceUnavailableException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";

describe("AppController", () => {
  let app: TestingModule;
  let appController: AppController;
  const dataSource = { query: vi.fn() };

  beforeEach(async () => {
    dataSource.query.mockReset();
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: DataSource, useValue: dataSource }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  afterEach(async () => {
    await app.close();
  });

  it("DBへの疎通を確認してから正常な状態を返す", async () => {
    dataSource.query.mockResolvedValue([{ result: 1 }]);

    await expect(appController.getHealth()).resolves.toEqual({
      status: "ok",
      database: "ok",
    });
    expect(dataSource.query).toHaveBeenCalledExactlyOnceWith("SELECT 1");
  });

  it("DBクエリに失敗した場合は内部情報を含まない利用不可エラーを返す", async () => {
    dataSource.query.mockRejectedValue(
      new Error("Internal database error details"),
    );

    await expect(appController.getHealth()).rejects.toEqual(
      new ServiceUnavailableException("Database connection unavailable"),
    );
  });
});
