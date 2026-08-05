import { Body, Controller, Get, Param, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto, RegistrarDto } from './dto/auth.dto';

@Controller('auth')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class AuthController {
  constructor(private authService: AuthService) {}

  // Limite estrito: dificulta força bruta de senha por IP.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.senha);
  }

  @Get('verificar-slug/:slug')
  verificarSlug(@Param('slug') slug: string) {
    return this.authService.verificarSlug(slug);
  }

  @Post('registrar')
  registrar(@Body() body: RegistrarDto) {
    return this.authService.registrar(body);
  }
}
