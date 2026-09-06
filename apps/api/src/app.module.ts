import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { createDatabaseOptions } from "./database/database-options.js";
import { initializeDatabase } from "./database/initialize-database.js";
import { SpotSeedService } from "./spots/spot-seed.service.js";

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...createDatabaseOptions(),
        retryAttempts: 5,
        retryDelay: 1000,
      }),
      dataSourceFactory: initializeDatabase,
    }),
  ],
  controllers: [AppController],
  providers: [AppService, SpotSeedService],
})
export class AppModule {}
