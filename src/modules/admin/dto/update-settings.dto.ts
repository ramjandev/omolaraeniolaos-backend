import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsObject, IsBoolean, IsString } from 'class-validator';

export class FeatureFlagsDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  voiceRsvp?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  offlineCheckIn?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  multilingualDispatch?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  seatingCoordinator?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  aiFollowUpMessages?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  securityFraudAlerts?: boolean;
}

export class SupportedLanguagesDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  english?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  yoruba?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  igbo?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  hausa?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  pidgin?: boolean;
}

export class DefaultPlanSettingsDto {
  @ApiPropertyOptional({ example: 'Per-event' })
  @IsOptional()
  @IsString()
  defaultBillingCycle?: string;

  @ApiPropertyOptional({ example: 'NGN (₦)' })
  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @ApiPropertyOptional({ example: 'None' })
  @IsOptional()
  @IsString()
  trialPeriod?: string;

  @ApiPropertyOptional({ example: 'billing@mcenies.ng' })
  @IsOptional()
  @IsString()
  invoiceEmail?: string;
}

export class PaymentSettingsDto {
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  liveMode?: boolean;

  @ApiPropertyOptional({ example: 'FLWPUBK_TEST-...' })
  @IsOptional()
  @IsString()
  publicKey?: string;
}

export class WhatsappSettingsDto {
  @ApiPropertyOptional({ example: '1293112117228335' })
  @IsOptional()
  @IsString()
  phoneNumberId?: string;

  @ApiPropertyOptional({ example: '1640396534394666' })
  @IsOptional()
  @IsString()
  wabaId?: string;

  @ApiPropertyOptional({ example: 'https://api.mcenies.ng/webhook/whatsapp' })
  @IsOptional()
  @IsString()
  webhookUrl?: string;
}

export class UpdatePlatformSettingsDto {
  @ApiPropertyOptional({ type: FeatureFlagsDto })
  @IsOptional()
  @IsObject()
  featureFlags?: FeatureFlagsDto;

  @ApiPropertyOptional({ type: SupportedLanguagesDto })
  @IsOptional()
  @IsObject()
  supportedLanguages?: SupportedLanguagesDto;

  @ApiPropertyOptional({ type: DefaultPlanSettingsDto })
  @IsOptional()
  @IsObject()
  defaultPlanSettings?: DefaultPlanSettingsDto;

  @ApiPropertyOptional({ type: PaymentSettingsDto })
  @IsOptional()
  @IsObject()
  paymentGateway?: PaymentSettingsDto;

  @ApiPropertyOptional({ type: WhatsappSettingsDto })
  @IsOptional()
  @IsObject()
  whatsapp?: WhatsappSettingsDto;
}
