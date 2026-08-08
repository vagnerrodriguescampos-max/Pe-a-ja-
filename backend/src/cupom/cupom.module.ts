import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cupom, CupomUso } from './cupom.entity';
import { Cliente } from '../pedido/cliente.entity';
import { Pedido } from '../pedido/pedido.entity';
import { CupomService } from './cupom.service';
import { CupomAdminController, CupomPublicoController } from './cupom.controller';
import { LojaModule } from '../loja/loja.module';

@Module({
  imports: [TypeOrmModule.forFeature([Cupom, CupomUso, Cliente, Pedido]), LojaModule],
  controllers: [CupomAdminController, CupomPublicoController],
  providers: [CupomService],
  // Exportado para o PedidoModule aplicar o cupom dentro da transação do pedido.
  exports: [CupomService],
})
export class CupomModule {}
