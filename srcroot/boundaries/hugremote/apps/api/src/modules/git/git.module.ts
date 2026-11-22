import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { GitController } from './git.controller';
import { GitService } from './git.service';

@Module({ imports: [FilesModule], controllers: [GitController], providers: [GitService] })
export class GitModule {}
