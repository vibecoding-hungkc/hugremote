import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HostMetaEntity, KnownHostEntity, PinnedHostEntity } from './hosts.entities';

@Injectable()
export class HostsRepository {
  constructor(
    @InjectRepository(HostMetaEntity) private readonly meta: Repository<HostMetaEntity>,
    @InjectRepository(KnownHostEntity) private readonly known: Repository<KnownHostEntity>,
    @InjectRepository(PinnedHostEntity) private readonly pins: Repository<PinnedHostEntity>,
  ) {}

  allMeta() {
    return this.meta.find();
  }
  getMeta(hostId: string) {
    return this.meta.findOne({ where: { hostId } });
  }
  saveMeta(m: HostMetaEntity) {
    return this.meta.save(m);
  }
  deleteMeta(hostId: string) {
    return this.meta.delete({ hostId });
  }

  knownFor(host: string, port: number) {
    return this.known.find({ where: { host, port } });
  }
  allKnown() {
    return this.known.find();
  }
  async trust(k: KnownHostEntity) {
    await this.known.delete({ host: k.host, port: k.port, keyType: k.keyType });
    await this.known.insert(k);
  }
  deleteKnownForHost(hostId: string) {
    return this.known.delete({ hostId });
  }

  pinsOf(userId: string) {
    return this.pins.find({ where: { userId }, order: { position: 'ASC' } });
  }
  async replacePins(userId: string, hostIds: string[]) {
    await this.pins.delete({ userId });
    if (hostIds.length) await this.pins.insert(hostIds.map((hostId, position) => ({ userId, hostId, position })));
  }
  deletePinsForHost(hostId: string) {
    return this.pins.delete({ hostId });
  }
}
