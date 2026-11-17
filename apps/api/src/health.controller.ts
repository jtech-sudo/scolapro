import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      application: 'CSP Nouvel Espoir de Galmi',
      apiVersion: 'v1',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async getReadiness() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ready', database: 'connected' };
  }
}
