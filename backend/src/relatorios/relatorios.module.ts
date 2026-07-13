import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pedido } from '../pedido/pedido.entity';
import { Cliente } from '../pedido/cliente.entity';
import { RelatoriosService } from './relatorios.service';
import { RelatoriosController, ClientesController } from './relatorios.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Pedido, Cliente])],
  controllers: [RelatoriosController, ClientesController],
  providers: [RelatoriosService],
})
export class RelatoriosModule {}
