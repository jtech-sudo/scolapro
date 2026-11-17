import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const decimalAmountPattern = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
export const PAYMENT_METHODS = [
  'CASH',
  'BANK_TRANSFER',
  'CHEQUE',
  'AIRTEL_MONEY',
  'MOOV_MONEY',
  'ZAMANI_CASH',
  'WESTERN_UNION',
  'MONEYGRAM',
  'OTHER',
] as const;

export class CreateFeeTypeDto {
  @IsString() @MinLength(1) @MaxLength(80)
  name!: string;

  @IsOptional() @IsString() @MaxLength(240)
  description?: string;
}

export class UpdateFeeTypeDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80)
  name?: string;

  @IsOptional() @IsString() @MaxLength(240)
  description?: string | null;

  @IsOptional() @Type(() => Boolean)
  isActive?: boolean;
}

export class ListInvoicesDto {
  @IsOptional() @IsString()
  schoolYearId?: string;

  @IsOptional() @IsString()
  studentId?: string;

  @IsOptional() @IsString()
  search?: string;
}

export class ListPaymentsDto {
  @IsOptional() @IsString()
  schoolYearId?: string;

  @IsOptional() @IsString()
  studentId?: string;
}

export class CreateInvoiceDto {
  @IsString()
  studentId!: string;

  @IsString()
  feeTypeId!: string;

  @IsString()
  schoolYearId!: string;

  @Matches(decimalAmountPattern, { message: 'Le montant doit être positif et comporter au plus deux décimales.' })
  amountDue!: string;

  @IsOptional() @IsDateString()
  dueDate?: string;
}

export class CreateInstallmentDto {
  @IsString() @MinLength(1) @MaxLength(80)
  label!: string;

  @Matches(decimalAmountPattern, { message: 'Le montant de l’échéance doit comporter au plus deux décimales.' })
  amount!: string;

  @IsDateString()
  dueDate!: string;
}

export class CreatePaymentAllocationDto {
  @IsString()
  invoiceId!: string;

  @Matches(decimalAmountPattern, { message: 'Le montant affecté doit comporter au plus deux décimales.' })
  amount!: string;
}

export class CreatePaymentDto {
  @Matches(decimalAmountPattern, { message: 'Le montant doit comporter au plus deux décimales.' })
  amount!: string;

  @IsIn(PAYMENT_METHODS)
  method!: string;

  @IsOptional() @IsString() @MaxLength(100)
  providerReference?: string;

  @IsOptional() @IsDateString()
  receivedAt?: string;

  @IsOptional() @IsString() @MaxLength(100)
  recordedById?: string;

  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true }) @Type(() => CreatePaymentAllocationDto)
  allocations!: CreatePaymentAllocationDto[];
}

export class CancelPaymentDto {
  @IsString() @MinLength(5) @MaxLength(240)
  reason!: string;
}