import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { SendMailDto, RecipientDto } from './dto/sendmail.dto';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly configService: ConfigService) {}

  private async mailTransport() {
    const oAuth2Client = new google.auth.OAuth2(
      this.configService.get<string>('OAUTH_CLIENT_ID'),
      this.configService.get<string>('OAUTH_CLIENT_SECRET'),
      'https://developers.google.com/oauthplayground',
    );

    oAuth2Client.setCredentials({
      refresh_token: this.configService.get<string>('OAUTH_REFRESH_TOKEN'),
    });

    try {
      const accessToken = await oAuth2Client.getAccessToken();

      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: this.configService.get<string>('MAILER_EMAIL'),
          clientId: this.configService.get<string>('OAUTH_CLIENT_ID'),
          clientSecret: this.configService.get<string>('OAUTH_CLIENT_SECRET'),
          refreshToken: this.configService.get<string>('OAUTH_REFRESH_TOKEN'),
          accessToken: accessToken.token,
        },
      });
    } catch (error) {
      this.logger.error('Failed to create mail transport:', error);
      throw error;
    }
  }

  private template(html: string, variables: Record<string, string>) {
    return html.replace(/%(\w*)%/g, (m, key) =>
      variables.hasOwnProperty(key) ? variables[key] : '',
    );
  }

  async sendEmail(dto: SendMailDto) {
    const { from, recipients, subject, text, html } = dto;

    try {
      const transporter = await this.mailTransport();

      const results = await Promise.all(
        recipients.map(async (recipient: RecipientDto) => {
          const personalizedHtml = recipient.variables
            ? this.template(html, recipient.variables)
            : html;

          const mailOptions = {
            from: from || this.configService.get<string>('MAILER_EMAIL'),
            to: recipient.address,
            subject,
            text,
            html: personalizedHtml,
          };

          try {
            const result = await transporter.sendMail(mailOptions);
            this.logger.log(`Email sent successfully to ${recipient.address}`);
            return result;
          } catch (error) {
            this.logger.error(
              `Failed to send email to ${recipient.address}:`,
              error,
            );
            throw error;
          }
        }),
      );

      return results;
    } catch (error) {
      this.logger.error('Email sending failed:', error);
      throw error;
    }
  }
}
