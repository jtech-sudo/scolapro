import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CreateAssessmentDto, CreateExamQuestionDto, ListAssessmentsDto, SaveGradesDto, UpdateAssessmentDto, UpdateOnlineAssessmentDto } from './academics.dto';
import { AcademicsService } from './academics.service';

@Controller('academic')
export class AcademicsController {
  constructor(private readonly academics: AcademicsService) {}

  @Get('teaching-assignments')
  listTeachingAssignments(@Query('schoolYearId') schoolYearId?: string) {
    return this.academics.listTeachingAssignments(schoolYearId);
  }

  @Get('classes/:classId/roster')
  getClassRoster(@Param('classId') classId: string) {
    return this.academics.getClassRoster(classId);
  }

  @Get('assessments')
  listAssessments(@Query() query: ListAssessmentsDto) {
    return this.academics.listAssessments(query);
  }

  @Post('assessments')
  createAssessment(@Body() dto: CreateAssessmentDto) {
    return this.academics.createAssessment(dto);
  }

  @Patch('assessments/:id')
  updateAssessment(@Param('id') id: string, @Body() dto: UpdateAssessmentDto) {
    return this.academics.updateAssessment(id, dto);
  }

  @Patch('assessments/:id/online')
  updateOnlineAssessment(@Param('id') id: string, @Body() dto: UpdateOnlineAssessmentDto) {
    return this.academics.updateOnlineAssessment(id, dto);
  }

  @Post('assessments/:id/questions')
  addExamQuestion(@Param('id') id: string, @Body() dto: CreateExamQuestionDto) {
    return this.academics.addExamQuestion(id, dto);
  }

  @Put('assessments/:id/grades')
  saveGrades(@Param('id') id: string, @Body() dto: SaveGradesDto) {
    return this.academics.saveGrades(id, dto);
  }

  @Get('term-summary')
  getTermSummary(@Query('classId') classId: string, @Query('subjectId') subjectId: string, @Query('termId') termId: string) {
    return this.academics.getTermSummary(classId, subjectId, termId);
  }
}