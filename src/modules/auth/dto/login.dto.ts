import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class LoginDto {
  @ApiProperty({
    example: "admin@mceniesvite.com",
    description: "User account email",
    type: String,
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: "Password123!",
    description: "Account password",
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
