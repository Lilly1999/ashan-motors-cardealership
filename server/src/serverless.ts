import type { IncomingMessage, ServerResponse } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './setup';

type Handler = (request: IncomingMessage, response: ServerResponse) => void;

// Vercel keeps a function instance warm between requests, so the Nest app (and its database pool)
// is created once per instance and reused.
let app: Promise<Handler> | undefined;

async function createApp(): Promise<Handler> {
  const nest = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn', 'log'] });
  configureApp(nest);
  await nest.init();
  return nest.getHttpAdapter().getInstance() as Handler;
}

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  app ??= createApp().catch((error: unknown) => {
    app = undefined; // Let the next request retry, e.g. after a database hiccup.
    throw error;
  });
  (await app)(request, response);
}
