import { Controller, Post, Get, Body, HttpCode, UseGuards, Req, Res, Query, Redirect, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { OktaService } from './okta.service';
import { UsersService } from '../users/users.service';

class LoginDto {
  @ApiProperty({ example: 'admin@nexus.io' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin1234!' })
  @IsString()
  password: string;
}

class ForgotPasswordDto {
  @ApiProperty({ example: 'user@nexus.io' })
  @IsEmail()
  email: string;
}

class ChangePasswordDto {
  @ApiProperty({ example: 'Admin1234!' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'NewSecure#567' })
  @IsString()
  @Length(8, 128)
  newPassword: string;
}

class TotpCodeDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  code: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private oktaService: OktaService,
    private usersService: UsersService,
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'Login — sets httpOnly session cookie and returns user info' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token, user, totpRequired } = await this.authService.login(dto.email, dto.password);
    res.cookie('nexus_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    });
    return { access_token, user, totpRequired };
  }

  @Post('demo-login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Instant demo access — authenticates as the read-only demo account' })
  async demoLogin(@Res({ passthrough: true }) res: Response) {
    const { access_token, user } = await this.authService.login('demo@nexus.io', 'Demo#NEXUS2026!');
    res.cookie('nexus_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000, // 2h for demo sessions
      path: '/',
    });
    return { access_token, user, totpRequired: false };
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Return current authenticated user from cookie/token' })
  me(@Req() req: Request) {
    return { user: (req as any).user };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Revoke current JWT (blacklist jti) and clear session cookie' })
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = (req as any).user;
    if (user?.jti) this.authService.logout(user.jti);
    res.clearCookie('nexus_token', { path: '/' });
    return { message: 'Logged out' };
  }

  // ── TOTP / 2FA ──────────────────────────────────────────────────────────────

  @Post('totp/setup')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Generate a TOTP secret and return QR code for the current user' })
  setupTotp(@Req() req: Request) {
    return this.authService.setupTotp((req as any).user.id);
  }

  @Post('totp/verify')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Verify TOTP code and enable 2FA for the current user' })
  verifyTotp(@Req() req: Request, @Body() dto: TotpCodeDto) {
    return this.authService.verifyTotp((req as any).user.id, dto.code);
  }

  @Post('totp/disable')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Disable 2FA for the current user' })
  disableTotp(@Req() req: Request) {
    return this.authService.disableTotp((req as any).user.id);
  }

  @Post('totp/validate')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(200)
  @ApiOperation({ summary: 'Validate a TOTP code during login (2FA step)' })
  async validateTotp(@Req() req: Request, @Body() dto: TotpCodeDto) {
    const isValid = await this.authService.validateTotpCode((req as any).user.id, dto.code);
    if (!isValid) throw new Error('Invalid TOTP code');
    return { verified: true };
  }

  // ── Forgot password ─────────────────────────────────────────────────────────────

  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Request a password reset link' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Change the current user password' })
  changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(
      (req as any).user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  // ── Okta OIDC / PKCE ────────────────────────────────────────────────────────

  @Get('okta/config')
  @ApiOperation({ summary: 'Return Okta OIDC configuration (public — no secret)' })
  oktaConfig() {
    return this.oktaService.getConfig();
  }

  @Get('okta/authorize')
  @ApiOperation({ summary: 'Start Okta PKCE flow — returns the authorization URL' })
  oktaAuthorize() {
    if (!this.oktaService.isConfigured()) {
      return { authorizationUrl: null, state: null, error: 'Okta is not configured on this server' };
    }
    return this.oktaService.getAuthorizeUrl();
  }

  @Get('okta/callback')
  @ApiOperation({ summary: 'Okta redirects here after login — JIT provisions user and issues session cookie' })
  async oktaCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Res() res: Response,
  ) {
    const postLoginRedirect = this.oktaService.getPostLoginRedirect();

    if (error) {
      this.logger.warn(`Okta returned error: ${error} — ${errorDescription}`);
      return res.redirect(`${postLoginRedirect}?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription ?? '')}`);
    }

    if (!code || !state) {
      return res.redirect(`${postLoginRedirect}?error=missing_params`);
    }

    try {
      const profile = await this.oktaService.exchangeCode(code, state);
      const user = await this.usersService.upsertFromOkta(profile);
      await this.usersService.updateLastLogin(user.id);

      const { token } = this.authService.signToken(user);

      res.cookie('nexus_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000,
        path: '/',
      });

      // Pass minimal (non-sensitive) user info + Okta access_token to Angular via base64url query param
      // The access_token is needed by the frontend to authenticate with Kong API Gateway (RS256 validation)
      const sessionUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        okta_token: profile.accessToken,
      };
      const s = Buffer.from(JSON.stringify(sessionUser)).toString('base64url');
      return res.redirect(`${postLoginRedirect}?s=${s}`);
    } catch (err: any) {
      this.logger.error(`Okta callback failed: ${err?.message}`);
      return res.redirect(`${postLoginRedirect}?error=callback_failed&error_description=${encodeURIComponent(err?.message ?? 'Unknown error')}`);
    }
  }
}
