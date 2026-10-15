import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class AuthUserDto {
  @ApiProperty({ example: 'b94e77cb-8c65-4f32-8419-724578b776be', type: String })
  id: string;

  @ApiProperty({ example: 'organizer@mceniesvite.com', type: String })
  email: string;

  @ApiProperty({ example: 'Omolara Eniola', type: String })
  fullName: string;

  @ApiProperty({ enum: UserRole, example: UserRole.INDIVIDUAL })
  role: UserRole;

  @ApiProperty({ example: 'https://images.unsplash.com/avatar.jpg', nullable: true, required: false, type: String })
  avatarUrl?: string;
}

export class AuthResponseDto {
  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Short-lived JWT Access Bearer Token (15m)',
    type: String,
  })
  accessToken: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Long-lived JWT Refresh Token (7d)',
    type: String,
  })
  refreshToken: string;
}

export class TokenResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'New short-lived JWT Access Token (15m)',
    type: String,
  })
  accessToken: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'New or rotated JWT Refresh Token (7d)',
    type: String,
  })
  refreshToken: string;
}
