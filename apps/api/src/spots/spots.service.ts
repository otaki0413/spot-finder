import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { NearbySpotsQuery } from "./nearby-spots-query.schema.js";
import { Spot } from "./spot.entity.js";

export interface NearbySpot {
  id: number;
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
}

@Injectable()
export class SpotsService {
  constructor(
    @InjectRepository(Spot) private readonly spots: Repository<Spot>,
  ) {}

  async findNearby(query: NearbySpotsQuery): Promise<NearbySpot[]> {
    const center =
      "ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography";
    try {
      return await this.spots
        .createQueryBuilder("spot")
        .select("spot.id", "id")
        .addSelect("spot.name", "name")
        .addSelect("spot.category", "category")
        .addSelect("spot.address", "address")
        .addSelect("ST_Y(spot.location::geometry)", "latitude")
        .addSelect("ST_X(spot.location::geometry)", "longitude")
        .addSelect(
          `ST_Distance(spot.location, ${center}, true)`,
          "distanceMeters",
        )
        .where(`ST_DWithin(spot.location, ${center}, :radiusMeters, true)`)
        .setParameters({
          latitude: query.latitude,
          longitude: query.longitude,
          radiusMeters: query.radiusKm * 1000,
        })
        .orderBy('"distanceMeters"', "ASC")
        .addOrderBy("spot.id", "ASC")
        .getRawMany<NearbySpot>();
    } catch {
      // 検索失敗を空配列にせず、接続情報やSQLをHTTP応答から隠す。
      throw new ServiceUnavailableException("Spot search unavailable");
    }
  }
}
