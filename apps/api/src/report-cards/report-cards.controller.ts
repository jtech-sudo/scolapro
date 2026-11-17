import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateReportCardRuleDto, ListReportCardsDto, PreviewReportCardsDto, UpdateReportCardDto } from './report-cards.dto';
import { ReportCardsService } from './report-cards.service';

@Controller('report-cards')
export class ReportCardsController {
  constructor(private readonly reportCards: ReportCardsService) {}

  @Get('rules')
  listRules(@Query('schoolYearId') schoolYearId?: string) { return this.reportCards.listRules(schoolYearId); }

  @Post('rules')
  createRule(@Body() dto: CreateReportCardRuleDto) { return this.reportCards.createRule(dto); }

  @Patch('rules/:id')
  updateRule(@Param('id') id: string, @Body('effective') effective: boolean) { return this.reportCards.updateRule(id, effective); }

  @Get('preview')
  preview(@Query() dto: PreviewReportCardsDto) { return this.reportCards.preview(dto); }

  @Post('generate')
  generate(@Body() dto: PreviewReportCardsDto) { return this.reportCards.generate(dto); }

  @Get()
  listReportCards(@Query() query: ListReportCardsDto) { return this.reportCards.listReportCards(query); }

  @Patch(':id')
  updateReportCard(@Param('id') id: string, @Body() dto: UpdateReportCardDto) { return this.reportCards.updateReportCard(id, dto); }
}