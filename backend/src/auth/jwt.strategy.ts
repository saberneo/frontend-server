import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { TokenBlacklistService } from './token-blacklist.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private blacklist: TokenBlacklistService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.nexus_token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'nexus-super-secret-dev-key',
    });
  }

  async validate(payload: any) {
    if (payload.jti && this.blacklist.isRevoked(payload.jti)) {
      throw new UnauthorizedException('Token has been revoked');
    }
    return { id: payload.sub, email: payload.email, role: payload.role, tenantId: payload.tenantId ?? null, jti: payload.jti };
  }
}
