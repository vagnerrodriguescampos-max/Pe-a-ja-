import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Loja } from '../loja/loja.entity';
import { Cliente } from '../pedido/cliente.entity';
import { WhatsappService } from './whatsapp.service';
import { WhatsappAdminController, WhatsappWebhookController } from './whatsapp.controller';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [TypeOrmModule.forFeature([Loja, Cliente]), ChatModule],
  controllers: [WhatsappAdminController, WhatsappWebhookController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
