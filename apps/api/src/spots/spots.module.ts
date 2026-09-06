import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Spot } from "./spot.entity.js";
import { SpotsController } from "./spots.controller.js";
import { SpotsService } from "./spots.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([Spot])],
  controllers: [SpotsController],
  providers: [SpotsService],
})
export class SpotsModule {}
