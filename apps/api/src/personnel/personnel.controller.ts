import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CreateStaffLeaveDto, CreateStaffMemberDto, ReviewStaffLeaveDto, UpdateStaffMemberDto } from './personnel.dto';
import { PersonnelService } from './personnel.service';

@Controller('personnel')
export class PersonnelController {
  constructor(private readonly personnel: PersonnelService) {}

  @Get('records')
  listRecords() { return this.personnel.listRecords(); }

  @Post('records')
  createRecord(@Body() dto: CreateStaffMemberDto) { return this.personnel.createRecord(dto); }

  @Patch('records/:id')
  updateRecord(@Param('id') id: string, @Body() dto: UpdateStaffMemberDto) { return this.personnel.updateRecord(id, dto); }

  @Post('records/:id/leaves')
  createLeave(@Param('id') id: string, @Body() dto: CreateStaffLeaveDto) { return this.personnel.createLeave(id, dto); }

  @Patch('leaves/:id')
  reviewLeave(@Param('id') id: string, @Body() dto: ReviewStaffLeaveDto) { return this.personnel.reviewLeave(id, dto); }
}
