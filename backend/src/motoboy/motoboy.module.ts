import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RastreamentoMotoboy } from './motoboy.entity';
import { Pedido } from '../pedido/pedido.entity';
import { Usuario } from '../auth/usuario.entity';
import { MotoboyService } from './motoboy.service';
import { MotoboyGateway } from './motoboy.gateway';
import { MotoboyAdminController, MotoboyController, RastreamentoPublicoController } from './motoboy.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RastreamentoMotoboy, Pedido, Usuario])],
  controllers: [MotoboyAdminController, MotoboyController, RastreamentoPublicoController],
  providers: [MotoboyService, MotoboyGateway],
  exports: [MotoboyService],
})
export class MotoboyModule {}
