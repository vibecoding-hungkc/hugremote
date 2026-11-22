import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CryptoService } from '../../common/crypto.service';
import { LoginAttemptEntity, RefreshTokenEntity, TwoFactorEntity, UserEntity } from './auth.entities';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, RefreshTokenEntity, TwoFactorEntity, LoginAttemptEntity]),
    JwtModule.registerAsync({
      inject: [CryptoService],
      useFactory: (c: CryptoService) => ({ secret: c.jwtSecret, signOptions: { algorithm: 'HS256' } }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthRepository, AuthService],
  exports: [AuthService, AuthRepository],
})
export class AuthModule {}
