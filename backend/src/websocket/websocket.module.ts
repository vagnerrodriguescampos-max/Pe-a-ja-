import { Module } from '@nestjs/common';
import { PedidoGateway } from './pedido.gateway';

@Module({
  providers: [PedidoGateway],
  exports: [PedidoGateway],
})
export class WebsocketModule {}
