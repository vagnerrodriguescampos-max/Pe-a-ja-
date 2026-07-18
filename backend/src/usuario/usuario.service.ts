import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../auth/usuario.entity';
import { AtualizarUsuarioDto, CriarUsuarioDto } from './dto/usuario.dto';

const CAMPOS_PUBLICOS = ['id', 'nome', 'email', 'papel', 'ativo', 'criado_em'] as const;

@Injectable()
export class UsuarioService {
  constructor(
    @InjectRepository(Usuario) private usuarioRepo: Repository<Usuario>,
  ) {}

  async listar(lojaId: string) {
    return this.usuarioRepo.find({
      where: { loja_id: lojaId },
      select: [...CAMPOS_PUBLICOS],
      order: { criado_em: 'ASC' },
    });
  }

  async criar(lojaId: string, dto: CriarUsuarioDto) {
    const email = dto.email.trim().toLowerCase();

    // Email é a chave de login e não é isolado por loja, então exige-se unicidade global.
    const existe = await this.usuarioRepo.findOne({ where: { email } });
    if (existe) throw new ConflictException('Este e-mail já está em uso');

    const usuario = this.usuarioRepo.create({
      loja_id: lojaId,
      nome: dto.nome.trim(),
      email,
      senha_hash: await bcrypt.hash(dto.senha, 10),
      papel: dto.papel,
      ativo: true,
    });
    const salvo = await this.usuarioRepo.save(usuario);
    return this.semSenha(salvo);
  }

  async atualizar(lojaId: string, usuarioLogadoId: string, id: string, dto: AtualizarUsuarioDto) {
    const usuario = await this.buscarDaLoja(lojaId, id);
    const editandoASiMesmo = id === usuarioLogadoId;

    // Proteções anti-lockout: o admin não pode se rebaixar nem se desativar.
    if (editandoASiMesmo && dto.papel && dto.papel !== 'admin_loja') {
      throw new ForbiddenException('Você não pode alterar o seu próprio perfil de administrador');
    }
    if (editandoASiMesmo && dto.ativo === false) {
      throw new ForbiddenException('Você não pode desativar a sua própria conta');
    }

    // Rebaixar/desativar o último admin ativo deixaria a loja sem acesso.
    const rebaixando = dto.papel && dto.papel !== 'admin_loja' && usuario.papel === 'admin_loja';
    const desativando = dto.ativo === false && usuario.ativo && usuario.papel === 'admin_loja';
    if ((rebaixando || desativando) && (await this.contarAdminsAtivos(lojaId, id)) === 0) {
      throw new BadRequestException('A loja precisa de pelo menos um administrador ativo');
    }

    if (dto.nome !== undefined) usuario.nome = dto.nome.trim();
    if (dto.papel !== undefined) usuario.papel = dto.papel;
    if (dto.ativo !== undefined) usuario.ativo = dto.ativo;
    if (dto.senha) usuario.senha_hash = await bcrypt.hash(dto.senha, 10);

    const salvo = await this.usuarioRepo.save(usuario);
    return this.semSenha(salvo);
  }

  async remover(lojaId: string, usuarioLogadoId: string, id: string) {
    const usuario = await this.buscarDaLoja(lojaId, id);

    if (id === usuarioLogadoId) {
      throw new ForbiddenException('Você não pode remover a sua própria conta');
    }
    if (usuario.papel === 'admin_loja' && (await this.contarAdminsAtivos(lojaId, id)) === 0) {
      throw new BadRequestException('A loja precisa de pelo menos um administrador ativo');
    }

    await this.usuarioRepo.delete({ id, loja_id: lojaId });
    return { id, removido: true };
  }

  private async buscarDaLoja(lojaId: string, id: string): Promise<Usuario> {
    const usuario = await this.usuarioRepo.findOne({ where: { id, loja_id: lojaId } });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');
    return usuario;
  }

  // Conta admins ativos da loja, ignorando o usuário que está sendo alterado.
  private contarAdminsAtivos(lojaId: string, ignorarId: string): Promise<number> {
    return this.usuarioRepo.count({
      where: { loja_id: lojaId, papel: 'admin_loja', ativo: true, id: Not(ignorarId) },
    });
  }

  private semSenha(usuario: Usuario) {
    const { senha_hash, loja_id, ...publico } = usuario;
    return publico;
  }
}
