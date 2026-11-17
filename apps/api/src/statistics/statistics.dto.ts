import { IsDateString } from 'class-validator';

export class DailyStatisticsQueryDto {
  @IsDateString()
  date!: string;
}
