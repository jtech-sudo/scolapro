import { PortalNoticeStatus } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ParentPortalLoginDto {
  @IsString() @MinLength(2) @MaxLength(100)
  schoolSlug!: string;

  @IsEmail() @MaxLength(160)
  email!: string;

  @IsString() @MinLength(1) @MaxLength(128)
  password!: string;
}

export class CreateParentAccountDto {
  @IsString()
  guardianId!: string;

  @IsString() @MinLength(2) @MaxLength(100)
  fullName!: string;

  @IsEmail() @MaxLength(160)
  email!: string;

  @IsString() @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,128}$/, { message: 'Le mot de passe doit contenir 12 caractères, une majuscule, une minuscule et un chiffre.' })
  password!: string;
}

export class UpdatePortalSettingsDto {
  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @IsBoolean()
  showGrades?: boolean;

  @IsOptional() @IsBoolean()
  showReportCards?: boolean;

  @IsOptional() @IsBoolean()
  showBilling?: boolean;

  @IsOptional() @IsBoolean()
  showAttendance?: boolean;

  @IsOptional() @IsBoolean()
  allowGuardianMessages?: boolean;

  @IsOptional() @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional() @IsBoolean()
  smsNotifications?: boolean;
}

export class LinkParentAccountDto {
  @IsString()
  guardianId!: string;

  @IsString()
  userId!: string;
}

export class CreatePortalNoticeDto {
  @IsString() @MinLength(3) @MaxLength(120)
  title!: string;

  @IsString() @MinLength(3) @MaxLength(4000)
  body!: string;

  @IsOptional() @IsString()
  guardianId?: string;
}

export class UpdatePortalNoticeDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(120)
  title?: string;

  @IsOptional() @IsString() @MinLength(3) @MaxLength(4000)
  body?: string;

  @IsOptional() @IsEnum(PortalNoticeStatus)
  status?: PortalNoticeStatus;
}