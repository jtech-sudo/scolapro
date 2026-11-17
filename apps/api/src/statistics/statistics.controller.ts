import { Controller, Get, Query } from '@nestjs/common';
import { DailyStatisticsQueryDto } from './statistics.dto';
import { StatisticsService } from './statistics.service';

@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statistics: StatisticsService) {}

  @Get('daily')
  getDailyReport(@Query() query: DailyStatisticsQueryDto) {
    return this.statistics.getDailyReport(query.date);
  }
}
