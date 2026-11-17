import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { OnlineEnrollmentService } from './online-enrollment.service';
import { ReviewOnlineEnrollmentDto, SubmitOnlineEnrollmentDto } from './online-enrollment.dto';

@Controller('online-enrollment')
export class OnlineEnrollmentController {
  constructor(private readonly enrollment: OnlineEnrollmentService) {}

  @Get('public/:schoolSlug')
  getPublicForm(@Param('schoolSlug') schoolSlug: string) {
    return this.enrollment.getPublicForm(schoolSlug);
  }

  @Post('public/:schoolSlug')
  submitPublicRequest(@Param('schoolSlug') schoolSlug: string, @Body() dto: SubmitOnlineEnrollmentDto) {
    return this.enrollment.submitPublicRequest(schoolSlug, dto);
  }

  @Get('requests')
  listRequests() {
    return this.enrollment.listRequests();
  }

  @Patch('requests/:id/review')
  reviewRequest(@Param('id') id: string, @Body() dto: ReviewOnlineEnrollmentDto) {
    return this.enrollment.reviewRequest(id, dto);
  }

  @Post('requests/:id/enroll')
  enrollRequest(@Param('id') id: string) {
    return this.enrollment.enrollRequest(id);
  }

  @Post('requests/:id/notify')
  notifyRequest(@Param('id') id: string) {
    return this.enrollment.notifyRequest(id);
  }
}
