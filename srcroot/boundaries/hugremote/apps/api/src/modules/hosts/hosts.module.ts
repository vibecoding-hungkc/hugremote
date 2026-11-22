import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HostMetaEntity, KnownHostEntity, PinnedHostEntity } from './hosts.entities';
import { HostsController } from './hosts.controller';
import { HostsRepository } from './hosts.repository';
import { HostsService } from './hosts.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([HostMetaEntity, KnownHostEntity, PinnedHostEntity])],
  controllers: [HostsController],
  providers: [HostsRepository, HostsService],
  exports: [HostsService],
})
export class HostsModule {}
