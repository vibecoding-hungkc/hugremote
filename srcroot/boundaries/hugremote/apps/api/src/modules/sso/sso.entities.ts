import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sso_config')
export class SsoConfigEntity {
  @PrimaryColumn('text') provider!: 'google' | 'oidc';
  @Column('text', { name: 'issuer_url', nullable: true }) issuerUrl!: string | null;
  @Column('text', { name: 'client_id', nullable: true }) clientId!: string | null;
  @Column('text', { name: 'client_secret_enc', nullable: true }) clientSecretEnc!: string | null;
  @Column('text', { name: 'allowed_emails', default: '[]' }) allowedEmails!: string;
  @Column('text', { name: 'button_label', nullable: true }) buttonLabel!: string | null;
  @Column('integer', { default: 0 }) enabled!: number;
}

@Entity('sso_denials')
export class SsoDenialEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column('text') email!: string;
  @Column('text') provider!: string;
  @Column('text') reason!: 'not_allowed' | 'revoked' | 'disabled' | 'token_invalid';
  @Column('text') at!: string;
}
