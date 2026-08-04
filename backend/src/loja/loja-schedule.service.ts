import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HorarioDia, Loja } from './loja.entity';

const DIAS_SEMANA: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

// Abre e fecha a loja sozinha conforme o horário configurado, no fuso do Brasil.
// Só mexe em lojas com horario_automatico ligado — o botão manual continua livre nas demais.
@Injectable()
export class LojaScheduleService {
  private readonly logger = new Logger(LojaScheduleService.name);

  constructor(@InjectRepository(Loja) private lojaRepo: Repository<Loja>) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async aplicarHorariosAutomaticos() {
    const lojas = await this.lojaRepo.find({ where: { horario_automatico: true } });
    if (!lojas.length) return;

    const { diaSemana, minutos } = this.agoraNoBrasil();
    for (const loja of lojas) {
      const deveEstarAberta = this.calcularAberta(loja.horarios, diaSemana, minutos);
      if (deveEstarAberta !== null && deveEstarAberta !== loja.aberta) {
        await this.lojaRepo.update(loja.id, { aberta: deveEstarAberta });
      }
    }
  }

  private agoraNoBrasil(): { diaSemana: number; minutos: number } {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());

    const diaSemana = DIAS_SEMANA[partes.find(p => p.type === 'weekday')?.value || 'Sun'];
    const hora = Number(partes.find(p => p.type === 'hour')?.value || 0);
    const minuto = Number(partes.find(p => p.type === 'minute')?.value || 0);
    return { diaSemana, minutos: hora * 60 + minuto };
  }

  private calcularAberta(horarios: HorarioDia[] | null, diaSemana: number, minutosAgora: number): boolean | null {
    if (!Array.isArray(horarios)) return null;
    const config = horarios.find(h => h.dia_semana === diaSemana);
    if (!config || config.fechado) return false;

    const abre = this.paraMinutos(config.abre);
    const fecha = this.paraMinutos(config.fecha);
    if (abre === null || fecha === null) return null;

    if (fecha <= abre) return minutosAgora >= abre || minutosAgora < fecha;
    return minutosAgora >= abre && minutosAgora < fecha;
  }

  private paraMinutos(hhmm: string): number | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }
}
