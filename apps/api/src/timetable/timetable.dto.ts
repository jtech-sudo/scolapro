import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateTimetableEntryDto {
  @IsString()
  @MinLength(1)
  assignmentId!: string;

  @IsInt()
  @Min(1)
  @Max(6)
  dayOfWeek!: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startsAt!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  room?: string;
}
