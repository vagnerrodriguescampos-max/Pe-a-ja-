import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentLoja } from '../auth/decorators/current-loja.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin_loja', 'super_admin')
@Controller('admin/ia')
export class AiController {
  constructor(private aiService: AiService) {}

  @Get('config')
  getConfig(@CurrentLoja() lojaId: string) {
    return this.aiService.getConfig(lojaId);
  }

  @Patch('config')
  updateConfig(@CurrentLoja() lojaId: string, @Body() body: any) {
    return this.aiService.updateConfig(lojaId, body);
  }
}
