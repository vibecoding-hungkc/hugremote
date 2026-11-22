import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClaudeController } from './claude.controller';
import { ClaudeMessageEntity, ClaudeQueueEntity, ClaudeSessionEntity } from './claude.entities';
import { ClaudeRepository } from './claude.repository';
import { ClaudeService } from './claude.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ClaudeSessionEntity, ClaudeMessageEntity, ClaudeQueueEntity])],
  controllers: [ClaudeController],
  providers: [ClaudeRepository, ClaudeService],
  exports: [ClaudeService],
})
export class ClaudeModule {}
