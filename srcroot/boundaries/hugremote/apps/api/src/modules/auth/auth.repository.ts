import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { LoginAttemptEntity, RefreshTokenEntity, TwoFactorEntity, UserEntity } from './auth.entities';

/** Chỗ DUY NHẤT của module auth chạm DB. */
@Injectable()
export class AuthRepository {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(RefreshTokenEntity) private readonly tokens: Repository<RefreshTokenEntity>,
    @InjectRepository(TwoFactorEntity) private readonly tfa: Repository<TwoFactorEntity>,
    @InjectRepository(LoginAttemptEntity) private readonly attempts: Repository<LoginAttemptEntity>,
  ) {}

  findOwner() {
    return this.users.findOne({ where: { role: 'owner' } });
  }
  findUser(id: string) {
    return this.users.findOne({ where: { id } });
  }
  findUserByEmail(email: string) {
    return this.users.findOne({ where: { email } });
  }
  listMembers() {
    return this.users.find({ where: { role: 'member' }, order: { createdAt: 'ASC' } });
  }
  saveUser(u: UserEntity) {
    return this.users.save(u);
  }
  updateUser(id: string, patch: Partial<UserEntity>) {
    return this.users.update({ id }, patch);
  }

  insertToken(t: RefreshTokenEntity) {
    return this.tokens.insert(t);
  }
  findTokenByHash(hash: string) {
    return this.tokens.findOne({ where: { tokenHash: hash } });
  }
  updateToken(id: string, patch: Partial<RefreshTokenEntity>) {
    return this.tokens.update({ id }, patch);
  }
  revokeFamily(familyId: string, at: string) {
    return this.tokens.update({ familyId, revokedAt: IsNull() }, { revokedAt: at });
  }
  revokeAllForUser(userId: string, at: string, exceptFamily?: string) {
    const where = exceptFamily ? { userId, revokedAt: IsNull(), familyId: Not(exceptFamily) } : { userId, revokedAt: IsNull() };
    return this.tokens.update(where, { revokedAt: at });
  }
  /** Còn ít nhất một token chưa thu hồi, chưa hết hạn trong family — thiết bị còn đăng nhập. */
  async familyActive(familyId: string, now: string): Promise<boolean> {
    const n = await this.tokens
      .createQueryBuilder('t')
      .where('t.family_id = :familyId AND t.revoked_at IS NULL AND t.expires_at > :now', { familyId, now })
      .getCount();
    return n > 0;
  }
  /** Mỗi family một dòng — token mới nhất còn hiệu lực. */
  async activeDevices(userId: string, now: string) {
    const rows = await this.tokens
      .createQueryBuilder('t')
      .where('t.user_id = :userId AND t.revoked_at IS NULL AND t.expires_at > :now', { userId, now })
      .orderBy('t.created_at', 'ASC')
      .getMany();
    const byFamily = new Map<string, { first: RefreshTokenEntity; last: RefreshTokenEntity }>();
    for (const r of rows) {
      const e = byFamily.get(r.familyId);
      if (!e) byFamily.set(r.familyId, { first: r, last: r });
      else e.last = r;
    }
    return [...byFamily.values()];
  }
  async familyFirstCreated(familyId: string) {
    return this.tokens.findOne({ where: { familyId }, order: { createdAt: 'ASC' } });
  }

  getTwoFactor(userId: string) {
    return this.tfa.findOne({ where: { userId } });
  }
  saveTwoFactor(t: TwoFactorEntity) {
    return this.tfa.save(t);
  }

  getAttempt(key: string) {
    return this.attempts.findOne({ where: { key } });
  }
  saveAttempt(a: LoginAttemptEntity) {
    return this.attempts.save(a);
  }
  clearAttempt(key: string) {
    return this.attempts.delete({ key });
  }
}
