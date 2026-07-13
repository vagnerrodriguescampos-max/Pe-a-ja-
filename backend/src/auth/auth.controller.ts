import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() body: { email: string; senha: string }) {
    return this.authService.login(body.email, body.senha);
  }

  @Get('verificar-slug/:slug')
  verificarSlug(@Param('slug') slug: string) {
    return this.authService.verificarSlug(slug);
  }

  @Post('registrar')
  registrar(@Body() body: { nome_loja: string; slug: string; nome_admin: string; email: string; senha: string }) {
    return this.authService.registrar(body);
  }
}
