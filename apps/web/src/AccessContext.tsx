import { createContext, ReactNode, useContext } from 'react';
import { AdminModuleKey, ModulePermission, UserRole } from './api';

type PermissionAction = 'canView' | 'canCreate' | 'canUpdate' | 'canDelete';
type AccessContextValue = {
  can: (module: AdminModuleKey, action: PermissionAction) => boolean;
};

const AccessContext = createContext<AccessContextValue>({
  can: () => false,
});

export function AccessProvider({ role, permissions, children }: {
  role: UserRole;
  permissions: ModulePermission[];
  children: ReactNode;
}) {
  const can = (module: AdminModuleKey, action: PermissionAction) => {
    if (role === 'ADMIN') return true;
    return permissions.find((permission) => permission.module === module)?.[action] ?? false;
  };
  return <AccessContext.Provider value={{ can }}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  return useContext(AccessContext);
}
