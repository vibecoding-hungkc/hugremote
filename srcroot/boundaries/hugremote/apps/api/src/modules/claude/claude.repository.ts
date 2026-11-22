import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ClaudeMessageEntity, ClaudeQueueEntity, ClaudeSessionEntity } from './claude.entities';

@Injectable()
export class ClaudeRepository {
  constructor(
    @InjectRepository(ClaudeSessionEntity) private readonly sessions: Repository<ClaudeSessionEntity>,
    @InjectRepository(ClaudeMessageEntity) private readonly messages: Repository<ClaudeMessageEntity>,
    @InjectRepository(ClaudeQueueEntity) private readonly queue: Repository<ClaudeQueueEntity>,
  ) {}

  getSession(id: string) {
    return this.sessions.findOne({ where: { id } });
  }
  byProject(projectId: string, ownerUserId?: string) {
    return this.sessions.find({ where: ownerUserId ? { projectId, ownerUserId } : { projectId }, order: { createdAt: 'ASC' } });
  }
  all(ownerUserId?: string) {
    return this.sessions.find({ where: ownerUserId ? { ownerUserId } : {}, order: { createdAt: 'ASC' } });
  }
  byCliIds(projectId: string, cliIds: string[]) {
    return cliIds.length ? this.sessions.find({ where: { projectId, cliSessionId: In(cliIds) } }) : Promise.resolve([]);
  }
  insertSession(s: ClaudeSessionEntity) {
    return this.sessions.insert(s);
  }
  updateSession(id: string, patch: Partial<ClaudeSessionEntity>) {
    return this.sessions.update({ id }, { ...patch, updatedAt: new Date().toISOString() });
  }
  deleteSession(id: string) {
    return this.sessions.delete({ id });
  }
  /** Khởi động lại dịch vụ → lượt đang chạy coi như bị dừng. */
  resetRunning() {
    return this.sessions.update({ status: In(['running', 'awaiting_input']) }, { status: 'cancelled' });
  }
  countRunningInProject(projectId: string) {
    return this.sessions.count({ where: { projectId, status: In(['running', 'awaiting_input']) } });
  }
  countRunning() {
    return this.sessions.count({ where: { status: In(['running', 'awaiting_input']) } });
  }

  insertMessage(m: Omit<ClaudeMessageEntity, 'id'>) {
    return this.messages.insert(m);
  }
  messagesOf(sessionId: string) {
    return this.messages.find({ where: { sessionId }, order: { seq: 'ASC' } });
  }
  async hasTurns(sessionId: string) {
    return (await this.messages.count({ where: { sessionId, role: In(['assistant', 'summary']) } })) > 0;
  }

  queueOf(sessionId: string) {
    return this.queue.find({ where: { sessionId }, order: { createdAt: 'ASC' } });
  }
  enqueue(q: ClaudeQueueEntity) {
    return this.queue.insert(q);
  }
  dequeue(id: string) {
    return this.queue.delete({ id });
  }
}
