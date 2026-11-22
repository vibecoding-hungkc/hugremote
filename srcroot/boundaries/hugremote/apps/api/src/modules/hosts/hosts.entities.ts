import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('hosts_meta')
export class HostMetaEntity {
  @PrimaryColumn('text', { name: 'host_id' }) hostId!: string;
  @Column('text', { name: 'workspace_dir', nullable: true }) workspaceDir!: string | null;
  @Column('text', { name: 'auth_type', nullable: true }) authType!: 'key' | 'password' | 'agent' | null;
  @Column('text', { name: 'secret_enc', nullable: true }) secretEnc!: string | null;
  @Column('text', { name: 'updated_at' }) updatedAt!: string;
}

@Entity('known_hosts')
export class KnownHostEntity {
  @Column('text', { name: 'host_id' }) hostId!: string;
  @PrimaryColumn('text') host!: string;
  @PrimaryColumn('integer') port!: number;
  @PrimaryColumn('text', { name: 'key_type' }) keyType!: string;
  @Column('text', { name: 'fingerprint_sha256' }) fingerprintSha256!: string;
  @Column('text', { name: 'trusted_at' }) trustedAt!: string;
}

@Entity('pinned_hosts')
export class PinnedHostEntity {
  @PrimaryColumn('text', { name: 'user_id' }) userId!: string;
  @PrimaryColumn('text', { name: 'host_id' }) hostId!: string;
  @Column('integer') position!: number;
}
