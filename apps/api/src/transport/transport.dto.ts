import { TransportDirection } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateTransportRouteDto {
  @IsString() @MinLength(2) @MaxLength(100)
  name!: string;

  @IsEnum(TransportDirection)
  direction!: TransportDirection;

  @IsOptional() @IsString() @MaxLength(80)
  vehicle?: string;

  @IsOptional() @IsString() @MaxLength(30)
  vehiclePlate?: string;

  @IsOptional() @IsString() @MaxLength(120)
  driverName?: string;

  @IsInt() @Min(1) @Max(200)
  capacity!: number;
}

export class CreateTransportStopDto {
  @IsString() @MinLength(2) @MaxLength(120)
  name!: string;

  @IsOptional() @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  arrivalTime?: string;
}

export class AssignTransportStudentDto {
  @IsString() @MinLength(1)
  studentId!: string;

  @IsOptional() @IsString() @MinLength(1)
  stopId?: string;
}

export class UpdateTransportRouteDto {
  @IsOptional() @IsString() @MaxLength(80)
  vehicle?: string | null;

  @IsOptional() @IsString() @MaxLength(30)
  vehiclePlate?: string | null;

  @IsOptional() @IsString() @MaxLength(120)
  driverName?: string | null;

  @IsOptional() @IsInt() @Min(1) @Max(200)
  capacity?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
