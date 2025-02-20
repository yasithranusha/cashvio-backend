import { Controller, Logger } from '@nestjs/common';
import { MailerService } from './mailer.service';
import {
  Ctx,
  EventPattern,
  Payload,
  RmqContext,
  RpcException,
} from '@nestjs/microservices';
import { RmqService } from '@app/common';
import { SendMailDto } from './dto/sendmail.dto';

@Controller()
export class MailerController {
  private readonly logger = new Logger(MailerController.name);
  constructor(
    private readonly mailerService: MailerService,
    private readonly rmqService: RmqService,
  ) {}

  // @EventPattern('shop_created')
  // async handleShopCreated(@Payload() data: any, @Ctx() context: RmqContext) {
  //   await this.mailerService.sendShopCreatedEmail(data.shop);
  //   this.rmqService.ack(context);
  // }

  @EventPattern('send_email')
  async handleSendEmail(
    @Payload() data: SendMailDto,
    @Ctx() context: RmqContext,
  ) {
    try {
      await this.mailerService.sendEmail(data);
      this.rmqService.ack(context);
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      // The message is acknowledged even on error
      this.rmqService.ack(context);
      throw new RpcException(error.message);
    }
  }
}
