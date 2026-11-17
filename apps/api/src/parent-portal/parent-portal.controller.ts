import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req } from '@nestjs/common';
import { Request } from 'express';
import {
  CreateParentAccountDto,
  CreatePortalNoticeDto,
  LinkParentAccountDto,
  ParentPortalLoginDto,
  UpdatePortalNoticeDto,
  UpdatePortalSettingsDto,
} from './parent-portal.dto';
import { ParentPortalService } from './parent-portal.service';

type ParentAuthenticatedRequest = Request & { auth?: { sub: string; schoolId: string; guardianId: string } };

@Controller('parent-portal')
export class ParentPortalController {
  constructor(private readonly portal: ParentPortalService) {}

  @Post('parent/login')
  loginParent(@Body() dto: ParentPortalLoginDto) { return this.portal.loginParent(dto); }

  @Get('parent/me')
  getParentSession(@Req() request: ParentAuthenticatedRequest) {
    const claims = request.auth;
    if (!claims) throw new Error('Parent session context is missing.');
    return this.portal.getParentSession(claims.sub, claims.schoolId, claims.guardianId);
  }

  @Get('settings')
  getSettings() { return this.portal.getSettings(); }

  @Put('settings')
  updateSettings(@Body() dto: UpdatePortalSettingsDto) { return this.portal.updateSettings(dto); }

  @Get('accounts')
  listAccounts() { return this.portal.listAccounts(); }

  @Post('accounts/create')
  createParentAccount(@Body() dto: CreateParentAccountDto) { return this.portal.createParentAccount(dto); }

  @Post('accounts')
  linkAccount(@Body() dto: LinkParentAccountDto) { return this.portal.linkAccount(dto); }

  @Delete('accounts/:guardianId')
  unlinkAccount(@Param('guardianId') guardianId: string) { return this.portal.unlinkAccount(guardianId); }

  @Get('notices')
  listNotices() { return this.portal.listNotices(); }

  @Post('notices')
  createNotice(@Body() dto: CreatePortalNoticeDto) { return this.portal.createNotice(dto); }

  @Patch('notices/:id')
  updateNotice(@Param('id') id: string, @Body() dto: UpdatePortalNoticeDto) { return this.portal.updateNotice(id, dto); }
}