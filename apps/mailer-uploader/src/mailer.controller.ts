import { Controller, Logger } from '@nestjs/common';
import { MailerService } from './mailer.service';
import {
  Ctx,
  EventPattern,
  MessagePattern,
  Payload,
  RmqContext,
  RpcException,
} from '@nestjs/microservices';
import { RmqService } from '@app/common';
import { SendMailDto } from './dto/sendmail.dto';
import { UploaderService } from './uploader/uploader.service';

@Controller()
export class MailerController {
  private readonly logger = new Logger(MailerController.name);
  constructor(
    private readonly mailerService: MailerService,
    private readonly uploaderService: UploaderService,
    private readonly rmqService: RmqService,
  ) {}

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
      this.rmqService.ack(context);
      throw new RpcException(error.message);
    }
  }

  @MessagePattern('upload_file_url')
  async handleS3UploadFromUrl(
    @Payload() data: { url: string; folder: string; subFolder?: string },
    @Ctx() context: RmqContext,
  ) {
    try {
      // Implementation for uploading from URL
      // This would require downloading the file first then uploading
      this.rmqService.ack(context);
    } catch (error) {
      this.logger.error('Failed to upload from URL:', error);
      this.rmqService.ack(context);
      throw new RpcException(error.message);
    }
  }
}
