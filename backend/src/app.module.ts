import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from './database/snake-naming.strategy';
import { AuthModule } from './auth/auth.module';
import { LojaModule } from './loja/loja.module';
import { CardapioModule } from './cardapio/cardapio.module';
import { PedidoModule } from './pedido/pedido.module';
import { WebsocketModule } from './websocket/websocket.module';
import { ChatModule } from './chat/chat.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { FidelizacaoModule } from './fidelizacao/fidelizacao.module';
import { MotoboyModule } from './motoboy/motoboy.module';
import { AiModule } from './ai/ai.module';
import { PushModule } from './push/push.module';
import { UploadModule } from './upload/upload.module';
import { UsuarioModule } from './usuario/usuario.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { CupomModule } from './cupom/cupom.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: false,
      logging: process.env.NODE_ENV !== 'production',
      namingStrategy: new SnakeNamingStrategy(),
      // Supabase (e a maioria dos Postgres gerenciados) exige SSL. Defina DATABASE_SSL=true no host.
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    AuthModule,
    LojaModule,
    CardapioModule,
    PedidoModule,
    WebsocketModule,
    ChatModule,
    RelatoriosModule,
    FidelizacaoModule,
    MotoboyModule,
    AiModule,
    PushModule,
    UploadModule,
    UsuarioModule,
    WhatsappModule,
    CupomModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
