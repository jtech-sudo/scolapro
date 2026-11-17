import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import {
  AttendanceReportQueryDto,
  OpenAttendanceSessionDto,
  SaveAttendanceDto,
  UpdateAttendanceJustificationDto,
} from './attendance.dto';
import { AttendanceService } from './attendance.service';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('sessions/open')
  openSession(@Body() dto: OpenAttendanceSessionDto) { return this.attendance.openSession(dto); }

  @Put('sessions/:id/records')
  saveRecords(@Param('id') id: string, @Body() dto: SaveAttendanceDto) { return this.attendance.saveRecords(id, dto); }

  @Patch('records/:id/justification')
  updateJustification(@Param('id') id: string, @Body() dto: UpdateAttendanceJustificationDto) {
    return this.attendance.updateJustification(id, dto.reason, dto.isJustified);
  }

  @Get('report')
  getReport(@Query() query: AttendanceReportQueryDto) { return this.attendance.getReport(query); }
}