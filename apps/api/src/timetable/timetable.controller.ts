import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CreateTimetableEntryDto } from './timetable.dto';
import { TimetableService } from './timetable.service';

@Controller('timetable')
export class TimetableController {
  constructor(private readonly timetable: TimetableService) {}

  @Get()
  list(@Query('schoolYearId') schoolYearId?: string) {
    return this.timetable.list(schoolYearId);
  }

  @Post()
  create(@Body() dto: CreateTimetableEntryDto) {
    return this.timetable.create(dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.timetable.delete(id);
  }
}
