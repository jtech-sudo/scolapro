import { SubscriptionPaymentMethod, SubscriptionPlan, SubscriptionPlanRequestStatus, SubscriptionStatus, UserRole } from '@prisma/client';
import { IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePlatformSchoolDto {
  @IsString() @MinLength(2) @MaxLength(120)
  schoolName!: string;

  @IsString() @MinLength(2) @MaxLength(100)
  adminFullName!: string;

  @IsEmail() @MaxLength(160)
  adminEmail!: string;

  @IsString() @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,128}$/, { message: 'Le mot de passe doit contenir 12 caractères, une majuscule, une minuscule et un chiffre.' })
  adminPassword!: string;
}

export class PlatformAdminLoginDto {
  @IsEmail() @MaxLength(160)
  email!: string;

  @IsString() @MinLength(1) @MaxLength(128)
  password!: string;
}

export class UpdatePlatformSchoolStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class UpdateSchoolSubscriptionDto {
  @IsEnum(SubscriptionPlan)
  subscriptionPlan!: SubscriptionPlan;

  @IsEnum(SubscriptionStatus)
  subscriptionStatus!: SubscriptionStatus;

  @IsInt() @Min(0) @Max(1000000)
  monthlyFee!: number;

  @IsOptional() @IsDateString()
  subscriptionRenewalAt?: string | null;
}

export class UpdatePlatformPlanDto {
  @IsInt() @Min(0) @Max(1000000)
  monthlyFee!: number;
}

export class RequestSchoolSubscriptionPlanDto {
  @IsEnum(SubscriptionPlan)
  plan!: SubscriptionPlan;
}

export class ReviewSchoolSubscriptionPlanRequestDto {
  @IsEnum(SubscriptionPlanRequestStatus)
  status!: SubscriptionPlanRequestStatus;
}

export class CreatePlatformSubscriptionPaymentDto {
  @IsString() @MinLength(1) @MaxLength(64)
  schoolId!: string;

  @IsInt() @Min(1) @Max(100000000)
  amount!: number;

  @IsDateString()
  paidAt!: string;

  @IsString() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'La période doit être au format AAAA-MM.' })
  period!: string;

  @IsEnum(SubscriptionPaymentMethod)
  method!: SubscriptionPaymentMethod;

  @IsOptional() @IsString() @MaxLength(120)
  reference?: string;

  @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}

export class ResetPlatformSchoolAdminPasswordDto {
  @IsString() @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,128}$/, { message: 'Le mot de passe doit contenir 12 caractères, une majuscule, une minuscule et un chiffre.' })
  password!: string;
}

export class BootstrapPlatformAdminDto {
  @IsString() @MinLength(32) @MaxLength(256)
  bootstrapKey!: string;

  @IsString() @MinLength(2) @MaxLength(100)
  fullName!: string;

  @IsEmail() @MaxLength(160)
  email!: string;

  @IsString() @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,128}$/, { message: 'Le mot de passe doit contenir 12 caractères, une majuscule, une minuscule et un chiffre.' })
  password!: string;
}

export class LoginDto {
  @IsString() @MinLength(2) @MaxLength(100)
  schoolSlug!: string;

  @IsEmail() @MaxLength(160)
  email!: string;

  @IsString() @MinLength(1) @MaxLength(128)
  password!: string;
}

export class CreateSchoolMembershipDto {
  @IsEmail() @MaxLength(160)
  email!: string;

  @IsEnum(UserRole)
  role!: UserRole;
}