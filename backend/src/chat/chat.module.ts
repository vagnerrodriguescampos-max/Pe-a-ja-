import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversa, Mensagem } from './conversa.entity';
import { Cliente } from '../pedido/cliente.entity';
import { Pedido } from '../pedido/pedido.entity';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ChatPublicoController, ChatAdminController } from './chat.controller';
import { LojaModule } from '../loja/loja.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversa, Mensagem, Cliente, Pedido]),
    LojaModule,
    AiModule,
  ],
  controllers: [ChatPublicoController, ChatAdminController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
