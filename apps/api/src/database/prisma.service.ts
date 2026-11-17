import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantContextService } from './tenant-context.service';

const TENANT_MODELS = new Set([
  'SchoolProfile', 'RolePermission', 'PortalSettings', 'SchoolYear', 'Term', 'Level', 'SchoolClass',
  'Student', 'Enrollment', 'AttendanceSession', 'AttendanceRecord', 'Subject', 'Guardian', 'ParentAccount',
  'PortalNotice', 'StudentGuardian', 'Teacher', 'TeachingAssignment', 'Assessment', 'Grade',
  'TransportRoute', 'TransportStop', 'TransportStudent',
  'StaffMember', 'StaffLeave',
  'OnlineEnrollmentRequest',
  'StudentExamAccount', 'StudentExamQuestion', 'StudentExamChoice', 'StudentExamAttempt', 'StudentExamAnswer', 'TimetableEntry',
  'ReportCardRule', 'ReportCard', 'AssessmentRule', 'FeeType', 'ExpenseCategory', 'Expense', 'Invoice',
  'InvoiceInstallment', 'Payment', 'PaymentAllocation', 'AuditLog', 'LibraryBook', 'LibraryLoan',
]);

const RELATION_WRITE_KEYS = new Set([
  'connect', 'connectOrCreate', 'create', 'createMany', 'update', 'updateMany', 'upsert', 'set',
  'disconnect', 'disconnectMany', 'delete', 'deleteMany',
]);
const PRISMA_QUERY_KEYS = new Set(['where', 'select', 'include', 'orderBy', 'cursor', 'take', 'skip']);
const RELATION_WRAPPER_KEYS = new Set(['createMany', 'connectOrCreate', 'updateMany', 'upsert']);

export function addTenantToCreate(data: unknown, schoolId: string, relationWrapper = false, enforceTenantId = false): unknown {
  if (Array.isArray(data)) return data.map((item) => addTenantToCreate(item, schoolId, false, enforceTenantId));
  if (!data || typeof data !== 'object') return data;
  if (Object.getPrototypeOf(data) !== Object.prototype) return data;

  const output: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  const hasRelationWrite = Object.keys(output).some((key) => RELATION_WRITE_KEYS.has(key));

  for (const [key, value] of Object.entries(output)) {
    if (value === null || value === undefined) continue;
    if (key === 'connect' || key === 'disconnect' || key === 'set' || key === 'update' || PRISMA_QUERY_KEYS.has(key)) continue;
    if (relationWrapper && key === 'data' && !Array.isArray(value)) continue;
    if (typeof value === 'object') {
      output[key] = addTenantToCreate(value, schoolId, RELATION_WRAPPER_KEYS.has(key), false);
    }
  }

  if (!relationWrapper && enforceTenantId) {
    output.schoolId = schoolId;
  } else if (!relationWrapper && !hasRelationWrite && !('schoolId' in output)) {
    output.schoolId = schoolId;
  }

  return output;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(private readonly tenantContext: TenantContextService) {
    super();
    const extended = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!model || !TENANT_MODELS.has(model)) return query(args);
            const schoolId = tenantContext.schoolId();
            if (!schoolId) throw new Error(`Tenant context is required for ${model}.${operation}`);

            const tenantArgs = { ...(args as Record<string, unknown>) };
            if (['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(operation)) {
              tenantArgs.where = { ...((tenantArgs.where as Record<string, unknown> | undefined) ?? {}), schoolId };
            }
            if (['create', 'update', 'updateMany', 'upsert', 'createMany'].includes(operation) && tenantArgs.data) {
              tenantArgs.data = addTenantToCreate(tenantArgs.data, schoolId, false, true);
            }
            if (operation === 'upsert' && tenantArgs.create) {
              tenantArgs.create = addTenantToCreate(tenantArgs.create, schoolId, false, true);
            }
            return query(tenantArgs as typeof args);
          },
        },
      },
    });
    return new Proxy(extended as unknown as this, {
      get(target, property, receiver) {
        if (property === 'onModuleDestroy') return () => extended.$disconnect();
        return Reflect.get(target, property, receiver);
      },
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}