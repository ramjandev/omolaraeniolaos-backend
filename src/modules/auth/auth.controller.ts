import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto, NotificationPreferencesDto, UpdateProfileDto } from './dto/account-settings.dto';
import { AuthResponseDto, TokenResponseDto } from './dto/auth-response.dto';
import { RegisterOrganizerIndividualDto } from './dto/register-organizer-individual.dto';
import { RegisterOrganizerAgencyDto } from './dto/register-organizer-agency.dto';
import { RegisterOrganizerVenueDto } from './dto/register-organizer-venue.dto';
import { PayPlanDto } from './dto/pay-plan.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUserDto } from '../../common/dto/current-user.dto';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('00 Public / Authentication')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('register/individual')
  @ResponseMessage('Individual organizer registered successfully')
  @ApiOperation({
    summary:
      'Multi-step registration for Individual Organizer with profile and plan selection (payment skippable)',
  })
  @ApiBody({ type: RegisterOrganizerIndividualDto })
  @ApiResponse({ status: 201, description: 'Individual organizer created and logged in' })
  async registerIndividual(@Body() dto: RegisterOrganizerIndividualDto) {
    return this.authService.registerIndividual(dto);
  }

  @Post('register/agency')
  @ResponseMessage('Agency organizer registered successfully')
  @ApiOperation({
    summary:
      'Multi-step registration for Agency Organizer with agency profile and plan selection (payment skippable)',
  })
  @ApiBody({ type: RegisterOrganizerAgencyDto })
  @ApiResponse({ status: 201, description: 'Agency organizer created and logged in' })
  async registerAgency(@Body() dto: RegisterOrganizerAgencyDto) {
    return this.authService.registerAgency(dto);
  }

  @Post('register/venue')
  @ResponseMessage('Venue organizer registered successfully')
  @ApiOperation({
    summary:
      'Multi-step registration for Venue Organizer with venue profile and plan selection (payment skippable)',
  })
  @ApiBody({ type: RegisterOrganizerVenueDto })
  @ApiResponse({ status: 201, description: 'Venue organizer created and logged in' })
  async registerVenue(@Body() dto: RegisterOrganizerVenueDto) {
    return this.authService.registerVenue(dto);
  }

  @Post('plan/pay')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ResponseMessage('Plan payment initiated successfully')
  @ApiOperation({
    summary:
      'Initiate Flutterwave payment for chosen plan anytime after login (if skipped during registration)',
  })
  @ApiBody({ type: PayPlanDto })
  @ApiResponse({ status: 200, description: 'Flutterwave checkout link and reference generated' })
  async payPlan(@CurrentUser() user: CurrentUserDto, @Body() dto: PayPlanDto) {
    return this.authService.payPlan(user.id, dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('User logged in successfully')
  @ApiOperation({ summary: 'Authenticate user and retrieve access + refresh tokens' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Authenticated successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Access token refreshed successfully')
  @ApiOperation({
    summary:
      'Obtain a new short-lived access token using a valid 7-day refresh token',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully',
    type: TokenResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token is expired or invalid',
  })
  async refreshToken(@Body() dto: RefreshTokenDto): Promise<TokenResponseDto> {
    return this.authService.refreshToken(dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(
    'If an account with that email exists, password reset instructions have been sent via email',
  )
  @ApiOperation({
    summary:
      'Request a time-limited (1h) password reset link sent via Resend email service',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Reset request processed and email dispatched',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(
    'Password has been reset successfully. You may now log in with your new password.',
  )
  @ApiOperation({
    summary:
      'Validate time-limited reset token and update account password',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset and updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired password reset token',
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ResponseMessage('User profile retrieved successfully')
  @ApiOperation({
    summary:
      'Retrieve currently authenticated user session and role profile',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser() user: CurrentUserDto) {
    return this.authService.getProfile(user.id);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ResponseMessage('Profile updated successfully')
  @ApiOperation({ summary: 'Update the signed-in account name, email, phone, and photo' })
  @ApiBody({ type: UpdateProfileDto })
  async updateProfile(@CurrentUser() user: CurrentUserDto, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, dto);
  }

  @Get('settings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ResponseMessage('Account settings retrieved')
  @ApiOperation({ summary: 'Notification preferences and email verification for the signed-in account' })
  async accountSettings(@CurrentUser() user: CurrentUserDto) {
    return this.authService.getAccountSettings(user.id);
  }

  @Put('notification-preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ResponseMessage('Notification preferences saved')
  @ApiOperation({ summary: 'Save RSVP, reminder, event, and billing notification choices' })
  @ApiBody({ type: NotificationPreferencesDto })
  async saveNotifications(
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: NotificationPreferencesDto,
  ) {
    return this.authService.saveNotificationPreferences(user.id, dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ResponseMessage('Password changed successfully')
  @ApiOperation({ summary: 'Change the signed-in account password and keep this browser signed in' })
  @ApiBody({ type: ChangePasswordDto })
  async changePassword(@CurrentUser() user: CurrentUserDto, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @Post('logout-other-devices')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ResponseMessage('Other devices have been logged out')
  @ApiOperation({ summary: 'End every other signed-in session for this account' })
  async logoutOtherDevices(@CurrentUser() user: CurrentUserDto) {
    return this.authService.logoutOtherDevices(user.id);
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ResponseMessage('Account deleted')
  @ApiOperation({ summary: 'Permanently delete the signed-in account and its events' })
  async deleteAccount(@CurrentUser() user: CurrentUserDto) {
    return this.authService.deleteAccount(user.id);
  }
}
