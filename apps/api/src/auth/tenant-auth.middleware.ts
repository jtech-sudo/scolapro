import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';
import { TenantContextService } from '../database/tenant-context.service';
import { AuthService } from './auth.service';

type AccessClaims = { sub: string; schoolId?: string; role?: string; tokenType?: 'PLATFORM_ADMIN' | 'PLATFORM_SCHOOL_ACCESS' | 'PARENT'; guardianId?: string; parentAccountId?: string };

type AuthenticatedRequest = Request & { auth?: AccessClaims };

@Injectable()
export class TenantAuthMiddleware implements NestMiddleware {
  constructor(
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async use(request: AuthenticatedRequest, response: Response, next: NextFunction) {
    const path = request.path.split('?')[0].replace(/\/+$/, '') || '/';
    const publicPaths = new Set([
      '/api/v1/health',
      '/api/v1/health/ready',
      '/api/v1/auth/login',
      '/api/v1/platform/auth/status',
      '/api/v1/platform/auth/bootstrap',
      '/api/v1/platform/auth/login',
      '/api/v1/parent-portal/parent/login',
    ]);
    const isPublicEnrollmentRoute = /^\/api\/v1\/online-enrollment\/public\/[^/]+$/.test(path)
      && (request.method === 'GET' || request.method === 'POST');
    const isPublic = publicPaths.has(path) || isPublicEnrollmentRoute;
    if (isPublic) return next();

    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
    if (!token) return response.status(401).json({ statusCode: 401, message: 'Connectez-vous à votre école pour continuer.' });

    try {
      const claims = await this.jwt.verifyAsync<AccessClaims>(token);
      if (!claims.sub) throw new Error('Token claims are incomplete.');
      if (path.startsWith('/api/v1/platform/')) {
        if (claims.tokenType !== 'PLATFORM_ADMIN' || claims.schoolId) {
          return response.status(403).json({ statusCode: 403, message: 'Cette console est réservée aux administrateurs de la plateforme.' });
        }
        const platformAdmin = await this.auth.validatePlatformAdmin(claims.sub);
        if (!platformAdmin) return response.status(401).json({ statusCode: 401, message: 'L’accès administrateur de plateforme est désactivé.' });
        request.auth = claims;
        return next();
      }
      if (claims.tokenType === 'PARENT') {
        if (!claims.schoolId || !claims.guardianId || claims.role !== 'PARENT') throw new Error('Parent token claims are incomplete.');
        const isParentMeRoute = path === '/api/v1/parent-portal/parent/me';
        if (request.method !== 'GET' || !isParentMeRoute) {
          return response.status(403).json({ statusCode: 403, message: 'Cette session parent est limitée à son identité familiale.' });
        }
        const parentContext = await this.auth.validateParentSession(claims.sub, claims.schoolId, claims.guardianId);
        if (!parentContext) return response.status(401).json({ statusCode: 401, message: 'Cette session parent ou son rattachement familial n’est plus actif.' });
        request.auth = claims;
        return this.tenantContext.run(parentContext, async () => next());
      }
      if (path.startsWith('/api/v1/parent-portal/parent/')) {
        return response.status(403).json({ statusCode: 403, message: 'Cette route est réservée aux sessions parent dédiées.' });
      }
      if (claims.tokenType === 'PLATFORM_SCHOOL_ACCESS') {
        if (!claims.schoolId || claims.role !== 'ADMIN') throw new Error('Platform school access claims are incomplete.');
        const platformAccess = await this.auth.validatePlatformSchoolAccess(claims.sub, claims.schoolId);
        if (!platformAccess) return response.status(401).json({ statusCode: 401, message: 'Cette session d’assistance ou cet accès école a expiré.' });
        request.auth = claims;
        return this.tenantContext.run(platformAccess, async () => next());
      }
      if (!claims.schoolId || claims.tokenType === 'PLATFORM_ADMIN' || claims.role === 'PARENT') throw new Error('School token claims are incomplete.');
      const membership = await this.auth.validateMembership(claims.sub, claims.schoolId);
      if (!membership) return response.status(401).json({ statusCode: 401, message: 'La session ou l’accès à cette école a expiré.' });
      const isSchoolProfileRead = request.method === 'GET' && path === '/api/v1/admin/school-profile';
      const isSchoolAdministrationRoute = path.startsWith('/api/v1/admin/')
        && !path.startsWith('/api/v1/admin/security/')
        && !isSchoolProfileRead;
      if (isSchoolAdministrationRoute && membership.role !== 'ADMIN') {
        return response.status(403).json({ statusCode: 403, message: 'La gestion des comptes et des permissions est réservée à l’administrateur de cet établissement.' });
      }
      request.auth = claims;
      return this.tenantContext.run(membership, async () => {
        const policy = this.policyFor(path, request.method);
        if (policy) {
          const allowed = await this.auth.hasPermission(membership.schoolId, membership.role, policy.module, policy.action);
          if (!allowed) return response.status(403).json({ statusCode: 403, message: 'Votre rôle ne dispose pas de cette autorisation dans cette école.' });
        }
        return next();
      });
    } catch {
      return response.status(401).json({ statusCode: 401, message: 'Session invalide ou expirée. Reconnectez-vous.' });
    }
  }

  private policyFor(path: string, method: string): { module: string; action: 'canView' | 'canCreate' | 'canUpdate' | 'canDelete' } | null {
    const route = path.replace(/^\/api\/v1/, '');
    let module: string | null = null;
    if (route.startsWith('/admin/security')) module = 'security';
    else if (route.startsWith('/admin')) module = 'administration';
    else if (route.startsWith('/school-subscription')) module = 'billing';
    else if (route.startsWith('/school-years') || route.startsWith('/terms') || route.startsWith('/levels') || route.startsWith('/classes')) module = 'school-year';
    else if (route.startsWith('/students') || route.startsWith('/guardians') || route.startsWith('/teachers')) module = 'people';
    else if (route.startsWith('/academic') || route.startsWith('/subjects') || route.startsWith('/teaching-assignments')) module = 'grades';
    else if (route.startsWith('/timetable')) module = 'timetable';
    else if (route.startsWith('/teaching-documents')) module = 'teaching-documents';
    else if (route.startsWith('/report-cards')) module = 'report-cards';
    else if (route.startsWith('/attendance')) module = 'attendance';
    else if (route.startsWith('/library')) module = 'library';
    else if (route.startsWith('/statistics')) module = 'statistics';
    else if (route.startsWith('/invoices') || route.startsWith('/payments') || route.startsWith('/fee-types') || route.startsWith('/billing/summary')) module = 'billing';
    else if (route.startsWith('/expenses') || route.startsWith('/expense-categories') || route.startsWith('/finance')) module = 'finance';
    else if (route.startsWith('/transport')) module = 'transport';
    else if (route.startsWith('/personnel')) module = 'personnel';
    else if (route.startsWith('/online-enrollment')) module = 'online-enrollment';
    else if (route.startsWith('/communication')) module = 'communication';
    else if (route.startsWith('/parent-portal')) module = 'parent-portal';
    if (!module) return null;

    let action: 'canView' | 'canCreate' | 'canUpdate' | 'canDelete';
    if (method === 'GET' || method === 'HEAD') action = 'canView';
    else if (method === 'DELETE') action = 'canDelete';
    else if (method === 'PATCH' || method === 'PUT' || /\/(cancel|validate|reopen|approve|archive|restore)(\/|$)/.test(route)) action = 'canUpdate';
    else action = 'canCreate';
    return { module, action };
  }
}
