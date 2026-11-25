import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortForwardEntity } from './forward.entity';
import { ForwardsController } from './forwards.controller';
import { ForwardsService } from './forwards.service';

@Module({
  imports: [TypeOrmModule.forFeature([PortForwardEntity])],
  controllers: [ForwardsController],
  providers: [ForwardsService],
})
export class ForwardsModule {}
