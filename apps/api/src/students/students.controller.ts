import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Query,
} from '@nestjs/common';
import {
  CreateStudentDto,
  EnrollStudentDto,
  ListStudentsDto,
  UpdateStudentDto,
} from './students.dto';
import { StudentsService } from './students.service';

@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  list(@Query() query: ListStudentsDto) {
    return this.students.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.students.getDetails(id);
  }

  @Post()
  create(@Body() dto: CreateStudentDto) {
    return this.students.create(dto);
  }

  @Post(':id/enrollments')
  enroll(@Param('id') id: string, @Body() dto: EnrollStudentDto) {
    return this.students.enroll(id, dto.classId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.students.update(id, dto);
  }
}