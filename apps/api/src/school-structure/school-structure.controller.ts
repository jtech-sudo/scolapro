import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  CreateClassDto,
  CreateLevelDto,
  CreateSchoolYearDto,
  CreateTermDto,
  ListClassesDto,
  UpdateClassDto,
  UpdateLevelDto,
  UpdateSchoolYearDto,
  UpdateTermDto,
} from './school-structure.dto';
import { SchoolStructureService } from './school-structure.service';

@Controller()
export class SchoolStructureController {
  constructor(private readonly schoolStructure: SchoolStructureService) {}

  @Get('school-years')
  listSchoolYears() {
    return this.schoolStructure.listSchoolYears();
  }

  @Post('school-years')
  createSchoolYear(@Body() dto: CreateSchoolYearDto) {
    return this.schoolStructure.createSchoolYear(dto);
  }

  @Patch('school-years/:id')
  updateSchoolYear(@Param('id') id: string, @Body() dto: UpdateSchoolYearDto) {
    return this.schoolStructure.updateSchoolYear(id, dto);
  }

  @Post('school-years/:id/terms')
  createTerm(@Param('id') id: string, @Body() dto: CreateTermDto) {
    return this.schoolStructure.createTerm(id, dto);
  }

  @Patch('terms/:id')
  updateTerm(@Param('id') id: string, @Body() dto: UpdateTermDto) {
    return this.schoolStructure.updateTerm(id, dto);
  }

  @Get('levels')
  listLevels() {
    return this.schoolStructure.listLevels();
  }

  @Post('levels')
  createLevel(@Body() dto: CreateLevelDto) {
    return this.schoolStructure.createLevel(dto);
  }

  @Patch('levels/:id')
  updateLevel(@Param('id') id: string, @Body() dto: UpdateLevelDto) {
    return this.schoolStructure.updateLevel(id, dto);
  }

  @Delete('levels/:id')
  deleteLevel(@Param('id') id: string) {
    return this.schoolStructure.deleteLevel(id);
  }

  @Get('classes')
  listClasses(@Query() query: ListClassesDto) {
    return this.schoolStructure.listClasses(query);
  }

  @Post('classes')
  createClass(@Body() dto: CreateClassDto) {
    return this.schoolStructure.createClass(dto);
  }

  @Patch('classes/:id')
  updateClass(@Param('id') id: string, @Body() dto: UpdateClassDto) {
    return this.schoolStructure.updateClass(id, dto);
  }

  @Delete('classes/:id')
  deleteClass(@Param('id') id: string) {
    return this.schoolStructure.deleteClass(id);
  }
}