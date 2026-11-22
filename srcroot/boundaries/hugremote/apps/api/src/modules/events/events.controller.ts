import { Controller, MessageEvent, Query, Sse } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { filter, from, interval, map, merge, Observable, switchMap, throwError } from 'rxjs';
import { ErrorCode } from '@app/shared';
import { AppError } from '../../common/app-error';
import { Public } from '../../common/decorators';
import { AuthService } from '../auth/auth.service';
import { EventsService } from './events.service';

/** events.v1 — SSE toàn cục, xác thực bằng vé 30s (EventSource không gửi được header). Heartbeat 15s. */
@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly auth: AuthService,
  ) {}

  @Public()
  @Sse('stream')
  stream(@Query('ticket') ticket?: string): Observable<MessageEvent> {
    return from(this.auth.consumeTicket(ticket)).pipe(
      switchMap((user) => {
        if (!user) return throwError(() => AppError.unauthorized(ErrorCode.TICKET_INVALID));
        const ev = this.events.stream$.pipe(
          filter((e) => EventsService.visibleTo(e, user)),
          map((e): MessageEvent => ({ type: e.type, data: e.data })),
        );
        const beat = interval(15_000).pipe(map((): MessageEvent => ({ type: 'ping', data: {} })));
        return merge(ev, beat);
      }),
    );
  }
}
