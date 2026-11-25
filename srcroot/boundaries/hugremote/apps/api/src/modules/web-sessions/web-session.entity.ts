import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Vòng 3 — AC-59: phiên trình duyệt (một trang), hiện chung thanh Phiên với Claude/terminal. Không lưu nội dung trang. */
@Entity('web_sessions')
export class WebSessionEntity {
  @PrimaryColumn('text') id!: string;
  @Column('text', { name: 'project_id' }) projectId!: string;
  @Column('text', { name: 'owner_user_id' }) ownerUserId!: string;
  @Column('text') url!: string;
  @Column('text') name!: string;
  @Column('text', { name: 'created_at' }) createdAt!: string;
  @Column('text', { name: 'last_opened_at', nullable: true }) lastOpenedAt!: string | null;
}
