import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  sv?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_ACCESS_SECRET ||
        process.env.JWT_SECRET ||
        'book-secret-access-key',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        avatarUrl: true,
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account inactive or not found');
    }

    const session = await this.prisma.platformSetting.findUnique({
      where: { key: `SESSION_${payload.sub}` },
    });
    const currentVersion = Number(session?.value);
    const tokenVersion = Number(payload.sv ?? 0);
    if ((Number.isFinite(currentVersion) ? currentVersion : 0) !== tokenVersion) {
      throw new UnauthorizedException('This session has ended. Sign in again.');
    }

    return user;
  }
}
