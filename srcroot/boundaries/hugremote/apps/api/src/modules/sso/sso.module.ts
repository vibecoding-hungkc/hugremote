import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClaudeModule } from '../claude/claude.module';
import { TerminalModule } from '../terminal/terminal.module';
import { SsoController } from './sso.controller';
import { SsoConfigEntity, SsoDenialEntity } from './sso.entities';
import { SsoRepository } from './sso.repository';
import { SsoService } from './sso.service';

@Module({
  imports: [TypeOrmModule.forFeature([SsoConfigEntity, SsoDenialEntity]), ClaudeModule, TerminalModule],
  controllers: [SsoController],
  providers: [SsoRepository, SsoService],
})
export class SsoModule {}
