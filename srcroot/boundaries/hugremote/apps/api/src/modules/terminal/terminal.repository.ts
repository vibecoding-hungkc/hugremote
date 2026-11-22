import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TerminalSessionEntity } from './terminal.entity';

@Injectable()
export class TerminalRepository {
  constructor(@InjectRepository(TerminalSessionEntity) private readonly rows: Repository<TerminalSessionEntity>) {}

  byProject(projectId: string, ownerUserId?: string) {
    return this.rows.find({ where: ownerUserId ? { projectId, ownerUserId } : { projectId }, order: { createdAt: 'ASC' } });
  }
  all(ownerUserId?: string) {
    return this.rows.find({ where: ownerUserId ? { ownerUserId } : {}, order: { createdAt: 'ASC' } });
  }
  get(id: string) {
    return this.rows.findOne({ where: { id } });
  }
  insert(r: TerminalSessionEntity) {
    return this.rows.insert(r);
  }
  update(id: string, patch: Partial<TerminalSessionEntity>) {
    return this.rows.update({ id }, patch);
  }
  delete(id: string) {
    return this.rows.delete({ id });
  }
  /** Khởi động lại dịch vụ → mọi phiên đang chạy thành đã kết thúc (ARCHITECTURE §6). */
  markAllExited() {
    return this.rows.update({ status: 'running' }, { status: 'exited' });
  }
  countRunningInProject(projectId: string) {
    return this.rows.count({ where: { projectId, status: 'running' } });
  }
  countRunningOf(ownerUserId: string) {
    return this.rows.count({ where: { ownerUserId, status: 'running' } });
  }
  countRunning() {
    return this.rows.count({ where: { status: 'running' } });
  }
}
