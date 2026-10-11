import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'organizer@innosight.com', description: 'User email address', type: String })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePassword123!', description: 'Account password (minimum 8 characters)', type: String })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Omolara Eniola', description: 'Full legal name or display name', type: String })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '+234 801 234 5678', required: false, type: String })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    enum: UserRole,
    example: UserRole.ORGANIZER_INDIVIDUAL,
    description: 'Initial role in platform',
  })
  @IsEnum(UserRole)
  role: UserRole;
}
