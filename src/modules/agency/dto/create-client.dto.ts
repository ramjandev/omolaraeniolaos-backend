import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateClientDto {
  @ApiProperty({ example: 'Zenith Global Media' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Corporate & Media' })
  @IsString()
  @IsNotEmpty()
  industry: string;

  @ApiProperty({ example: 'Folake Adeyemi' })
  @IsString()
  @IsNotEmpty()
  contactPerson: string;

  @ApiProperty({ example: 'folake@zenithmedia.com' })
  @IsEmail()
  contactEmail: string;

  @ApiProperty({ example: '+234 803 111 2233', required: false })
  @IsString()
  @IsOptional()
  contactPhone?: string;

  @ApiProperty({ example: 4500000, default: 0, type: Number })
  @IsNumber()
  @Min(0)
  contractTotal: number;

  @ApiProperty({ example: 'NGN', default: 'NGN' })
  @IsString()
  @IsOptional()
  currency?: string;
}
