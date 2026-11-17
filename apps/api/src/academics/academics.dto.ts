import { Type } from 'class-transformer';
import { AssessmentStatus, StudentExamQuestionType } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const decimalPattern = /^(?:0|[1-9]\d{0,3})(?:\.\d{1,2})?$/;

export class CreateAssessmentDto {
  @IsString() @MinLength(1) @MaxLength(100)
  name!: string;

  @IsString() @MinLength(1) @MaxLength(60)
  assessmentType!: string;

  @IsString()
  classId!: string;

  @IsString()
  subjectId!: string;

  @IsString()
  termId!: string;

  @IsDateString()
  assessmentDate!: string;

  @Matches(decimalPattern)
  maximumScore!: string;

  @IsOptional() @Matches(decimalPattern)
  coefficient = '1';
}

export class ListAssessmentsDto {
  @IsOptional() @IsString()
  classId?: string;

  @IsOptional() @IsString()
  subjectId?: string;

  @IsOptional() @IsString()
  termId?: string;
}

export class UpdateAssessmentDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100)
  name?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(60)
  assessmentType?: string;

  @IsOptional() @IsDateString()
  assessmentDate?: string;

  @IsOptional() @Matches(decimalPattern)
  maximumScore?: string;

  @IsOptional() @Matches(decimalPattern)
  coefficient?: string;

  @IsOptional() @IsEnum(AssessmentStatus)
  status?: AssessmentStatus;
}

export class UpdateOnlineAssessmentDto {
  @IsOptional() @IsBoolean()
  onlineEnabled?: boolean;

  @IsOptional() @IsDateString()
  onlineStartsAt?: string | null;

  @IsOptional() @IsDateString()
  onlineEndsAt?: string | null;
}

export class CreateExamQuestionChoiceDto {
  @IsString() @MinLength(1) @MaxLength(200)
  text!: string;

  @IsOptional() @IsBoolean()
  isCorrect?: boolean;
}

export class CreateExamQuestionDto {
  @IsIn(['MULTIPLE_CHOICE', 'WRITTEN'])
  type!: 'MULTIPLE_CHOICE' | 'WRITTEN';

  @IsString() @MinLength(1) @MaxLength(500)
  prompt!: string;

  @Matches(decimalPattern)
  points!: string;

  @IsOptional() @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true }) @Type(() => CreateExamQuestionChoiceDto)
  choices?: CreateExamQuestionChoiceDto[];
}

export class GradeEntryDto {
  @IsString()
  studentId!: string;

  @Matches(decimalPattern)
  score!: string;

  @IsOptional() @IsString() @MaxLength(300)
  comment?: string;
}

export class SaveGradesDto {
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true }) @Type(() => GradeEntryDto)
  grades!: GradeEntryDto[];
}