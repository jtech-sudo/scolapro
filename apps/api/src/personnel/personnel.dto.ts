import { StaffLeaveStatus } from '@prisma/client';
import { IsBoolean, IsDateString, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateStaffMemberDto {
  @IsString() @MinLength(1) @MaxLength(80)
  firstName!: string;

  @IsString() @MinLength(1) @MaxLength(80)
  lastName!: string;

  @IsString() @MinLength(2) @MaxLength(100)
  position!: string;

  @IsOptional() @IsString() @MaxLength(30)
  employeeNumber?: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @IsOptional() @IsEmail() @MaxLength(120)
  email?: string;

  @IsOptional() @IsString() @MaxLength(60)
  contractType?: string;

  @IsOptional() @IsDateString()
  hiredAt?: string;
}

export class UpdateStaffMemberDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(30)
  employeeNumber?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(80)
  firstName?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(80)
  lastName?: string;

  @IsOptional() @IsString() @MinLength(2) @MaxLength(100)
  position?: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string | null;

  @IsOptional() @IsEmail() @MaxLength(120)
  email?: string | null;

  @IsOptional() @IsString() @MaxLength(60)
  contractType?: string | null;

  @IsOptional() @IsDateString()
  hiredAt?: string | null;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class CreateStaffLeaveDto {
  @IsDateString()
  startsOn!: string;

  @IsDateString()
  endsOn!: string;

  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

export class ReviewStaffLeaveDto {
  @IsEnum(StaffLeaveStatus)
  status!: StaffLeaveStatus;
}
