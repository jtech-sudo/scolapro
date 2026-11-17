import { Type } from 'class-transformer';
import { AttendanceSlot, AttendanceStatus } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class OpenAttendanceSessionDto {
  @IsString()
  classId!: string;

  @IsDateString()
  date!: string;

  @IsEnum(AttendanceSlot)
  slot!: AttendanceSlot;
}

export class SaveAttendanceRecordDto {
  @IsString()
  studentId!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  arrivalTime?: string;

  @IsOptional() @IsString() @MaxLength(300)
  reason?: string;

  @IsOptional() @Type(() => Boolean) @IsBoolean()
  isJustified?: boolean;
}

export class SaveAttendanceDto {
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true }) @Type(() => SaveAttendanceRecordDto)
  records!: SaveAttendanceRecordDto[];
}

export class AttendanceReportQueryDto {
  @IsString()
  classId!: string;

  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional() @IsEnum(AttendanceSlot)
  slot?: AttendanceSlot;
}

export class UpdateAttendanceJustificationDto {
  @IsOptional() @IsString() @MaxLength(300)
  reason = '';

  @Type(() => Boolean) @IsBoolean()
  isJustified!: boolean;
}