import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity('claude_sessions')
export class ClaudeSessionEntity {
  @PrimaryColumn('text') id!: string;
  @Column('text', { name: 'project_id' }) projectId!: string;
  @Column('text', { name: 'owner_user_id' }) ownerUserId!: string;
  @Column('text') name!: string;
  @Column('text', { name: 'cli_session_id', nullable: true }) cliSessionId!: string | null;
  @Column('text', { nullable: true }) model!: string | null;
  @Column('text', { nullable: true }) effort!: string | null;
  @Column('text', { name: 'permission_mode' }) permissionMode!: string;
  @Column('text') status!: 'idle' | 'running' | 'awaiting_input' | 'done' | 'cancelled' | 'error';
  @Column('integer', { name: 'last_sequence', default: 0 }) lastSequence!: number;
  @Column('text', { name: 'created_at' }) createdAt!: string;
  @Column('text', { name: 'updated_at' }) updatedAt!: string;
}

@Entity('claude_messages')
export class ClaudeMessageEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column('text', { name: 'session_id' }) sessionId!: string;
  @Column('integer') seq!: number;
  @Column('text') role!: string;
  @Column('text') content!: string;
  @Column('text', { name: 'created_at' }) createdAt!: string;
}

@Entity('claude_queue')
export class ClaudeQueueEntity {
  @PrimaryColumn('text') id!: string;
  @Column('text', { name: 'session_id' }) sessionId!: string;
  @Column('text', { name: 'user_id' }) userId!: string;
  @Column('text') text!: string;
  @Column('text', { name: 'attachments_json', default: '[]' }) attachmentsJson!: string;
  @Column('text', { name: 'created_at' }) createdAt!: string;
}
