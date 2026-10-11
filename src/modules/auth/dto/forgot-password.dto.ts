import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'organizer@mceniesvite.com',
    description: 'Registered user account email',
    type: String,
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
