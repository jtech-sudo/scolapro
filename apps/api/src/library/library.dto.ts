import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateLibraryBookDto {
  @IsString() @MinLength(1) @MaxLength(160)
  title!: string;

  @IsOptional() @IsString() @MaxLength(120)
  author?: string;

  @IsOptional() @IsString() @MaxLength(32)
  isbn?: string;

  @IsOptional() @IsString() @MaxLength(80)
  category?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000)
  totalCopies = 1;
}

export class UpdateLibraryBookDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160)
  title?: string;

  @IsOptional() @IsString() @MaxLength(120)
  author?: string | null;

  @IsOptional() @IsString() @MaxLength(32)
  isbn?: string | null;

  @IsOptional() @IsString() @MaxLength(80)
  category?: string | null;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000)
  totalCopies?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class ListLibraryBooksDto {
  @IsOptional() @IsString() @MaxLength(120)
  search?: string;
}

export class ListLibraryLoansDto {
  @IsOptional() @IsIn(['BORROWED', 'RETURNED'])
  status?: 'BORROWED' | 'RETURNED';
}

export class CreateLibraryLoanDto {
  @IsString()
  bookId!: string;

  @IsString()
  studentId!: string;

  @IsDateString()
  dueAt!: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}
