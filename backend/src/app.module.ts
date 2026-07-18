import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
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
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
