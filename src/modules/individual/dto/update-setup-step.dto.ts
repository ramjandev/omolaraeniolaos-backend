import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateSetupStepDto {
  @ApiProperty({
    example: 2,
    description: 'Step ID (1 to 6) in the individual event setup checklist',
  })
  @IsNumber()
  @IsNotEmpty()
  stepId: number;

  @ApiProperty({
    example: true,
    description: 'Completion status of the individual event setup step',
  })
  @IsBoolean()
  @IsNotEmpty()
  completed: boolean;

  @ApiProperty({
    example: 'details',
    required: false,
    description: 'Optional step key slug (basics, details, guests, invitation, experience, seating)',
  })
  @IsString()
  @IsOptional()
  stepKey?: string;
}
