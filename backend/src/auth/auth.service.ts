import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Usuario } from './usuario.entity';
import { Loja } from '../loja/loja.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private usuarioRepo: Repository<Usuario>,
    @InjectRepository(Loja) private lojaRepo: Repository<Loja>,
    private jwtService: JwtService,
    private dataSource: DataSource,
  ) {}

  async verificarSlug(slug: string): Promise<{ disponivel: boolean }> {
    const existe = await this.lojaRepo.findOne({ where: { slug } });
    return { disponivel: !existe };
  }

  async registrar(body: {
    nome_loja: string;
    slug: string;
    nome_admin: string;
    email: string;
    senha: string;
  }) {
    if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(body.slug)) {
      throw new BadRequestException('Slug inválido: use apenas letras minúsculas, números e hífens (mín. 3 caracteres)');
    }

    const slugExiste = await this.lojaRepo.findOne({ where: { slug: body.slug } });
    if (slugExiste) throw new ConflictException('Este link já está sendo usado por outro restaurante');

    const emailExiste = await this.usuarioRepo.findOne({ where: { email: body.email } });
    if (emailExiste) throw new ConflictException('Este e-mail já está cadastrado');

    return this.dataSource.transaction(async manager => {
      const loja = manager.create(Loja, {
        nome: body.nome_loja,
        slug: body.slug,
        cor_primaria: '#E63946',
        aberta: false,
        prazo_medio_min: 30,
        taxa_entrega_padrao: 5.00,
        pedido_minimo: 0,
        mensagem_topo: `Bem-vindo ao ${body.nome_loja}!`,
      });
      await manager.save(loja);

      const senhaHash = await bcrypt.hash(body.senha, 10);
      const usuario = manager.create(Usuario, {
        loja_id: loja.id,
        nome: body.nome_admin,
        email: body.email,
        senha_hash: senhaHash,
        papel: 'admin_loja',
        ativo: true,
      });
      await manager.save(usuario);

      const payload = { sub: usuario.id, email: usuario.email, loja_id: loja.id, papel: usuario.papel };
      return {
        access_token: this.jwtService.sign(payload),
        usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel, loja_id: loja.id },
        loja: { id: loja.id, nome: loja.nome, slug: loja.slug },
      };
    });
  }

  async login(email: string, senha: string) {
    const usuario = await this.usuarioRepo.findOne({ where: { email, ativo: true } });
    if (!usuario) throw new UnauthorizedException('Credenciais inválidas');

    const senhaOk = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaOk) throw new UnauthorizedException('Credenciais inválidas');

    const payload = {
      sub: usuario.id,
      email: usuario.email,
      loja_id: usuario.loja_id,
      papel: usuario.papel,
    };

    return {
      access_token: this.jwtService.sign(payload),
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel,
        loja_id: usuario.loja_id,
      },
    };
  }
}
