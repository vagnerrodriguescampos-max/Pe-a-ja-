import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Loja } from './loja.entity';

@Injectable()
export class LojaService {
  constructor(@InjectRepository(Loja) private repo: Repository<Loja>) {}

  async findBySlug(slug: string): Promise<Loja> {
    const loja = await this.repo.findOne({ where: { slug } });
    if (!loja) throw new NotFoundException('Loja não encontrada');
    return loja;
  }

  async findById(id: string): Promise<Loja> {
    const loja = await this.repo.findOne({ where: { id } });
    if (!loja) throw new NotFoundException('Loja não encontrada');
    return loja;
  }

  async update(id: string, data: Partial<Loja>): Promise<Loja> {
    await this.repo.update(id, data);
    return this.findById(id);
  }
}
