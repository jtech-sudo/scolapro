import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CreatePortalNoticeDto, UpdatePortalNoticeDto } from './parent-portal.dto';
import { ParentPortalService } from './parent-portal.service';

@Controller('communication')
export class CommunicationController {
  constructor(private readonly portal: ParentPortalService) {}

  @Get('recipients')
  listRecipients() {
    return this.portal.listCommunicationRecipients();
  }

  @Get('notices')
  listNotices() {
    return this.portal.listNotices();
  }

  @Post('notices')
  createNotice(@Body() dto: CreatePortalNoticeDto) {
    return this.portal.createNotice(dto);
  }

  @Patch('notices/:id')
  updateNotice(@Param('id') id: string, @Body() dto: UpdatePortalNoticeDto) {
    return this.portal.updateNotice(id, dto);
  }
}
