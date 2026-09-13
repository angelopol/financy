import 'dotenv/config';
import { createApp } from '../src/app';

let handler: ((req: any, res: any) => void) | null = null;

export default async function (req: any, res: any) {
  if (!handler) {
    const app = await createApp();
    handler = app.getHttpAdapter().getInstance();
  }
  handler(req, res);
}
