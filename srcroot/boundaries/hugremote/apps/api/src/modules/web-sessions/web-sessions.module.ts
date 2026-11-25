import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebSessionEntity } from './web-session.entity';
import { WebSessionsService } from './web-sessions';
import { WebSessionsController } from './web-sessions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WebSessionEntity])],
  controllers: [WebSessionsController],
  providers: [WebSessionsService],
})
export class WebSessionsModule {}
