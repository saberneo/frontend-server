import { Module } from '@nestjs/common';
import { M1ProxyController } from './m1-proxy.controller';

@Module({
  controllers: [M1ProxyController],
})
export class M1ProxyModule {}
