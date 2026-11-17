import { Type } from 'class-transformer';
import { SchoolLevelType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateSchoolYearDto {
  @IsString()
  @MinLength(4)
  @MaxLength(30)
  name!: string;

  @IsDateString()
  startsOn!: string;

  @IsDateString()
  endsOn!: string;

  @IsOptional()
  @IsBoolean()
  isCurrent = false;
}

export class UpdateSchoolYearDto {
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(30)
  name?: string;

  @IsOptional()
  @IsDateString()
  startsOn?: string;

  @IsOptional()
  @IsDateString()
  endsOn?: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}

export class CreateTermDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  order!: number;

  @IsDateString()
  startsOn!: string;

  @IsDateString()
  endsOn!: string;
}

export class UpdateTermDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order?: number;

  @IsOptional()
  @IsDateString()
  startsOn?: string;

  @IsOptional()
  @IsDateString()
  endsOn?: string;
}

export class CreateLevelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @IsEnum(SchoolLevelType)
  type!: SchoolLevelType;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class UpdateLevelDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsEnum(SchoolLevelType)
  type?: SchoolLevelType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListClassesDto {
  @IsOptional()
  @IsString()
  schoolYearId?: string;

  @IsOptional()
  @IsString()
  levelId?: string;
}

export class CreateClassDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsString()
  levelId!: string;

  @IsString()
  schoolYearId!: string;
}

export class UpdateClassDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  levelId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}