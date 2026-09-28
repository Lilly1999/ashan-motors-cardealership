import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    process.env.INVENTORY_FILE = join(tmpdir(), `ashan-inventory-${randomUUID()}.json`);
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    await app.init();
    appController = app.get<AppController>(AppController);
  });

  it('reports a healthy status', () => {
    expect(appController.getHealth()).toEqual({ status: 'ok' });
  });

  it('seeds sample inventory, newest first', async () => {
    const cars = await appController.getCars();
    expect(cars.length).toBeGreaterThan(0);
    expect(cars[0].createdAt >= cars[cars.length - 1].createdAt).toBe(true);
  });
});
