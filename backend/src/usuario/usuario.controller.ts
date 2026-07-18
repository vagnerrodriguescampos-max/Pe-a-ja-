import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { UsuarioService } from './usuario.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentLoja, CurrentUser } from '../auth/decorators/current-loja.decorator';
import { AtualizarUsuarioDto, CriarUsuarioDto } from './dto/usuario.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin_loja', 'super_admin')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
@Controller('admin/usuarios')
export class UsuarioController {
  constructor(private usuarioService: UsuarioService) {}

  @Get()
  listar(@CurrentLoja() lojaId: string) {
    return this.usuarioService.listar(lojaId);
  }

  @Post()
  criar(@CurrentLoja() lojaId: string, @Body() body: CriarUsuarioDto) {
    return this.usuarioService.criar(lojaId, body);
  }

  @Patch(':id')
  atualizar(
    @CurrentLoja() lojaId: string,
    @CurrentUser() user: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AtualizarUsuarioDto,
  ) {
    return this.usuarioService.atualizar(lojaId, user.id, id, body);
  }

  @Delete(':id')
  remover(
    @CurrentLoja() lojaId: string,
    @CurrentUser() user: any,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.usuarioService.remover(lojaId, user.id, id);
  }
}
