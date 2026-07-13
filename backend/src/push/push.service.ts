import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushSubscription } from './push.entity';
import * as webpush from 'web-push';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private vapidConfigured = false;

  constructor(
    @InjectRepository(PushSubscription) private subRepo: Repository<PushSubscription>,
  ) {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (pub && priv) {
      webpush.setVapidDetails('mailto:admin@shawarma.com', pub, priv);
      this.vapidConfigured = true;
      this.logger.log('Web Push configurado com VAPID');
    } else {
      this.logger.warn('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY não configurados — push desabilitado');
    }
  }

  async subscribe(lojaId: string, dto: { endpoint: string; p256dh: string; auth: string; userAgent?: string }) {
    await this.subRepo
      .createQueryBuilder()
      .insert()
      .values({ loja_id: lojaId, endpoint: dto.endpoint, p256dh: dto.p256dh, auth: dto.auth, user_agent: dto.userAgent })
      .orUpdate(['p256dh', 'auth', 'user_agent'], ['loja_id', 'endpoint'])
      .execute();
  }

  async unsubscribe(lojaId: string, endpoint: string) {
    await this.subRepo.delete({ loja_id: lojaId, endpoint });
  }

  async enviarParaLoja(lojaId: string, payload: object) {
    if (!this.vapidConfigured) return;
    const subs = await this.subRepo.find({ where: { loja_id: lojaId } });
    const msg = JSON.stringify(payload);
    await Promise.all(
      subs.map(s =>
        webpush
          .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, msg)
          .catch(async e => {
            if (e.statusCode === 410 || e.statusCode === 404) {
              await this.subRepo.delete({ id: s.id });
            } else {
              this.logger.warn(`Push falhou para ${s.id}: ${e.message}`);
            }
          }),
      ),
    );
  }
}
