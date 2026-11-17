import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  CreateGuardianDto,
  CreateSubjectDto,
  CreateTeacherDto,
  CreateTeachingAssignmentDto,
  LinkGuardianDto,
  UpdateGuardianDto,
  UpdateSubjectDto,
  UpdateTeacherDto,
} from './organization.dto';
import { OrganizationService } from './organization.service';

@Controller()
export class OrganizationController {
  constructor(private readonly organization: OrganizationService) {}

  @Get('guardians')
  listGuardians() { return this.organization.listGuardians(); }

  @Post('guardians')
  createGuardian(@Body() dto: CreateGuardianDto) { return this.organization.createGuardian(dto); }

  @Patch('guardians/:id')
  updateGuardian(@Param('id') id: string, @Body() dto: UpdateGuardianDto) { return this.organization.updateGuardian(id, dto); }

  @Post('guardians/:id/students')
  linkGuardian(@Param('id') id: string, @Body() dto: LinkGuardianDto) { return this.organization.linkGuardian(id, dto); }

  @Delete('guardians/:guardianId/students/:studentId')
  unlinkGuardian(@Param('guardianId') guardianId: string, @Param('studentId') studentId: string) { return this.organization.unlinkGuardian(guardianId, studentId); }

  @Get('teachers')
  listTeachers() { return this.organization.listTeachers(); }

  @Post('teachers')
  createTeacher(@Body() dto: CreateTeacherDto) { return this.organization.createTeacher(dto); }

  @Patch('teachers/:id')
  updateTeacher(@Param('id') id: string, @Body() dto: UpdateTeacherDto) { return this.organization.updateTeacher(id, dto); }

  @Get('subjects')
  listSubjects() { return this.organization.listSubjects(); }

  @Post('subjects')
  createSubject(@Body() dto: CreateSubjectDto) { return this.organization.createSubject(dto); }

  @Patch('subjects/:id')
  updateSubject(@Param('id') id: string, @Body() dto: UpdateSubjectDto) { return this.organization.updateSubject(id, dto); }

  @Get('teaching-assignments')
  listTeachingAssignments(@Query('schoolYearId') schoolYearId?: string) { return this.organization.listTeachingAssignments(schoolYearId); }

  @Post('teaching-assignments')
  createTeachingAssignment(@Body() dto: CreateTeachingAssignmentDto) { return this.organization.createTeachingAssignment(dto); }

  @Delete('teaching-assignments/:id')
  removeTeachingAssignment(@Param('id') id: string) { return this.organization.removeTeachingAssignment(id); }
}