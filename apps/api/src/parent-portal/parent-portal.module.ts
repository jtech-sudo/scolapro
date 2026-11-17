import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ParentPortalController } from './parent-portal.controller';
import { ParentPortalService } from './parent-portal.service';
import { CommunicationController } from './communication.controller';

@Module({
  imports: [AuthModule],
  controllers: [ParentPortalController, CommunicationController],
  providers: [ParentPortalService],
})
export class ParentPortalModule {}