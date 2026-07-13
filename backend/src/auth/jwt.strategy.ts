import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { Usuario } from './usuario.entity';
import { getJwtSecret } from './jwt.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: { sub: string; loja_id: string }) {
    const usuario = await this.usuarios.findOne({ where: { id: payload.sub, ativo: true } });
    if (!usuario || usuario.loja_id !== payload.loja_id) {
      throw new UnauthorizedException('Sessão inválida');
    }

    return {
      id: usuario.id,
      email: usuario.email,
      loja_id: usuario.loja_id,
      papel: usuario.papel,
    };
  }
}
