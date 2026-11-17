import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Put, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { BootstrapPlatformAdminDto, CreatePlatformSchoolDto, CreatePlatformSubscriptionPaymentDto, LoginDto, PlatformAdminLoginDto, RequestSchoolSubscriptionPlanDto, ResetPlatformSchoolAdminPasswordDto, ReviewSchoolSubscriptionPlanRequestDto, UpdatePlatformPlanDto, UpdatePlatformSchoolStatusDto, UpdateSchoolSubscriptionDto } from './auth.dto';
import { Public } from './public.decorator';
import { SaveRolePermissionsDto, UpdateSchoolProfileDto, UpdateUserRoleDto } from '../administration/administration.dto';

type AuthenticatedRequest = Request & { auth?: { sub: string; schoolId: string; role: string } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    const claims = request.auth;
    if (!claims) throw new Error('Authenticated request context is missing.');
    return this.auth.getCurrentUser(claims.sub, claims.schoolId);
  }

  @Get('permissions')
  permissions(@Req() request: AuthenticatedRequest) {
    const claims = request.auth;
    if (!claims) throw new Error('Authenticated request context is missing.');
    return this.auth.getCurrentRolePermissions(claims.sub, claims.schoolId);
  }

  @Get('schools')
  schools(@Req() request: AuthenticatedRequest) {
    return this.auth.listMySchools(request.auth!.sub);
  }

  @Post('switch-school/:schoolId')
  switchSchool(@Req() request: AuthenticatedRequest, @Param('schoolId') schoolId: string) {
    return this.auth.switchSchool(request.auth!.sub, schoolId);
  }
}

@Controller('school-subscription')
export class SchoolSubscriptionController {
  constructor(private readonly auth: AuthService) {}

  @Get('plans')
  plans() { return this.auth.listPlatformPlanSettings(); }

  @Get()
  current() {
    return this.auth.getSchoolSubscription();
  }

  @Post('requests')
  requestPlan(@Body() dto: RequestSchoolSubscriptionPlanDto, @Req() request: AuthenticatedRequest) {
    if (request.auth!.role !== 'ADMIN') throw new ForbiddenException('Seul l’administrateur de l’école peut demander un changement de forfait.');
    return this.auth.requestSchoolSubscriptionPlan(dto, request.auth!.sub);
  }
}

@Controller('platform')
export class PlatformController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Get('auth/status')
  bootstrapStatus() { return this.auth.platformBootstrapStatus(); }

  @Public()
  @Post('auth/bootstrap')
  bootstrap(@Body() dto: BootstrapPlatformAdminDto) { return this.auth.bootstrapPlatformAdmin(dto); }

  @Public()
  @Post('auth/login')
  login(@Body() dto: PlatformAdminLoginDto) { return this.auth.platformLogin(dto); }

  @Get('auth/me')
  me(@Req() request: AuthenticatedRequest) { return this.auth.getCurrentPlatformAdmin(request.auth!.sub); }

  @Get('schools')
  schools() { return this.auth.listPlatformSchools(); }

  @Post('schools')
  createSchool(@Body() dto: CreatePlatformSchoolDto, @Req() request: AuthenticatedRequest) {
    return this.auth.createPlatformSchool(dto, request.auth!.sub);
  }

  @Patch('schools/:id/status')
  updateSchoolStatus(@Param('id') id: string, @Body() dto: UpdatePlatformSchoolStatusDto, @Req() request: AuthenticatedRequest) {
    return this.auth.setPlatformSchoolStatus(id, dto.isActive, request.auth!.sub);
  }

  @Patch('schools/:id/subscription')
  updateSchoolSubscription(@Param('id') id: string, @Body() dto: UpdateSchoolSubscriptionDto, @Req() request: AuthenticatedRequest) {
    return this.auth.updateSchoolSubscription(id, dto, request.auth!.sub);
  }

  @Get('subscription-plans')
  subscriptionPlans() { return this.auth.listPlatformPlanSettings(); }

  @Put('subscription-plans/:plan')
  updateSubscriptionPlan(@Param('plan') plan: string, @Body() dto: UpdatePlatformPlanDto, @Req() request: AuthenticatedRequest) {
    return this.auth.updatePlatformPlanSetting(plan, dto.monthlyFee, request.auth!.sub);
  }

  @Get('subscription-plan-requests')
  subscriptionPlanRequests() { return this.auth.listPlatformSubscriptionPlanRequests(); }

  @Patch('subscription-plan-requests/:id')
  reviewSubscriptionPlanRequest(@Param('id') id: string, @Body() dto: ReviewSchoolSubscriptionPlanRequestDto, @Req() request: AuthenticatedRequest) {
    return this.auth.reviewPlatformSubscriptionPlanRequest(id, dto, request.auth!.sub);
  }

  @Get('subscription-payments')
  subscriptionPayments() { return this.auth.listPlatformSubscriptionPayments(); }

  @Post('subscription-payments')
  createSubscriptionPayment(@Body() dto: CreatePlatformSubscriptionPaymentDto, @Req() request: AuthenticatedRequest) {
    return this.auth.createPlatformSubscriptionPayment(dto, request.auth!.sub);
  }

  @Post('schools/:schoolId/admins/:userId/password')
  resetSchoolAdminPassword(@Param('schoolId') schoolId: string, @Param('userId') userId: string, @Body() dto: ResetPlatformSchoolAdminPasswordDto, @Req() request: AuthenticatedRequest) {
    return this.auth.resetPlatformSchoolAdminPassword(schoolId, userId, dto.password, request.auth!.sub);
  }

  @Post('schools/:schoolId/administration/users/:userId/password')
  resetSchoolUserPassword(@Param('schoolId') schoolId: string, @Param('userId') userId: string, @Body() dto: ResetPlatformSchoolAdminPasswordDto, @Req() request: AuthenticatedRequest) {
    return this.auth.resetPlatformSchoolAdminPassword(schoolId, userId, dto.password, request.auth!.sub);
  }

  @Get('schools/:schoolId/administration/profile')
  schoolProfile(@Param('schoolId') schoolId: string) { return this.auth.getPlatformSchoolProfile(schoolId); }

  @Put('schools/:schoolId/administration/profile')
  updateSchoolProfile(@Param('schoolId') schoolId: string, @Body() dto: UpdateSchoolProfileDto, @Req() request: AuthenticatedRequest) {
    return this.auth.updatePlatformSchoolProfile(schoolId, dto, request.auth!.sub);
  }

  @Get('schools/:schoolId/administration/permissions')
  schoolPermissions(@Param('schoolId') schoolId: string) { return this.auth.getPlatformSchoolPermissions(schoolId); }

  @Put('schools/:schoolId/administration/permissions')
  updateSchoolPermissions(@Param('schoolId') schoolId: string, @Body() dto: SaveRolePermissionsDto, @Req() request: AuthenticatedRequest) {
    return this.auth.savePlatformSchoolPermissions(schoolId, dto.permissions, request.auth!.sub);
  }

  @Get('schools/:schoolId/administration/users')
  schoolUsers(@Param('schoolId') schoolId: string) { return this.auth.listPlatformSchoolUsers(schoolId); }

  @Patch('schools/:schoolId/administration/users/:userId')
  updateSchoolUser(@Param('schoolId') schoolId: string, @Param('userId') userId: string, @Body() dto: UpdateUserRoleDto, @Req() request: AuthenticatedRequest) {
    return this.auth.updatePlatformSchoolUser(schoolId, userId, dto, request.auth!.sub);
  }
}
