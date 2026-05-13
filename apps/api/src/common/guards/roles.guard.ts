import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { isAdminPortRequest } from '../security/security.utils';
import { AuthenticatedUser, UserRole } from '../types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles || roles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    if (
      roles.includes('admin') &&
      user.role === 'admin' &&
      !isAdminPortRequest(request, this.configService)
    ) {
      throw new ForbiddenException(
        'Admin access is only available through the admin port.',
      );
    }

    return true;
  }
}
