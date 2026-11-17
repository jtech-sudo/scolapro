import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export type TenantContext = { schoolId: string; userId?: string; role?: string };

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContext>();

  run<T>(context: TenantContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  current(): TenantContext | undefined {
    return this.storage.getStore();
  }

  schoolId(): string | undefined {
    return this.storage.getStore()?.schoolId;
  }
}
