import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { UPLOADS_DIR } from './inventory.store';

/** Settings shared by the long-running server (main.ts) and the Vercel function (serverless.ts). */
export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api');
  // Production: only the configured site(s). Development: any origin, so localhost, 127.0.0.1,
  // other ports and phones on the same Wi-Fi can all reach the API. (On Vercel the site and API
  // share one domain, so CORS isn't involved at all.)
  const allowedOrigins = (process.env.CLIENT_ORIGIN ?? 'http://localhost:4200').split(',').map((item) => item.trim());
  app.enableCors({ origin: process.env.NODE_ENV === 'production' ? allowedOrigins : true });
  // Without a database, uploaded photos live in a local folder served at /uploads.
  if (!process.env.DATABASE_URL) app.useStaticAssets(UPLOADS_DIR, { prefix: '/uploads/', maxAge: '30d' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
}
