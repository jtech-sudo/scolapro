import { Type } from 'class-transformer';
import { UserRole } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const ADMIN_MODULES = [
  'administration',
  'school-year',
  'people',
  'grades',
  'timetable',
  'teaching-documents',
  'report-cards',
  'attendance',
  'library',
  'billing',
  'finance',
  'statistics',
  'parent-portal',
  'security',
  'communication',
  'transport',
  'personnel',
  'documents',
  'online-enrollment',
] as const;

export type AdminModuleKey = (typeof ADMIN_MODULES)[number];

export class UpdateSchoolProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  name?: string;

  @IsOptional() @IsString() @MinLength(2) @MaxLength(80)
  shortName?: string;

  @IsOptional() @IsString() @MaxLength(180)
  address?: string | null;

  @IsOptional() @IsString() @MaxLength(80)
  city?: string;

  @IsOptional() @IsString() @MaxLength(80)
  country?: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string | null;

  @IsOptional() @IsEmail() @MaxLength(120)
  email?: string | null;

  @IsOptional() @IsUrl({ require_tld: false }) @MaxLength(160)
  website?: string | null;

  @IsOptional() @IsString() @MaxLength(80)
  registrationId?: string | null;

  @IsOptional() @IsString() @MaxLength(90_000) @Matches(/^(?:$|data:image\/(?:png|jpeg|webp);base64,)/i)
  logoDataUrl?: string | null;

  @IsOptional() @IsString() @MaxLength(3)
  currency?: string;

  @IsOptional() @IsString() @MaxLength(5)
  language?: string;
}

export class RolePermissionEntryDto {
  @IsEnum(UserRole)
  role!: UserRole;

  @IsIn(ADMIN_MODULES)
  module!: AdminModuleKey;

  @IsBoolean() canView!: boolean;
  @IsBoolean() canCreate!: boolean;
  @IsBoolean() canUpdate!: boolean;
  @IsBoolean() canDelete!: boolean;
}

export class SaveRolePermissionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RolePermissionEntryDto)
  permissions!: RolePermissionEntryDto[];
}

export class UpdateUserRoleDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ResetUserPasswordDto {
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,128}$/, { message: 'Le mot de passe doit contenir 12 caractères, une majuscule, une minuscule et un chiffre.' })
  password!: string;
}