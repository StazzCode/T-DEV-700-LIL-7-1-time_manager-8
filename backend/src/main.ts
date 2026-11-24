import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.setGlobalPrefix('api/v1');
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Backend NestJS running on http://localhost:${port}/api/v1`);
}

await bootstrap();
