import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const decimalAmountPattern = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

export class CreateExpenseCategoryDto {
  @IsString() @MinLength(1) @MaxLength(80)
  name!: string;

  @IsOptional() @IsString() @MaxLength(240)
  description?: string;
}

export class UpdateExpenseCategoryDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80)
  name?: string;

  @IsOptional() @IsString() @MaxLength(240)
  description?: string | null;

  @IsOptional() @Type(() => Boolean)
  isActive?: boolean;
}

export class CreateExpenseDto {
  @IsString()
  categoryId!: string;

  @IsString()
  schoolYearId!: string;

  @IsString() @MinLength(2) @MaxLength(240)
  description!: string;

  @Matches(decimalAmountPattern, { message: 'Le montant doit être positif et comporter au plus deux décimales.' })
  amount!: string;

  @IsDateString()
  spentAt!: string;

  @IsString() @MinLength(2) @MaxLength(40)
  paymentMethod!: string;

  @IsOptional() @IsString() @MaxLength(120)
  payee?: string;
}

export class ListExpensesDto {
  @IsOptional() @IsString()
  schoolYearId?: string;

  @IsOptional() @IsString()
  categoryId?: string;

  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;
}

export class CancelExpenseDto {
  @IsString() @MinLength(5) @MaxLength(240)
  reason!: string;
}