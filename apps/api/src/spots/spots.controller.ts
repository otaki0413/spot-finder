import { Controller, Get, Query } from "@nestjs/common";
import { nearbySpotsQuerySchema } from "./nearby-spots-query.schema.js";
import type { NearbySpotsQuery } from "./nearby-spots-query.schema.js";
import { NearbySpotsQueryPipe } from "./nearby-spots-query.pipe.js";
import { SpotsService } from "./spots.service.js";

@Controller("spots")
export class SpotsController {
  constructor(private readonly spotsService: SpotsService) {}

  @Get("nearby")
  nearby(
    @Query({
      schema: nearbySpotsQuerySchema,
      pipes: [new NearbySpotsQueryPipe()],
    })
    query: NearbySpotsQuery,
  ) {
    return this.spotsService.findNearby(query);
  }
}
