import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, loadConfig } from '../config/app-config';
import { CryptoService } from './crypto.service';

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }, CryptoService],
  exports: [APP_CONFIG, CryptoService],
})
export class CoreModule {}
