import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { createDatabaseOptions } from "./database/database-options.js";
import { SpotsModule } from "./spots/spots.module.js";

@Module({
  imports: [
    SpotsModule,
    TypeOrmModule.forRoot({
      ...createDatabaseOptions(),
      retryAttempts: 5,
      retryDelay: 1000,
    }),
  ],
})
export class AppModule {}
