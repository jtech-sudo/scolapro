import { Module } from '@nestjs/common';
import { SchoolStructureController } from './school-structure.controller';
import { SchoolStructureService } from './school-structure.service';

@Module({
  controllers: [SchoolStructureController],
  providers: [SchoolStructureService],
})
export class SchoolStructureModule {}