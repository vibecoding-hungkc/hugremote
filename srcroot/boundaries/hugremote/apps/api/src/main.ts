import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Logger } from 'nestjs-pino';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';
import { APP_CONFIG } from './config/app-config';
import { secureDataDir } from './common/data-dir';
import type { AppConfig } from './config/app-config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const cfg = app.get<AppConfig>(APP_CONFIG);
  process.umask(0o077);
  secureDataDir(cfg.dataDir);
  const logger = app.get(Logger);
  app.useLogger(logger);
  // Mặc định Node in ra stderr rồi thoát — không vào app.log nên không hiện ở Hệ thống (AC-15).
  // Ghi qua logger chung trước khi thoát; systemd/launchd Restart=on-failure/KeepAlive tự khởi động lại.
  process.on('uncaughtException', (err) => {
    logger.error(err?.stack ?? String(err), 'uncaughtException');
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error(reason instanceof Error ? (reason.stack ?? reason.message) : String(reason), 'unhandledRejection');
    process.exit(1);
  });
  app.useWebSocketAdapter(new WsAdapter(app));
  app.set('trust proxy', cfg.trustProxy ? 1 : false);
  app.disable('x-powered-by');
  // header bảo mật tối thiểu (AC-34): không đoán MIME, không cho nhúng iframe, không rò referrer
  app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });
  app.use(cookieParser());
  app.setGlobalPrefix(`${cfg.basePath}/api`.replace(/^\//, ''));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();

  if (cfg.env !== 'production') {
    const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('HugRemote API').setVersion('1').addBearerAuth().build());
    SwaggerModule.setup(`${cfg.basePath}/api/docs`, app, doc, { jsonDocumentUrl: `${cfg.basePath}/api/docs-json` });
  }

  // Phục vụ bản build web (một cổng, dưới BASE_PATH); chèn base path vào index.html lúc trả
  const dist = cfg.webDist ?? path.resolve(__dirname, '..', '..', 'web', 'dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.useStaticAssets(dist, { prefix: cfg.basePath || '/', index: false });
    const server = app.getHttpAdapter().getInstance();
    server.get(`${cfg.basePath}/`, (_req: unknown, res: { type: (t: string) => { send: (b: string) => void } }) => {
      // Đọc mỗi lần (file nhỏ) để luôn khớp bản build hiện tại sau cập nhật
      const html = fs
        .readFileSync(path.join(dist, 'index.html'), 'utf8')
        .replace('<head>', `<head><meta name="hugremote-base-path" content="${cfg.basePath}">`);
      res.type('html').send(html);
    });
  }

  await app.listen(cfg.port, cfg.host);
  app.get(Logger).log(`HugRemote nghe ở http://${cfg.host}:${cfg.port}${cfg.basePath}/`);
}
void bootstrap();
