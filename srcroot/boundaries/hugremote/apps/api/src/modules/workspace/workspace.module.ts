import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectEntity } from './project.entity';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceRepository } from './workspace.repository';
import { WorkspaceService } from './workspace.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ProjectEntity])],
  controllers: [WorkspaceController],
  providers: [WorkspaceRepository, WorkspaceService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
