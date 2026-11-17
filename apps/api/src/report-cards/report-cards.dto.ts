import { Type } from 'class-transformer';
import { ReportCardRuleScope, ReportCardStatus } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const CONFIGURABLE_REPORT_FORMULAS = ['WEIGHTED_SUBJECT_PERCENT', 'WEIGHTED_RAW_SCORE'] as const;

export class MentionThresholdDto {
  @IsNumber() @Min(0) @Max(100)
  minimum!: number;

  @IsString() @MinLength(1) @MaxLength(50)
  label!: string;
}

export class CreateReportCardRuleDto {
  @IsString() @MinLength(1) @MaxLength(100)
  name!: string;

  @IsEnum(ReportCardRuleScope)
  scope!: ReportCardRuleScope;

  @IsString()
  levelId!: string;

  @IsOptional() @IsString()
  classId?: string;

  @IsString()
  schoolYearId!: string;

  @IsString()
  termId!: string;

  @IsNumber() @Min(0.01) @Max(1000)
  maximumScore!: number;

  @IsIn(CONFIGURABLE_REPORT_FORMULAS)
  formula!: (typeof CONFIGURABLE_REPORT_FORMULAS)[number];

  @IsBoolean()
  rankByAverage = true;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MentionThresholdDto)
  mentions?: MentionThresholdDto[];
}

export class ListReportCardsDto {
  @IsString()
  classId!: string;

  @IsString()
  termId!: string;
}

export class UpdateReportCardDto {
  @IsOptional() @IsEnum(ReportCardStatus)
  status?: ReportCardStatus;

  @IsOptional() @IsString() @MaxLength(1000)
  generalComment?: string | null;
}

export class PreviewReportCardsDto {
  @IsString()
  classId!: string;

  @IsString()
  termId!: string;
}