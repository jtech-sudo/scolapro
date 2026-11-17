import { OnlineEnrollmentStatus } from '@prisma/client';
import { IsDateString, IsEmail, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SubmitOnlineEnrollmentDto {
  @IsString() @MinLength(1) @MaxLength(80)
  firstName!: string;

  @IsString() @MinLength(1) @MaxLength(80)
  lastName!: string;

  @IsOptional() @IsDateString()
  dateOfBirth?: string;

  @IsOptional() @IsIn(['F', 'M', 'OTHER'])
  sex?: string;

  @IsString() @MinLength(1)
  classId!: string;

  @IsString() @MinLength(1) @MaxLength(80)
  guardianFirstName!: string;

  @IsString() @MinLength(1) @MaxLength(80)
  guardianLastName!: string;

  @IsString() @MinLength(6) @MaxLength(30)
  guardianPhone!: string;

  @IsOptional() @IsEmail() @MaxLength(120)
  guardianEmail?: string;

  @IsOptional() @IsString() @MaxLength(180)
  guardianAddress?: string;

  @IsString() @MinLength(2) @MaxLength(40)
  relationship!: string;
}

export class ReviewOnlineEnrollmentDto {
  @IsEnum(OnlineEnrollmentStatus)
  status!: OnlineEnrollmentStatus;

  @IsOptional() @IsString() @MaxLength(1000)
  reviewNote?: string;
}
