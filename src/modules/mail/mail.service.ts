import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resendApiKey: string;
  private frontendUrl: string;

  constructor(@Optional() @Inject(ConfigService) private configService?: ConfigService) {
    this.resendApiKey =
      this.configService?.get<string>('RESEND_API_KEY') ||
      process.env.RESEND_API_KEY ||
      '';
    this.frontendUrl =
      this.configService?.get<string>('FRONTEND_URL') ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000';
  }

  private getApiKey(): string {
    return (
      this.configService?.get<string>('RESEND_API_KEY') ||
      process.env.RESEND_API_KEY ||
      this.resendApiKey ||
      ''
    );
  }

  private getBaseFrontendUrl(): string {
    return (
      this.configService?.get<string>('FRONTEND_URL') ||
      process.env.FRONTEND_URL ||
      this.frontendUrl ||
      'http://localhost:3000'
    );
  }

  private getFromEmail(): string {
    return (
      this.configService?.get<string>('RESEND_FROM_EMAIL') ||
      process.env.RESEND_FROM_EMAIL ||
      'McEniesVite Security <onboarding@resend.dev>'
    );
  }

  async sendPasswordResetEmail(
    to: string,
    resetToken: string,
    fullName: string,
  ): Promise<boolean> {
    const frontendUrl = this.getBaseFrontendUrl();
    const apiKey = this.getApiKey();
    const fromEmail = this.getFromEmail();
    const resetUrl = `${frontendUrl}/auth/reset-password?token=${resetToken}`;

    this.logger.log(`=========================================`);
    this.logger.log(`📧 PASSWORD RESET REQUEST FOR: ${to}`);
    this.logger.log(`🔗 Reset URL: ${resetUrl}`);
    this.logger.log(`🔑 Reset Token: ${resetToken}`);
    this.logger.log(`=========================================`);

    // If Resend API key is provided and not a placeholder, dispatch via Resend REST API
    if (apiKey && !apiKey.startsWith('re_xxxx') && !apiKey.startsWith('re_1234')) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [to],
            subject: 'Reset Your McEniesVite Password',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #0f172a; margin-bottom: 16px;">Password Reset Request</h2>
                <p style="color: #475569; font-size: 16px;">Hello ${fullName || 'there'},</p>
                <p style="color: #475569; font-size: 15px; line-height: 1.5;">
                  We received a request to reset your password for your McEniesVite Event OS account. Click the button below to set a new password:
                </p>
                <div style="margin: 28px 0; text-align: center;">
                  <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                    Reset Password
                  </a>
                </div>
                <p style="color: #64748b; font-size: 13px;">
                  Or copy and paste this link in your browser:<br/>
                  <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
                </p>
                <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                  This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
                </p>
              </div>
            `,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          this.logger.warn(`Resend API dispatch failed: ${errorText}. Reset token logged to console.`);
          return false;
        }

        const result = await response.json();
        this.logger.log(`Resend email sent successfully (ID: ${result.id})`);
        return true;
      } catch (err: any) {
        this.logger.error(`Error sending email via Resend: ${err.message}`);
        return false;
      }
    }

    return true;
  }

  async sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
    const apiKey = this.getApiKey();
    const fromEmail = this.getFromEmail();

    if (!apiKey || apiKey.startsWith('re_xxxx') || apiKey.startsWith('re_1234')) {
      this.logger.log(`[sandbox] Email queued for ${to}: ${subject}`);
      return { ok: false, error: 'Email provider is not configured' };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ from: fromEmail, to: [to], subject, html }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const error = this.readProviderError(errorText);
        this.logger.warn(`Resend dispatch failed: ${error}`);
        return { ok: false, error };
      }

      return { ok: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown mail error';
      this.logger.error(`Error sending email via Resend: ${message}`);
      return { ok: false, error: message };
    }
  }

  private readProviderError(raw: string) {
    try {
      const parsed = JSON.parse(raw) as { message?: string; error?: { message?: string } };
      return String(parsed?.error?.message || parsed?.message || raw).slice(0, 240);
    } catch {
      return raw.slice(0, 240);
    }
  }
}
