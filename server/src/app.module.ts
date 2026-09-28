import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AdminGuard } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, AdminGuard],
})
export class AppModule {}
