import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { SsoConfigEntity, SsoDenialEntity } from './sso.entities';

/** Chỗ duy nhất của module sso chạm DB. */
@Injectable()
export class SsoRepository {
  constructor(
    @InjectRepository(SsoConfigEntity) private readonly configs: Repository<SsoConfigEntity>,
    @InjectRepository(SsoDenialEntity) private readonly denials: Repository<SsoDenialEntity>,
  ) {}

  allConfigs() {
    return this.configs.find();
  }
  getConfig(provider: string) {
    return this.configs.findOne({ where: { provider: provider as SsoConfigEntity['provider'] } });
  }
  saveConfig(c: SsoConfigEntity) {
    return this.configs.save(c);
  }
  async disableAll() {
    await this.configs.update({ enabled: 1 }, { enabled: 0 });
  }

  /** Giữ 200 dòng gần nhất. */
  async addDenial(d: Omit<SsoDenialEntity, 'id'>) {
    await this.denials.insert(d);
    const keep = await this.denials.find({ order: { id: 'DESC' }, skip: 199, take: 1 });
    if (keep[0]) await this.denials.delete({ id: LessThan(keep[0].id) });
  }
  listDenials() {
    return this.denials.find({ order: { id: 'DESC' }, take: 50 });
  }
  removeDenialsOf(email: string) {
    return this.denials.delete({ email });
  }
}
