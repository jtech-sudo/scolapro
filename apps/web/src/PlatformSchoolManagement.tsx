import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { ADMIN_MODULES, AdminModuleKey, AdminUser, apiRequest, RolePermission, SchoolProfile, setAuthToken, USER_ROLES, UserRole } from './api';

type PlatformSchoolRef = { id: string; name: string; slug: string };
type PlatformMember = AdminUser & { membershipId: string };
type Tab = 'profile' | 'users' | 'permissions';
type ProfileForm = Omit<SchoolProfile, 'id' | 'updatedAt' | 'address' | 'phone' | 'email' | 'website' | 'registrationId'> & {
  address: string;
  phone: string;
  email: string;
  website: string;
  registrationId: string;
};

const moduleNames: Record<AdminModuleKey, string> = {
  administration: 'Administration', 'school-year': 'Années et classes', people: 'Gestion scolarité',
  grades: 'Devoir', timetable: 'Emploi du temps', 'report-cards': 'Bulletins', attendance: 'Présences',
  'teaching-documents': 'Supports enseignants',
  library: 'Bibliothèque',
  billing: 'Facture', finance: 'Finance et comptabilité',
  statistics: 'Statistiques et rapport journalier',
  'parent-portal': 'Portail parents', security: 'Sécurité et archives',
  communication: 'Communication aux familles', transport: 'Transport scolaire',
  personnel: 'Gestion du personnel', documents: 'Documents et certificats',
  'online-enrollment': 'Inscriptions en ligne',
};
const roleNames: Record<UserRole, string> = {
  ADMIN: 'Administrateur', DIRECTOR: 'Direction', SECRETARIAT: 'Secrétariat',
  PEDAGOGICAL_MANAGER: 'Responsable pédagogique', TEACHER: 'Enseignant',
  ACCOUNTANT: 'Comptable', CASHIER: 'Caissier', PARENT: 'Parent',
};
const emptyProfile: ProfileForm = {
  name: '', shortName: '', address: '', city: '', country: 'Niger', phone: '', email: '',
  website: '', registrationId: '', logoDataUrl: '', currency: 'XOF', language: 'fr',
};

export function PlatformSchoolManagement({ school, onClose, onResetPassword }: {
  school: PlatformSchoolRef;
  onClose: () => void;
  onResetPassword: (school: PlatformSchoolRef, user: AdminUser) => void;
}) {
  const [tab, setTab] = useState<Tab>('profile');
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile);
  const [members, setMembers] = useState<PlatformMember[]>([]);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [selectedRole, setSelectedRole] = useState<UserRole>('ADMIN');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openingWorkspace, setOpeningWorkspace] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const base = `/platform/schools/${school.id}/administration`;

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [profileData, userData, permissionData] = await Promise.all([
        apiRequest<SchoolProfile>(`${base}/profile`),
        apiRequest<PlatformMember[]>(`${base}/users`),
        apiRequest<RolePermission[]>(`${base}/permissions`),
      ]);
      setProfile({
        name: profileData.name, shortName: profileData.shortName, address: profileData.address ?? '',
        city: profileData.city, country: profileData.country, phone: profileData.phone ?? '',
        email: profileData.email ?? '', website: profileData.website ?? '',
        registrationId: profileData.registrationId ?? '', logoDataUrl: profileData.logoDataUrl ?? '', currency: profileData.currency, language: profileData.language,
      });
      setMembers(userData);
      setPermissions(permissionData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de charger l’administration de cette école.');
    } finally { setLoading(false); }
  }

  async function openWorkspace() {
    setOpeningWorkspace(true);
    setError('');
    try {
      const session = await apiRequest<{ accessToken: string }>(`/platform/schools/${school.id}/access`, { method: 'POST' });
      setAuthToken(session.accessToken);
      window.location.assign('/');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’ouvrir cet espace école.');
      setOpeningWorkspace(false);
    }
  }

  useEffect(() => { void loadData(); }, [school.id]);

  function selectLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 64 * 1024) {
      setError('Choisissez un logo PNG, JPEG ou WebP de 64 Ko maximum.');
      event.target.value = '';
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setProfile((current) => ({ ...current, logoDataUrl: reader.result as string }));
    };
    reader.onerror = () => setError('Impossible de lire ce fichier image.');
    reader.readAsDataURL(file);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      await apiRequest(`${base}/profile`, { method: 'PUT', body: profile });
      setSuccess('Paramètres de l’établissement enregistrés.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’enregistrer le profil.');
    } finally { setSaving(false); }
  }

  async function savePermissions() {
    setSaving(true); setError(''); setSuccess('');
    try {
      await apiRequest(`${base}/permissions`, { method: 'PUT', body: { permissions: permissions.filter((item) => item.role === selectedRole) } });
      setSuccess(`Permissions de ${roleNames[selectedRole]} enregistrées.`);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’enregistrer les permissions.');
    } finally { setSaving(false); }
  }

  async function updateMember(user: PlatformMember, patch: Partial<Pick<PlatformMember, 'role' | 'isActive'>>) {
    setError(''); setSuccess('');
    try {
      await apiRequest(`${base}/users/${user.id}`, { method: 'PATCH', body: patch });
      setSuccess(`Accès de ${user.fullName} mis à jour.`);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de modifier ce compte.');
    }
  }

  function changePermission(module: AdminModuleKey, key: 'canView' | 'canCreate' | 'canUpdate' | 'canDelete', value: boolean) {
    setPermissions((current) => {
      const previous = current.find((item) => item.role === selectedRole && item.module === module);
      const permission = previous ?? { id: null, role: selectedRole, module, canView: false, canCreate: false, canUpdate: false, canDelete: false };
      const next = { ...permission, [key]: value, ...(key !== 'canView' && value ? { canView: true } : {}) };
      if (key === 'canView' && !value) { next.canCreate = false; next.canUpdate = false; next.canDelete = false; }
      return [...current.filter((item) => !(item.role === selectedRole && item.module === module)), next];
    });
  }

  const currentPermissions = ADMIN_MODULES.map((module) => {
    const saved = permissions.find((item) => item.role === selectedRole && item.module === module);
    if (selectedRole === 'ADMIN') return {
      id: saved?.id ?? null, role: selectedRole, module,
      canView: true, canCreate: true, canUpdate: true, canDelete: true, isDefault: saved?.isDefault,
    };
    return saved ?? {
      id: null, role: selectedRole, module,
      canView: false, canCreate: false, canUpdate: false, canDelete: false, isDefault: true,
    };
  });

  return <div className="school-modal-backdrop platform-management-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className="platform-management-dialog" role="dialog" aria-modal="true" aria-labelledby="platform-school-management-title">
      <header className="platform-management-header"><div><p className="platform-section-kicker">GESTION PAR L’ADMINISTRATEUR DE LA PLATEFORME</p><h2 id="platform-school-management-title">{school.name}</h2><small>{school.slug}</small></div><button type="button" className="school-modal-close" aria-label="Fermer" onClick={onClose}>×</button></header>
      <div className="platform-management-access"><span>Accès d’assistance temporaire, limité à cette école.</span><button type="button" disabled={openingWorkspace} onClick={() => void openWorkspace()}>{openingWorkspace ? 'Ouverture…' : 'Ouvrir l’espace école'} <span aria-hidden="true">↗</span></button></div>
      <nav className="organization-tabs platform-management-tabs" aria-label={`Administration de ${school.name}`}>
        {([['profile', 'Paramètres'], ['users', `Comptes (${members.length})`], ['permissions', 'Permissions']] as const).map(([id, label]) => <button key={id} type="button" className={tab === id ? 'organization-tab active' : 'organization-tab'} onClick={() => setTab(id)}>{label}</button>)}
      </nav>
      <div className="platform-management-body">
        {error && <div className="feedback-message error-message" role="alert">{error}</div>}
        {success && <div className="feedback-message success-message" role="status">{success}</div>}
        {loading ? <p className="inline-hint">Chargement de l’administration…</p> : <>
          {tab === 'profile' && <form className="platform-school-profile-form" onSubmit={(event) => void saveProfile(event)}>
            <div className="admin-fields-grid">
              <label className="field-label">Nom officiel<input required maxLength={120} value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label>
              <label className="field-label">Nom court<input required maxLength={80} value={profile.shortName} onChange={(event) => setProfile({ ...profile, shortName: event.target.value })} /></label>
              <label className="field-label">Ville<input required maxLength={80} value={profile.city} onChange={(event) => setProfile({ ...profile, city: event.target.value })} /></label>
              <label className="field-label">Pays<input required maxLength={80} value={profile.country} onChange={(event) => setProfile({ ...profile, country: event.target.value })} /></label>
              <label className="field-label">Téléphone<input type="tel" maxLength={30} value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label>
              <label className="field-label">Courriel<input type="email" maxLength={120} value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label>
              <label className="field-label">Adresse<input maxLength={180} value={profile.address} onChange={(event) => setProfile({ ...profile, address: event.target.value })} /></label>
              <label className="field-label">Site web<input type="url" maxLength={160} value={profile.website} onChange={(event) => setProfile({ ...profile, website: event.target.value })} /></label>
              <label className="field-label">Identifiant officiel<input maxLength={80} value={profile.registrationId} onChange={(event) => setProfile({ ...profile, registrationId: event.target.value })} /></label>
              <div className="field-label"><label htmlFor="platform-school-logo">Logo de l’établissement</label><input id="platform-school-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={selectLogo} /><small className="field-hint">PNG, JPEG ou WebP, 64 Ko maximum.</small>{profile.logoDataUrl && <div className="school-logo-preview"><img src={profile.logoDataUrl} alt={`Aperçu du logo ${profile.name}`} /><button type="button" className="table-action" onClick={() => setProfile({ ...profile, logoDataUrl: '' })}>Retirer le logo</button></div>}</div>
              <label className="field-label">Devise<select value={profile.currency} onChange={(event) => setProfile({ ...profile, currency: event.target.value })}><option value="XOF">Franc CFA BCEAO (XOF)</option><option value="EUR">Euro (EUR)</option><option value="USD">Dollar américain (USD)</option></select></label>
            </div>
            <button className="primary-button" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}</button>
          </form>}
          {tab === 'users' && <section className="platform-management-users"><p>Les rôles et accès aux comptes de cette école sont administrés centralement.</p>{members.length ? members.map((member) => <article className="platform-management-user" key={member.id}><span className="platform-user-avatar">{member.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('fr')}</span><span className="platform-management-user-copy"><strong>{member.fullName}</strong><small>{member.email ?? member.phone ?? 'Coordonnées à compléter'}</small></span><select aria-label={`Rôle de ${member.fullName}`} value={member.role} onChange={(event) => void updateMember(member, { role: event.target.value as UserRole })}>{USER_ROLES.map((role) => <option key={role} value={role}>{roleNames[role]}</option>)}</select><span className={`student-status ${member.isActive ? 'active' : 'archived'}`}>{member.isActive ? 'Actif' : 'Désactivé'}</span><button type="button" className="table-action" onClick={() => void updateMember(member, { isActive: !member.isActive })}>{member.isActive ? 'Désactiver' : 'Réactiver'}</button><button type="button" className="table-action password-reset-action" onClick={() => onResetPassword(school, member)}>Réinitialiser le mot de passe</button></article>) : <div className="list-empty"><strong>Aucun membre</strong><span>Cette école n’a pas encore de compte membre.</span></div>}</section>}
          {tab === 'permissions' && <section className="platform-management-permissions"><div className="permissions-toolbar"><div><strong>Permissions par rôle</strong><small>Choisissez les actions autorisées pour chaque rôle de cette école.</small>{selectedRole === 'ADMIN' && <small className="permission-admin-note">Le rôle Administrateur conserve tous les droits et ne peut pas être restreint.</small>}</div><label className="field-label">Rôle<select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as UserRole)}>{USER_ROLES.map((role) => <option key={role} value={role}>{roleNames[role]}</option>)}</select></label></div><div className="permissions-table-wrap"><table className="permissions-table"><thead><tr><th>Module</th><th>Voir</th><th>Créer</th><th>Modifier</th><th>Supprimer</th></tr></thead><tbody>{currentPermissions.map((permission) => <tr key={permission.module}><th scope="row">{moduleNames[permission.module]}</th>{(['canView', 'canCreate', 'canUpdate', 'canDelete'] as const).map((key) => <td key={key}><input type="checkbox" aria-label={`${moduleNames[permission.module]} ${key}`} checked={permission[key]} disabled={selectedRole === 'ADMIN' || (key !== 'canView' && !permission.canView)} onChange={(event) => changePermission(permission.module, key, event.target.checked)} /></td>)}</tr>)}</tbody></table></div><button className="primary-button permissions-save" onClick={() => void savePermissions()} disabled={saving || selectedRole === 'ADMIN'}>{saving ? 'Enregistrement…' : 'Enregistrer les permissions'}</button></section>}
        </>}
      </div>
    </section>
  </div>;
}
