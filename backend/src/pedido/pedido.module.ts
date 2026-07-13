import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pedido, PedidoItem, PedidoItemOpcao } from './pedido.entity';
import { Cliente, Endereco } from './cliente.entity';
import { PedidoService } from './pedido.service';
import { PedidoPublicoController, PedidoAdminController } from './pedido.controller';
import { WebsocketModule } from '../websocket/websocket.module';
import { LojaModule } from '../loja/loja.module';
import { FidelizacaoModule } from '../fidelizacao/fidelizacao.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pedido, PedidoItem, PedidoItemOpcao, Cliente, Endereco]),
    WebsocketModule,
    LojaModule,
    FidelizacaoModule,
    PushModule,
  ],
  providers: [PedidoService],
  controllers: [PedidoPublicoController, PedidoAdminController],
})
export class PedidoModule {}
