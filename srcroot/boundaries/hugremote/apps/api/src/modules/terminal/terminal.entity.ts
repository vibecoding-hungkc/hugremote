import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('terminal_sessions')
export class TerminalSessionEntity {
  @PrimaryColumn('text') id!: string;
  @Column('text', { name: 'project_id' }) projectId!: string;
  @Column('text', { name: 'owner_user_id' }) ownerUserId!: string;
  @Column('text') name!: string;
  @Column('text') cwd!: string;
  @Column('text') status!: 'running' | 'exited';
  @Column('integer', { name: 'exit_code', nullable: true }) exitCode!: number | null;
  @Column('text', { name: 'created_at' }) createdAt!: string;
  @Column('text', { name: 'last_attached_at', nullable: true }) lastAttachedAt!: string | null;
  /** Vòng 3: có = phiên tmux, sống qua restart (ARCHITECTURE §6). */
  @Column('text', { name: 'tmux_name', nullable: true }) tmuxName!: string | null;
}
