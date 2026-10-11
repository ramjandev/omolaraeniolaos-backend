import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'organizer@innosight.com',
    description: 'Registered user account email',
    type: String,
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
