import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class InviteTeamMemberDto {
  @ApiProperty({ example: 'Amina Diallo' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'amina.diallo@email.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+234 803 000 0000' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ enum: ['Admin', 'Gate Staff'] })
  @IsString()
  @IsIn(['Admin', 'Gate Staff'])
  role: 'Admin' | 'Gate Staff';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventId?: string;
}

export class AssignTeamMemberDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @ApiProperty({ enum: ['admin', 'gate'] })
  @IsString()
  @IsIn(['admin', 'gate'])
  kind: 'admin' | 'gate';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  eventId: string;
}
