import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { Usuario } from './usuario.entity';
import { Loja } from '../loja/loja.entity';

describe('AuthService', () => {
  let authService: AuthService;
  let usuarioRepo: { findOne: jest.Mock };
  let lojaRepo: { findOne: jest.Mock };
  let jwtService: { sign: jest.Mock };

  beforeEach(() => {
    usuarioRepo = { findOne: jest.fn() };
    lojaRepo = { findOne: jest.fn() };
    jwtService = { sign: jest.fn().mockReturnValue('token-assinado') };

    authService = new AuthService(
      usuarioRepo as any,
      lojaRepo as any,
      jwtService as unknown as JwtService,
      {} as any,
    );
  });

  describe('login', () => {
    it('rejeita quando o usuário não existe ou está inativo', async () => {
      usuarioRepo.findOne.mockResolvedValue(null);

      await expect(authService.login('naoexiste@x.com', 'qualquer')).rejects.toThrow(UnauthorizedException);
      expect(usuarioRepo.findOne).toHaveBeenCalledWith({ where: { email: 'naoexiste@x.com', ativo: true } });
    });

    it('rejeita quando a senha está incorreta', async () => {
      const senhaHash = await bcrypt.hash('senha_correta', 10);
      usuarioRepo.findOne.mockResolvedValue({
        id: 'u1', email: 'admin@loja.com', senha_hash: senhaHash, loja_id: 'l1', papel: 'admin_loja',
      } as Usuario);

      await expect(authService.login('admin@loja.com', 'senha_errada')).rejects.toThrow(UnauthorizedException);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('retorna access_token e dados do usuário quando as credenciais são válidas', async () => {
      const senhaHash = await bcrypt.hash('senha_correta', 10);
      usuarioRepo.findOne.mockResolvedValue({
        id: 'u1', nome: 'Admin', email: 'admin@loja.com', senha_hash: senhaHash, loja_id: 'l1', papel: 'admin_loja',
      } as Usuario);

      const resultado = await authService.login('admin@loja.com', 'senha_correta');

      expect(resultado.access_token).toBe('token-assinado');
      expect(resultado.usuario).toEqual({
        id: 'u1', nome: 'Admin', email: 'admin@loja.com', papel: 'admin_loja', loja_id: 'l1',
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'u1', email: 'admin@loja.com', loja_id: 'l1', papel: 'admin_loja',
      });
    });
  });

  describe('registrar', () => {
    it('rejeita slug inválido', async () => {
      await expect(authService.registrar({
        nome_loja: 'Loja', slug: 'AB', nome_admin: 'Admin', email: 'a@a.com', senha: '123456',
      })).rejects.toThrow('Slug inválido');
    });

    it('rejeita quando o slug já existe', async () => {
      lojaRepo.findOne.mockResolvedValue({ id: 'existe' } as Loja);

      await expect(authService.registrar({
        nome_loja: 'Loja', slug: 'slug-valido', nome_admin: 'Admin', email: 'a@a.com', senha: '123456',
      })).rejects.toThrow('já está sendo usado');
    });

    it('rejeita quando o e-mail já existe', async () => {
      lojaRepo.findOne.mockResolvedValue(null);
      usuarioRepo.findOne.mockResolvedValue({ id: 'existe' } as Usuario);

      await expect(authService.registrar({
        nome_loja: 'Loja', slug: 'slug-valido', nome_admin: 'Admin', email: 'a@a.com', senha: '123456',
      })).rejects.toThrow('já está cadastrado');
    });
  });
});
