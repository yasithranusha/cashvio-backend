import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  async sendShopCreatedEmail(shopData: any) {
    this.logger.log(
      `Sending email for newly created shop: ${shopData.businessName}`,
    );
    //Todo Implement email sending logic here
    return true;
  }
}
