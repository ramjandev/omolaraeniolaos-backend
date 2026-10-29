import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class NotificationPreferencesDto {
  @ApiProperty()
  @IsBoolean()
  rsvpUpdates: boolean;

  @ApiProperty()
  @IsBoolean()
  guestReminders: boolean;

  @ApiProperty()
  @IsBoolean()
  eventUpdates: boolean;

  @ApiProperty()
  @IsBoolean()
  billingNotifications: boolean;
}

export class UpdateProfileDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  fullName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}
