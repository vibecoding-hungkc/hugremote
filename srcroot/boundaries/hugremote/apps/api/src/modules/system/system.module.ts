import { Module } from '@nestjs/common';
import { ClaudeModule } from '../claude/claude.module';
import { TerminalModule } from '../terminal/terminal.module';
import { UpdaterService } from './updater.service';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';

@Module({ imports: [ClaudeModule, TerminalModule], controllers: [SystemController], providers: [SystemService, UpdaterService] })
export class SystemModule {}
