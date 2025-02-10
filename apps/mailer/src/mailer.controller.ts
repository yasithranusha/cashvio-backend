import { Controller } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { RmqService } from '@app/common';

@Controller()
export class MailerController {
  constructor(
    private readonly mailerService: MailerService,
    private readonly rmqService: RmqService,
  ) {}

  @EventPattern('shop_created')
  async handleShopCreated(@Payload() data: any, @Ctx() context: RmqContext) {
    await this.mailerService.sendShopCreatedEmail(data.shop);
    this.rmqService.ack(context);
  }
}
