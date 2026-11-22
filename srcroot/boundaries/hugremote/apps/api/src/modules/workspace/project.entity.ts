import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('projects')
export class ProjectEntity {
  @PrimaryColumn('text') id!: string;
  @Column('text', { name: 'host_id' }) hostId!: string;
  @Column('text') name!: string;
  @Column('text', { name: 'root_path' }) rootPath!: string;
  @Column('integer', { name: 'is_home', default: 0 }) isHome!: number;
  @Column('text', { name: 'created_at' }) createdAt!: string;
}
