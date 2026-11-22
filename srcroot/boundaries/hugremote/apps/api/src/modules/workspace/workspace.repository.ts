import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity } from './project.entity';

@Injectable()
export class WorkspaceRepository {
  constructor(@InjectRepository(ProjectEntity) private readonly projects: Repository<ProjectEntity>) {}

  byHost(hostId: string) {
    return this.projects.find({ where: { hostId }, order: { isHome: 'DESC', name: 'ASC' } });
  }
  all() {
    return this.projects.find();
  }
  get(id: string) {
    return this.projects.findOne({ where: { id } });
  }
  home(hostId: string) {
    return this.projects.findOne({ where: { hostId, isHome: 1 } });
  }
  insert(p: ProjectEntity) {
    return this.projects.insert(p);
  }
  rename(id: string, name: string) {
    return this.projects.update({ id }, { name });
  }
  delete(id: string) {
    return this.projects.delete({ id });
  }
  deleteByHost(hostId: string) {
    return this.projects.delete({ hostId });
  }
}
