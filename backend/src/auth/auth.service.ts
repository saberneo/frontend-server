import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { TokenBlacklistService } from './token-blacklist.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private blacklist: TokenBlacklistService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    await this.usersService.updateLastLogin(user.id);
    const { passwordHash: _, ...result } = user;
    return result;
  }

  signToken(user: any) {
    const jti = randomUUID();
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId ?? null,
      jti,
    };
    return { token: this.jwtService.sign(payload), jti };
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    const { token } = this.signToken(user);
    return {
      access_token: token,
      user,
      totpRequired: user.totpEnabled === true,
    };
  }

  /** Revoke a JWT by its jti claim. */
  logout(jti: string) {
    if (jti) this.blacklist.revoke(jti);
  }

  // ── TOTP / 2FA ───────────────────────────────────────────────────────────────

  async setupTotp(userId: string): Promise<{ qrCodeUrl: string; manualKey: string }> {
    const secret = speakeasy.generateSecret({ name: `NEXUS (${userId})`, length: 20 });
    // Store the base32 secret (not yet enabled — only enabled after verify)
    await this.usersService.update(userId, { totpSecret: secret.base32 } as any);
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);
    return { qrCodeUrl, manualKey: secret.base32 };
  }

  async verifyTotp(userId: string, code: string): Promise<{ enabled: boolean }> {
    const user = await this.usersService.findWithTotp(userId);
    if (!user?.totpSecret) throw new UnauthorizedException('TOTP not set up');
    const verified = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
    if (!verified) throw new UnauthorizedException('Invalid TOTP code');
    await this.usersService.update(userId, { totpEnabled: true } as any);
    return { enabled: true };
  }

  async disableTotp(userId: string): Promise<{ disabled: boolean }> {
    await this.usersService.update(userId, { totpEnabled: false, totpSecret: null } as any);
    return { disabled: true };
  }

  /** Validate a TOTP code on login (does NOT enable 2FA — just checks the code is correct). */
  async validateTotpCode(userId: string, code: string): Promise<boolean> {
    const user = await this.usersService.findWithTotp(userId);
    if (!user?.totpSecret) return false;
    return speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    if (user) {
      console.log(`[Auth] Password reset requested for ${email}`);
    }
    return { message: 'If that address is registered you will receive a reset link shortly.' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.usersService.findWithTotp(userId); // findWithTotp returns full user incl. passwordHash
    if (!user) throw new UnauthorizedException('User not found');
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    if (newPassword.length < 8) throw new BadRequestException('New password must be at least 8 characters');
    const newHash = await bcrypt.hash(newPassword, 12);
    await this.usersService.update(userId, { passwordHash: newHash } as any);
    return { message: 'Password changed successfully' };
  }
}
