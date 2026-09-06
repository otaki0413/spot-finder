import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { App } from "supertest/types.js";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { SpotsModule } from "../src/spots/spots.module.js";
import { Spot } from "../src/spots/spot.entity.js";
import { StandardSchemaValidationPipe } from "@nestjs/common";

const valid = "latitude=35.6812&longitude=139.7671&radiusKm=1.5";

describe("GET /spots/nearby", () => {
  let app: INestApplication<App>;
  const builder = {
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    setParameters: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    getRawMany: vi.fn(),
  };
  const repository = { createQueryBuilder: vi.fn(() => builder) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [SpotsModule],
    })
      .overrideProvider(getRepositoryToken(Spot))
      .useValue(repository)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    builder.getRawMany.mockResolvedValue([]);
  });
  afterAll(async () => {
    await app?.close();
  });

  it("該当なしを200と空配列で返す", async () => {
    await request(app.getHttpServer())
      .get(`/spots/nearby?${valid}`)
      .expect(200)
      .expect([]);
    expect(builder.setParameters).toHaveBeenCalledWith({
      latitude: 35.6812,
      longitude: 139.7671,
      radiusMeters: 1500,
    });
  });

  it.each([
    "",
    "longitude=139&radiusKm=1",
    "latitude=35&radiusKm=1",
    "latitude=35&longitude=139",
    ...[
      "",
      " ",
      "abc",
      "NaN",
      "Infinity",
      "-Infinity",
      "91",
      "-91",
      "35foo",
    ].map(
      (value) =>
        `latitude=${encodeURIComponent(value)}&longitude=139&radiusKm=1`,
    ),
    ...["181", "-181", "NaN"].map(
      (value) => `latitude=35&longitude=${value}&radiusKm=1`,
    ),
    ...["0", "-1", "NaN", "Infinity", "1e309", "1e308", ""].map(
      (value) => `latitude=35&longitude=139&radiusKm=${value}`,
    ),
    `${valid}&radiusKm=1.5`,
    `${valid}&latitude=35`,
    `${valid}&longitude=139`,
    `${valid}&category=cafe`,
    `${valid}&radiusKm[]=1`,
  ])("不正入力をDBへ渡さず400にする: %s", async (query) => {
    const response = await request(app.getHttpServer())
      .get(`/spots/nearby?${query}`)
      .expect(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
      message: expect.any(Array),
    });
    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it.each([
    "latitude=-90&longitude=-180&radiusKm=0.001",
    "latitude=90&longitude=180&radiusKm=100000",
    "latitude=0&longitude=0&radiusKm=5e-324",
    `latitude=0&longitude=0&radiusKm=${encodeURIComponent(Number.MAX_VALUE / 1000)}`,
  ])("範囲内の座標と正の半径を受け入れる: %s", async (query) => {
    await request(app.getHttpServer())
      .get(`/spots/nearby?${query}`)
      .expect(200);
    expect(repository.createQueryBuilder).toHaveBeenCalledOnce();
  });

  it.each(["Connection terminated unexpectedly", "Query read timeout"])(
    "DB失敗を内部情報を含まない503にする: %s",
    async (message) => {
      builder.getRawMany.mockRejectedValueOnce(new Error(message));
      await request(app.getHttpServer())
        .get(`/spots/nearby?${valid}`)
        .expect(503)
        .expect({
          statusCode: 503,
          message: "Spot search unavailable",
          error: "Service Unavailable",
        });
    },
  );
});
