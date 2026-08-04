import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Loja } from './loja.entity';
import { LojaService } from './loja.service';
import { LojaController } from './loja.controller';
import { LojaScheduleService } from './loja-schedule.service';

@Module({
  imports: [TypeOrmModule.forFeature([Loja])],
  providers: [LojaService, LojaScheduleService],
  controllers: [LojaController],
  exports: [LojaService],
})
export class LojaModule {}
