import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateGuardianDto {
  @IsString() @MinLength(1) @MaxLength(80)
  firstName!: string;

  @IsString() @MinLength(1) @MaxLength(80)
  lastName!: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @IsOptional() @IsEmail() @MaxLength(120)
  email?: string;

  @IsOptional() @IsString() @MaxLength(180)
  address?: string;

  @IsOptional() @IsString() @MaxLength(80)
  occupation?: string;
}

export class UpdateGuardianDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80)
  firstName?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(80)
  lastName?: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string | null;

  @IsOptional() @IsEmail() @MaxLength(120)
  email?: string | null;

  @IsOptional() @IsString() @MaxLength(180)
  address?: string | null;

  @IsOptional() @IsString() @MaxLength(80)
  occupation?: string | null;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class LinkGuardianDto {
  @IsString()
  studentId!: string;

  @IsString() @MinLength(1) @MaxLength(40)
  relationship!: string;

  @IsOptional() @Type(() => Boolean) @IsBoolean()
  isPrimary = false;
}

export class CreateTeacherDto {
  @IsString() @MinLength(1) @MaxLength(80)
  firstName!: string;

  @IsString() @MinLength(1) @MaxLength(80)
  lastName!: string;

  @IsOptional() @IsString() @MaxLength(30)
  employeeNumber?: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @IsOptional() @IsEmail() @MaxLength(120)
  email?: string;

  @IsOptional() @IsString() @MaxLength(100)
  specialty?: string;
}

export class UpdateTeacherDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80)
  firstName?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(80)
  lastName?: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string | null;

  @IsOptional() @IsEmail() @MaxLength(120)
  email?: string | null;

  @IsOptional() @IsString() @MaxLength(100)
  specialty?: string | null;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class CreateSubjectDto {
  @IsString() @MinLength(1) @MaxLength(100)
  name!: string;

  @IsString() @MinLength(1) @MaxLength(20)
  code!: string;
}

export class UpdateSubjectDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100)
  name?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(20)
  code?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class CreateTeachingAssignmentDto {
  @IsString()
  classId!: string;

  @IsString()
  subjectId!: string;

  @IsString()
  teacherId!: string;
}
