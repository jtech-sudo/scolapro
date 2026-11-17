import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import {
  ResetUserPasswordDto,
  SaveRolePermissionsDto,
  UpdateSchoolProfileDto,
  UpdateUserRoleDto,
} from './administration.dto';
import { AdministrationService } from './administration.service';

@Controller('admin')
export class AdministrationController {
  constructor(private readonly administration: AdministrationService) {}

  @Get('school-profile')
  getSchoolProfile() { return this.administration.getSchoolProfile(); }

  @Put('school-profile')
  updateSchoolProfile(@Body() dto: UpdateSchoolProfileDto) { return this.administration.updateSchoolProfile(dto); }

  @Get('roles/permissions')
  getRolePermissions() { return this.administration.getRolePermissions(); }

  @Put('roles/permissions')
  saveRolePermissions(@Body() dto: SaveRolePermissionsDto) { return this.administration.saveRolePermissions(dto.permissions); }

  @Get('users')
  listUsers() { return this.administration.listUsers(); }

  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) { return this.administration.updateUser(id, dto); }

  @Post('users/:id/password')
  resetUserPassword(@Param('id') id: string, @Body() dto: ResetUserPasswordDto) {
    return this.administration.resetUserPassword(id, dto.password);
  }

  @Get('security/audit-logs')
  getSecurityAuditLogs() { return this.administration.getSecurityAuditLogs(); }

  @Get('security/archives/students')
  getArchivedStudents() { return this.administration.getArchivedStudents(); }

  @Post('security/archives/students/:id/restore')
  restoreArchivedStudent(@Param('id') id: string) { return this.administration.restoreArchivedStudent(id); }
}