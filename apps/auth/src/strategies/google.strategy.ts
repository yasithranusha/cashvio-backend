import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigType } from '@nestjs/config';
import { AuthService } from '../auth.service';
import googleOauthConfig from '../config/google-oauth.config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(googleOauthConfig.KEY)
    private readonly googleConfig: ConfigType<typeof googleOauthConfig>,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: googleConfig.clientID,
      clientSecret: googleConfig.clientSecret,
      callbackURL: googleConfig.callbackURL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    try {
      if (!profile?.emails?.[0]?.value) {
        throw new Error('No email found in Google profile');
      }

      const user = await this.authService.validateGoogleUser({
        email: profile.emails[0].value,
        name: profile.displayName,
        profileImage: profile.photos?.[0]?.value,
      });

      done(null, user);
    } catch (error) {
      done(error, null);
    }
  }
}
