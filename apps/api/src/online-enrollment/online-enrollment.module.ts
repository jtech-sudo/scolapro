import { Module } from '@nestjs/common';
import { OnlineEnrollmentController } from './online-enrollment.controller';
import { OnlineEnrollmentMailerService } from './online-enrollment-mailer.service';
import { OnlineEnrollmentService } from './online-enrollment.service';

@Module({
  controllers: [OnlineEnrollmentController],
  providers: [OnlineEnrollmentMailerService, OnlineEnrollmentService],
})
export class OnlineEnrollmentModule {}
