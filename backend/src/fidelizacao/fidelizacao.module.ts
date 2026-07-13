import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ConfigFidelizacao, Carteira, TransacaoCarteira,
  CartaoFidelidade, CampanhaMarketing, LogCampanha,
} from './fidelizacao.entity';
import { Cliente } from '../pedido/cliente.entity';
import { Pedido } from '../pedido/pedido.entity';
import { Conversa } from '../chat/conversa.entity';
import { FidelizacaoService } from './fidelizacao.service';
import { FidelizacaoAdminController, FidelizacaoPublicoController } from './fidelizacao.controller';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConfigFidelizacao, Carteira, TransacaoCarteira,
      CartaoFidelidade, CampanhaMarketing, LogCampanha,
      Cliente, Pedido, Conversa,
    ]),
    ChatModule,
  ],
  controllers: [FidelizacaoAdminController, FidelizacaoPublicoController],
  providers: [FidelizacaoService],
  exports: [FidelizacaoService],
})
export class FidelizacaoModule {}
