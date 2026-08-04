import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  RawBodyRequest,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentLoja } from '../auth/decorators/current-loja.decorator';
import { ConectarWhatsappDto } from './dto/conectar-whatsapp.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin_loja', 'super_admin')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
@Controller('admin/whatsapp')
export class WhatsappAdminController {
  constructor(private whatsappService: WhatsappService) {}

  @Get('status')
  status(@CurrentLoja() lojaId: string) {
    return this.whatsappService.status(lojaId);
  }

  @Post('conectar')
  conectar(@CurrentLoja() lojaId: string, @Body() body: ConectarWhatsappDto) {
    return this.whatsappService.conectar(lojaId, body.waba_id, body.phone_number_id);
  }

  @Post('desconectar')
  desconectar(@CurrentLoja() lojaId: string) {
    return this.whatsappService.desconectar(lojaId);
  }
}

// Endpoint público exigido pela Meta: ela chama GET para validar a URL do
// webhook e POST para entregar mensagens. Nunca fica atrás de autenticação —
// a segurança aqui vem da verificação de assinatura HMAC em cada POST.
@Controller('webhook/whatsapp')
export class WhatsappWebhookController {
  constructor(private whatsappService: WhatsappService) {}

  @Get()
  verificar(@Query() query: Record<string, string>, @Res() res: Response) {
    const modo = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (modo === 'subscribe' && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send('Forbidden');
  }

  @Post()
  @HttpCode(200)
  receber(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: any,
    @Headers('x-hub-signature-256') assinatura?: string,
  ) {
    if (!this.whatsappService.assinaturaValida(req.rawBody, assinatura)) {
      throw new ForbiddenException('Assinatura inválida');
    }
    this.whatsappService.processarWebhook(body).catch(() => {});
    return { received: true };
  }
}
