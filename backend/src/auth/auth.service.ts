import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(dto: LoginDto) {
    // Return access token and mock refresh token
    return {
      accessToken: 'sample.jwt.access_token',
      user: {
        id: 'user-uuid',
        email: dto.email,
        role: 'manager',
      },
    };
  }

  async refresh(refreshToken: string) {
    return {
      accessToken: 'new.jwt.access_token',
    };
  }

  async logout() {
    return { success: true };
  }

  async getMicrosoftAuthUrl() {
    return {
      url: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=DEMO&response_type=code',
    };
  }

  async handleMicrosoftCallback(code: string) {
    return {
      accessToken: 'microsoft.jwt.access_token',
    };
  }

  async activateAccount(token: string, password: string) {
    return { success: true, message: 'Compte activé avec succès' };
  }

  async forgotPassword(email: string) {
    return { success: true, message: 'Si le compte existe, un email a été envoyé' };
  }

  async resetPassword(token: string, password: string) {
    return { success: true, message: 'Mot de passe réinitialisé' };
  }
}
