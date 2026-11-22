import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerminalController } from './terminal.controller';
import { TerminalSessionEntity } from './terminal.entity';
import { TerminalGateway } from './terminal.gateway';
import { TerminalRepository } from './terminal.repository';
import { TerminalService } from './terminal.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([TerminalSessionEntity])],
  controllers: [TerminalController],
  providers: [TerminalRepository, TerminalService, TerminalGateway],
  exports: [TerminalService],
})
export class TerminalModule {}
