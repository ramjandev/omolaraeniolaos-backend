import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateClientDto {
  @ApiProperty({ example: 'Zenith Global Media' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Oak & Ivory', required: false })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiProperty({ example: 'Folake Adeyemi', required: false })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiProperty({ example: 'folake@zenithmedia.com' })
  @IsEmail()
  contactEmail: string;

  @ApiProperty({ example: '+234 803 111 2233', required: false })
  @IsString()
  @IsOptional()
  contactPhone?: string;

  @ApiProperty({ example: 4500000, default: 0, type: Number, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  contractTotal?: number;

  @ApiProperty({ example: 'NGN', default: 'NGN' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateClientDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
