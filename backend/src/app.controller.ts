import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// Usado pelo workflow de keep-alive (.github/workflows/keep-alive.yml) para evitar que o
// Render suspenda o serviço por inatividade e que o Supabase pause o banco por 7 dias sem uso.
@Controller()
export class AppController {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  @Get('health')
  async health() {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok' };
  }
}
