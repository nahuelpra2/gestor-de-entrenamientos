import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

type JwtPreview = {
  sub?: string;
  role?: string;
  iss?: string;
  aud?: string | string[];
  iat?: number;
  exp?: number;
};

function decodeJwtPayload(token: string): JwtPreview | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payloadJson) as JwtPreview;
  } catch {
    return null;
  }
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      this.logger.warn('canActivate() missing Authorization header');
    } else if (!/^Bearer\s+.+$/i.test(authHeader)) {
      this.logger.warn('canActivate() malformed Authorization header');
    } else {
      this.logger.debug('canActivate() Bearer token detected');

      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      const payload = decodeJwtPayload(token);
      const nowSec = Math.floor(Date.now() / 1000);

      if (!payload) {
        this.logger.warn('canActivate() unable to decode JWT payload preview');
      } else {
        const issuedAtIso =
          typeof payload.iat === 'number'
            ? new Date(payload.iat * 1000).toISOString()
            : 'n/a';
        const expiresAtIso =
          typeof payload.exp === 'number'
            ? new Date(payload.exp * 1000).toISOString()
            : 'n/a';
        const expiresInSec =
          typeof payload.exp === 'number' ? payload.exp - nowSec : null;
        const tokenAgeSec =
          typeof payload.iat === 'number' ? nowSec - payload.iat : null;

        this.logger.debug(
          `canActivate() jwt preview: now=${new Date(nowSec * 1000).toISOString()} sub=${payload.sub ?? 'n/a'} iss=${payload.iss ?? 'n/a'} aud=${Array.isArray(payload.aud) ? payload.aud.join(',') : payload.aud ?? 'n/a'} iat=${payload.iat ?? 'n/a'} (${issuedAtIso}) exp=${payload.exp ?? 'n/a'} (${expiresAtIso}) tokenAgeSec=${tokenAgeSec ?? 'n/a'} expiresInSec=${expiresInSec ?? 'n/a'}`,
        );
      }
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = { id: string; email: string; role: string }>(
    err: unknown,
    user: TUser | false | null,
    info: unknown,
  ): TUser {
    if (err) {
      this.logger.error(
        `handleRequest() passport error: ${err instanceof Error ? err.name : 'unknown'} - ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (info instanceof Error) {
      this.logger.warn(
        `handleRequest() token rejected: ${info.name} - ${info.message}`,
      );
    } else if (info) {
      this.logger.warn(`handleRequest() token rejected: ${String(info)}`);
    }

    if (!user) {
      throw err instanceof Error ? err : new UnauthorizedException();
    }

    this.logger.debug('handleRequest() authentication succeeded');
    return user;
  }
}
