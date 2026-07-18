import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { PushService } from './push.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentLoja } from '../auth/decorators/current-loja.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin_loja', 'super_admin')
@Controller('admin/push')
export class PushController {
  constructor(private pushService: PushService) {}

  @Post('subscribe')
  subscribe(
    @CurrentLoja() lojaId: string,
    @Body() body: { endpoint: string; p256dh: string; auth: string; userAgent?: string },
  ) {
    return this.pushService.subscribe(lojaId, body);
  }

  @Delete('unsubscribe')
  unsubscribe(@CurrentLoja() lojaId: string, @Body() body: { endpoint: string }) {
    return this.pushService.unsubscribe(lojaId, body.endpoint);
  }

  @Get('vapid-public-key')
  getVapidPublicKey() {
    return { publicKey: process.env.VAPID_PUBLIC_KEY || '' };
  }
}
