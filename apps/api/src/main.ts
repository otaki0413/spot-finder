import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  try {
    await app.listen(Number(process.env.PORT ?? 3001), "0.0.0.0");
  } catch (error) {
    await app.close();
    throw error;
  }
}
await bootstrap();
