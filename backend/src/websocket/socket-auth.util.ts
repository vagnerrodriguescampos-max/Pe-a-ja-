import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

interface UsuarioAutenticado {
  sub: string;
  loja_id: string;
  papel: string;
}

// Handshake-level identity (admin/motoboy): JWT enviado em socket.handshake.auth.token.
export function usuarioAutenticado(client: Socket, jwtService: JwtService): UsuarioAutenticado | null {
  const token = client.handshake.auth?.token as string | undefined;
  if (!token) return null;
  try {
    return jwtService.verify(token);
  } catch {
    return null;
  }
}
