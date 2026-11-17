import { useEffect, useState } from 'react';
import { AdminUser, apiRequest, USER_ROLES, UserRole } from './api';
import { getSchoolColorStyle } from './schoolColors';

type SchoolRef = { id: string; name: string };
type PlatformSchoolUser = AdminUser & { schoolId: string; schoolName: string };

const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Administrateur',
  DIRECTOR: 'Directeur',
  SECRETARIAT: 'Secrétariat',
  PEDAGOGICAL_MANAGER: 'Responsable pédagogique',
  TEACHER: 'Enseignant',
  ACCOUNTANT: 'Comptable',
  CASHIER: 'Caissier',
  PARENT: 'Parent',
};

export function PlatformUsers({ schools }: { schools: SchoolRef[] }) {
  const [users, setUsers] = useState<PlatformSchoolUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function refreshUsers() {
    setError('');
    const results = await Promise.all(schools.map(async (school) => {
      const members = await apiRequest<AdminUser[]>(`/platform/schools/${school.id}/administration/users`);
      return members.map((member) => ({ ...member, schoolId: school.id, schoolName: school.name }));
    }));
    setUsers(results.flat().sort((left, right) =>
      left.schoolName.localeCompare(right.schoolName, 'fr') || left.fullName.localeCompare(right.fullName, 'fr'),
    ));
  }

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void refreshUsers()
      .catch((requestError) => {
        if (mounted) setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les comptes.');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [schools]);

  async function updateUser(user: PlatformSchoolUser, updates: Pick<PlatformSchoolUser, 'role' | 'isActive'>) {
    setError('');
    try {
      const saved = await apiRequest<AdminUser>(`/platform/schools/${user.schoolId}/administration/users/${user.id}`, {
        method: 'PATCH',
        body: updates,
      });
      setUsers((current) => current.map((item) => item.id === saved.id && item.schoolId === user.schoolId
        ? { ...item, role: saved.role, isActive: saved.isActive }
        : item));
      return saved;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de modifier ce compte.');
      throw requestError;
    }
  }

  return <section className="platform-table-card platform-admin-page" id="users">
    <div className="platform-table-heading"><div><span className="platform-section-kicker">ACCÈS AUX ÉCOLES</span><h2>Utilisateurs</h2><p>Consultez les membres et gérez leur rôle ou leur accès dans chaque école.</p></div><button className="platform-refresh" type="button" onClick={() => { setLoading(true); void refreshUsers().catch((e) => setError(e instanceof Error ? e.message : 'Actualisation impossible.')).finally(() => setLoading(false)); }}>↻ Actualiser</button></div>
    {error && <p className="platform-admin-feedback" role="alert">{error}</p>}
    {loading ? <p className="platform-empty">Chargement des comptes…</p> : !users.length ? <p className="platform-empty">Aucun compte d’école trouvé.</p> :     <div className="platform-admin-table-wrap"><table className="platform-admin-table"><thead><tr><th>Utilisateur</th><th>École</th><th>Rôle</th><th>Accès</th></tr></thead><tbody>{users.map((user) => <UserRow key={`${user.schoolId}:${user.id}`} user={user} schools={schools} onUpdate={(updates) => updateUser(user, updates)} />)}</tbody></table></div>}
  </section>;
}

function UserRow({ user, schools, onUpdate }: { user: PlatformSchoolUser; schools: SchoolRef[]; onUpdate: (updates: Pick<PlatformSchoolUser, 'role' | 'isActive'>) => Promise<AdminUser> }) {
  const [role, setRole] = useState(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
  const [saving, setSaving] = useState(false);
  const schoolIds = schools.map(({ id }) => id);

  useEffect(() => {
    setRole(user.role);
    setIsActive(user.isActive);
  }, [user.role, user.isActive]);

  async function saveRole(value: string) {
    if (!USER_ROLES.includes(value as UserRole)) return;
    const nextRole = value as UserRole;
    setRole(nextRole);
    setSaving(true);
    try {
      await onUpdate({ role: nextRole, isActive });
    } catch {
      setRole(user.role);
    } finally { setSaving(false); }
  }

  async function toggleAccess() {
    const next = !isActive;
    setIsActive(next);
    setSaving(true);
    try {
      await onUpdate({ role, isActive: next });
    } catch {
      setIsActive(user.isActive);
    } finally { setSaving(false); }
  }

  return <tr>
    <td><strong>{user.fullName}</strong><small>{user.email ?? user.phone ?? 'Coordonnées non renseignées'}</small></td>
    <td><span className="platform-user-school"><i className="platform-school-symbol" style={getSchoolColorStyle(user.schoolId, schoolIds)} aria-hidden="true">{user.schoolName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('fr')}</i>{user.schoolName}</span></td>
    <td><select aria-label={`Rôle de ${user.fullName}`} value={role} disabled={saving} onChange={(event) => saveRole(event.target.value)}>{USER_ROLES.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select></td>
    <td><button className={`platform-user-access ${isActive ? 'enabled' : 'disabled'}`} type="button" disabled={saving} onClick={toggleAccess}>{saving ? 'Enregistrement…' : isActive ? 'Actif · Désactiver' : 'Inactif · Réactiver'}</button></td>
  </tr>;
}
