import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AcademicsModule } from './academics/academics.module';
import { AdministrationModule } from './administration/administration.module';
import { AttendanceModule } from './attendance/attendance.module';
import { StatisticsModule } from './statistics/statistics.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { DatabaseModule } from './database/database.module';
import { FinanceModule } from './finance/finance.module';
import { OrganizationModule } from './organization/organization.module';
import { ParentPortalModule } from './parent-portal/parent-portal.module';
import { ReportCardsModule } from './report-cards/report-cards.module';
import { SchoolStructureModule } from './school-structure/school-structure.module';
import { StudentsModule } from './students/students.module';
import { HealthController } from './health.controller';
import { LibraryModule } from './library/library.module';
import { TimetableModule } from './timetable/timetable.module';
import { TransportModule } from './transport/transport.module';
import { PersonnelModule } from './personnel/personnel.module';
import { OnlineEnrollmentModule } from './online-enrollment/online-enrollment.module';
import { TenantAuthMiddleware } from './auth/tenant-auth.middleware';

@Module({
  imports: [DatabaseModule, AuthModule, AcademicsModule, AdministrationModule, AttendanceModule, BillingModule, FinanceModule, LibraryModule, OrganizationModule, ParentPortalModule, ReportCardsModule, SchoolStructureModule, StatisticsModule, StudentsModule, TimetableModule, TransportModule, PersonnelModule, OnlineEnrollmentModule],
  controllers: [HealthController],
  providers: [TenantAuthMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantAuthMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
