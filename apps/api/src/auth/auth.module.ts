import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { AuthController, PlatformController, SchoolSubscriptionController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: { expiresIn: '8h', issuer: 'csp-nouvel-espoir' },
        verifyOptions: { issuer: 'csp-nouvel-espoir' },
      }),
    }),
  ],
  controllers: [AuthController, PlatformController, SchoolSubscriptionController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
