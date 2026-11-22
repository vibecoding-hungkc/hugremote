import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { UserRole } from '@app/shared';
import type { AuthUser } from '../../common/auth-user';

/** Sự kiện của `events.v1` (ARCHITECTURE §5). `ownerUserId` dùng để lọc theo G-13 — không gửi ra ngoài. */
export interface AppEvent {
  type: 'session_status' | 'interaction_requested' | 'interaction_answered' | 'file_changed' | 'turn_finished' | 'hosts_changed';
  data: Record<string, unknown>;
  ownerUserId?: string;
}

/** Bus trong tiến trình: module phát, SSE `/api/events/stream` nghe và lọc theo người xem. */
@Injectable()
export class EventsService {
  private readonly bus = new Subject<AppEvent>();
  readonly stream$ = this.bus.asObservable();

  publish(e: AppEvent) {
    this.bus.next(e);
  }

  /** member chỉ nhận sự kiện phiên của mình; sự kiện không gắn chủ (file, máy) gửi cho mọi người. */
  static visibleTo(e: AppEvent, u: AuthUser): boolean {
    if (u.role === UserRole.OWNER) return true;
    return !e.ownerUserId || e.ownerUserId === u.id;
  }
}
