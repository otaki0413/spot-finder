import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.DB_HOST ?? "db",
      port: Number(process.env.DB_PORT ?? 5432),
      database: process.env.DB_NAME ?? "spot_finder",
      username: process.env.DB_USER ?? "spot_finder",
      password: process.env.DB_PASSWORD ?? "spot_finder",
      entities: [],
      synchronize: false,
      connectTimeoutMS: 1000,
      extra: {
        query_timeout: 1000,
      },
      retryAttempts: 5,
      retryDelay: 1000,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
