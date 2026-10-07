import { Controller, Post, Get, Body, Query, Res, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Post('logout')
  logout() {
    return this.authService.logout();
  }

  @Get('microsoft')
  getMicrosoftAuthUrl() {
    return this.authService.getMicrosoftAuthUrl();
  }

  @Get('microsoft/callback')
  handleMicrosoftCallback(@Query('code') code: string) {
    return this.authService.handleMicrosoftCallback(code);
  }

  @Post('activate')
  activateAccount(@Body('token') token: string, @Body('password') password: string) {
    return this.authService.activateAccount(token, password);
  }

  @Post('password/forgot')
  forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('password/reset')
  resetPassword(@Body('token') token: string, @Body('password') password: string) {
    return this.authService.resetPassword(token, password);
  }
}
