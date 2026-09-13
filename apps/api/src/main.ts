import 'dotenv/config';
import { createApp } from './app';
async function bootstrap() {
  const app = await createApp();
  await app.listen(Number(process.env.PORT) || 3000, '0.0.0.0');
}
bootstrap();
