import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryColumn('text') id!: string;
  @Column('text') role!: 'owner' | 'member';
  @Column('text', { nullable: true }) email!: string | null;
  @Column('text', { name: 'password_hash', nullable: true }) passwordHash!: string | null;
  @Column('text', { name: 'password_salt', nullable: true }) passwordSalt!: string | null;
  @Column('integer', { name: 'must_change_password', default: 0 }) mustChangePassword!: number;
  @Column('text', { default: '{}' }) preferences!: string;
  @Column('text', { name: 'last_login_at', nullable: true }) lastLoginAt!: string | null;
  @Column('text', { name: 'revoked_at', nullable: true }) revokedAt!: string | null;
  @Column('text', { name: 'created_at' }) createdAt!: string;
}

@Entity('refresh_tokens')
export class RefreshTokenEntity {
  @PrimaryColumn('text') id!: string;
  @Column('text', { name: 'user_id' }) userId!: string;
  @Column('text', { name: 'family_id' }) familyId!: string;
  @Column('text', { name: 'token_hash' }) tokenHash!: string;
  @Column('text', { nullable: true }) ip!: string | null;
  @Column('text', { name: 'user_agent', nullable: true }) userAgent!: string | null;
  @Column('text', { name: 'created_at' }) createdAt!: string;
  @Column('text', { name: 'expires_at' }) expiresAt!: string;
  @Column('text', { name: 'last_used_at', nullable: true }) lastUsedAt!: string | null;
  @Column('text', { name: 'revoked_at', nullable: true }) revokedAt!: string | null;
}

@Entity('two_factor')
export class TwoFactorEntity {
  @PrimaryColumn('text', { name: 'user_id' }) userId!: string;
  @Column('integer', { default: 0 }) enabled!: number;
  @Column('text', { name: 'secret_enc', nullable: true }) secretEnc!: string | null;
  @Column('text', { name: 'pending_secret_enc', nullable: true }) pendingSecretEnc!: string | null;
  @Column('text', { name: 'recovery_code_hashes', default: '[]' }) recoveryCodeHashes!: string;
}

@Entity('login_attempts')
export class LoginAttemptEntity {
  @PrimaryColumn('text') key!: string;
  @Column('integer', { name: 'fail_count', default: 0 }) failCount!: number;
  @Column('text', { name: 'locked_until', nullable: true }) lockedUntil!: string | null;
}
