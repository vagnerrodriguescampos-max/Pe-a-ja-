import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PedidoGateway } from './pedido.gateway';
import { Pedido } from '../pedido/pedido.entity';
import { getJwtSecret } from '../auth/jwt.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pedido]),
    JwtModule.register({ secret: getJwtSecret() }),
  ],
  providers: [PedidoGateway],
  exports: [PedidoGateway],
})
export class WebsocketModule {}
