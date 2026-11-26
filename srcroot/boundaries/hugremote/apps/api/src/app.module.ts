import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { APP_CONFIG, AppConfig, loadConfig } from './config/app-config';
import { CoreModule } from './common/core.module';
import { ErrorFilter } from './common/error.filter';
import { JwtAuthGuard } from './common/jwt-auth.guard';
import { createLogStream, REDACT } from './common/logger';
import { dataSourceOptions } from './infra/database/data-source';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { HostsModule } from './modules/hosts/hosts.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { TerminalModule } from './modules/terminal/terminal.module';
import { EventsModule } from './modules/events/events.module';
import { FilesModule } from './modules/files/files.module';
import { GitModule } from './modules/git/git.module';
import { SsoModule } from './modules/sso/sso.module';
import { SystemModule } from './modules/system/system.module';
import { ClaudeModule } from './modules/claude/claude.module';
import { ForwardsModule } from './modules/forwards/forwards.module';
import { WebSessionsModule } from './modules/web-sessions/web-sessions.module';
import { SessionNotesModule } from './modules/session-notes/session-notes';

@Module({
  imports: [
    CoreModule,
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig) => ({
        pinoHttp: {
          level: cfg.env === 'production' ? 'info' : 'debug',
          redact: { paths: REDACT, censor: '[redacted]' },
          stream: createLogStream(cfg),
          autoLogging: { ignore: (req) => !!req.url?.includes('/health') },
        },
      }),
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({ ...dataSourceOptions(loadConfig().dataDir), autoLoadEntities: true, migrationsRun: true, retryAttempts: 0 }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 600 }]),
    HealthModule,
    AuthModule,
    HostsModule,
    WorkspaceModule,
    EventsModule,
    TerminalModule,
    FilesModule,
    GitModule,
    ClaudeModule,
    SystemModule,
    SsoModule,
    ForwardsModule,
    WebSessionsModule,
    SessionNotesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: ErrorFilter },
  ],
})
export class AppModule {}
