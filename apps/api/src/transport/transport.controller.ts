import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AssignTransportStudentDto, CreateTransportRouteDto, CreateTransportStopDto, UpdateTransportRouteDto } from './transport.dto';
import { TransportService } from './transport.service';

@Controller('transport')
export class TransportController {
  constructor(private readonly transport: TransportService) {}

  @Get('routes')
  listRoutes() { return this.transport.listRoutes(); }

  @Get('students')
  listStudents() { return this.transport.listStudents(); }

  @Post('routes')
  createRoute(@Body() dto: CreateTransportRouteDto) { return this.transport.createRoute(dto); }

  @Patch('routes/:id')
  updateRoute(@Param('id') id: string, @Body() dto: UpdateTransportRouteDto) { return this.transport.updateRoute(id, dto); }

  @Post('routes/:id/stops')
  addStop(@Param('id') id: string, @Body() dto: CreateTransportStopDto) { return this.transport.addStop(id, dto); }

  @Post('routes/:id/students')
  assignStudent(@Param('id') id: string, @Body() dto: AssignTransportStudentDto) { return this.transport.assignStudent(id, dto); }

  @Delete('routes/:id/students/:studentId')
  unassignStudent(@Param('id') id: string, @Param('studentId') studentId: string) { return this.transport.unassignStudent(id, studentId); }
}
