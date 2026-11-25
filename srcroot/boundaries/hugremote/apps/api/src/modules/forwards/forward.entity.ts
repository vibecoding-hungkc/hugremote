import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Vòng 3 — AC-57: chuyển tiếp cổng hai chiều. Listener sống trong RAM của API; bảng giữ cấu hình. */
@Entity('port_forwards')
export class PortForwardEntity {
  @PrimaryColumn('text') id!: string;
  /** `L`: máy SSH → Mac (`ssh -L`) · `R`: Mac → máy SSH (`ssh -R`). */
  @Column('text') direction!: 'L' | 'R';
  @Column('text', { name: 'host_id' }) hostId!: string;
  @Column('text', { name: 'remote_host' }) remoteHost!: string;
  @Column('integer', { name: 'remote_port' }) remotePort!: number;
  @Column('integer', { name: 'local_port' }) localPort!: number;
  @Column('text', { nullable: true }) label!: string | null;
  @Column('integer', { name: 'auto_start' }) autoStart!: boolean;
  @Column('integer') enabled!: boolean;
  @Column('text', { name: 'created_at' }) createdAt!: string;
}
