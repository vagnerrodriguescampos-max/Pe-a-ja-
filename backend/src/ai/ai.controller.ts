import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentLoja } from '../auth/decorators/current-loja.decorator';

@UseGuards(JwtAuthGuard)
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
