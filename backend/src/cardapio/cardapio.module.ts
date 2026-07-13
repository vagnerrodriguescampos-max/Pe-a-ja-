import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Categoria } from './categoria/categoria.entity';
import { Produto } from './produto/produto.entity';
import { GrupoOpcao } from './grupo-opcao/grupo-opcao.entity';
import { Opcao } from './grupo-opcao/opcao.entity';
import { CardapioService } from './cardapio.service';
import { CardapioAdminController, CardapioPublicoController } from './cardapio.controller';
import { LojaModule } from '../loja/loja.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Categoria, Produto, GrupoOpcao, Opcao]),
    LojaModule,
  ],
  providers: [CardapioService],
  controllers: [CardapioPublicoController, CardapioAdminController],
  exports: [CardapioService],
})
export class CardapioModule {}
