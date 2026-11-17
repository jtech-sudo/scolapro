import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ADMIN_MODULES,
  AdminModuleKey,
  AdminUser,
  apiRequest,
  RolePermission,
  SchoolProfile,
  USER_ROLES,
  UserRole,
} from './api';

type Tab = 'school' | 'permissions' | 'users';

const roleLabels: Record<UserRole, string> = {
  ADMIN: 'Administrateur',
  DIRECTOR: 'Direction',
  SECRETARIAT: 'Secrétariat',
  PEDAGOGICAL_MANAGER: 'Responsable pédagogique',
  TEACHER: 'Enseignant',
  ACCOUNTANT: 'Comptable',
  CASHIER: 'Caissier',
  PARENT: 'Parent',
};

const moduleLabels: Record<AdminModuleKey, string> = {
  administration: 'Administration',
  'school-year': 'Années et classes',
  people: 'Gestion scolarité',
  grades: 'Devoir',
  timetable: 'Emploi du temps',
  'teaching-documents': 'Supports enseignants',
  'report-cards': 'Bulletins',
  attendance: 'Présences',
  library: 'Bibliothèque',
  billing: 'Facture',
  finance: 'Dépenses et rapports',
  statistics: 'Statistiques et rapport journalier',
  'parent-portal': 'Portail parents',
  security: 'Sécurité et archives',
  communication: 'Communication aux familles',
  transport: 'Transport scolaire',
  personnel: 'Gestion du personnel',
  documents: 'Documents et certificats',
  'online-enrollment': 'Demandes d’inscription en ligne',
};

const blankProfile = {
  name: '', shortName: '', address: '', city: '', country: 'Niger',
  phone: '', email: '', website: '', registrationId: '', currency: 'XOF', language: 'fr',
};

export function AdministrationPage({ onBack, canResetPasswords }: { onBack: () => void; canResetPasswords: boolean }) {
  const [tab, setTab] = useState<Tab>('school');
  const [profile, setProfile] = useState(blankProfile);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedRole, setSelectedRole] = useState<UserRole>('ADMIN');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resettingUser, setResettingUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [profileData, permissionData, userData] = await Promise.all([
        apiRequest<SchoolProfile>('/admin/school-profile'),
        apiRequest<RolePermission[]>('/admin/roles/permissions'),
        apiRequest<AdminUser[]>('/admin/users'),
      ]);
      setProfile({
        name: profileData.name,
        shortName: profileData.shortName,
        address: profileData.address ?? '',
        city: profileData.city,
        country: profileData.country,
        phone: profileData.phone ?? '',
        email: profileData.email ?? '',
        website: profileData.website ?? '',
        registrationId: profileData.registrationId ?? '',
        currency: profileData.currency,
        language: profileData.language,
      });
      setPermissions(permissionData);
      setUsers(userData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les paramètres administratifs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest<SchoolProfile>('/admin/school-profile', { method: 'PUT', body: profile });
      setSuccess('Les coordonnées de l’établissement ont été enregistrées.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’enregistrer les paramètres.');
    } finally { setSaving(false); }
  }

  function permissionFor(module: AdminModuleKey) {
    return permissions.find((permission) => permission.role === selectedRole && permission.module === module) ?? {
      id: null, role: selectedRole, module,
      canView: selectedRole === 'ADMIN', canCreate: selectedRole === 'ADMIN',
      canUpdate: selectedRole === 'ADMIN', canDelete: selectedRole === 'ADMIN', isDefault: true,
    };
  }

  function changePermission(module: AdminModuleKey, key: 'canView' | 'canCreate' | 'canUpdate' | 'canDelete', value: boolean) {
    setPermissions((current) => {
      const existing = current.find((permission) => permission.role === selectedRole && permission.module === module);
      const base = existing ?? permissionFor(module);
      const updated = { ...base, [key]: value, ...(key !== 'canView' && value ? { canView: true } : {}) };
      if (key === 'canView' && !value) {
        updated.canCreate = false;
        updated.canUpdate = false;
        updated.canDelete = false;
      }
      return [...current.filter((permission) => !(permission.role === selectedRole && permission.module === module)), updated];
    });
  }

  async function savePermissions() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const rolePermissions = permissions.filter((permission) => permission.role === selectedRole);
      await apiRequest('/admin/roles/permissions', { method: 'PUT', body: { permissions: rolePermissions } });
      setSuccess(`Droits de ${roleLabels[selectedRole]} enregistrés.`);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’enregistrer les droits.');
    } finally { setSaving(false); }
  }

  async function changeUser(id: string, patch: Partial<Pick<AdminUser, 'role' | 'isActive'>>) {
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/admin/users/${id}`, { method: 'PATCH', body: patch });
      setSuccess('Accès du compte mis à jour.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de modifier ce compte.');
    }
  }

  async function resetUserPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resettingUser || newPassword !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/admin/users/${resettingUser.id}/password`, { method: 'POST', body: { password: newPassword } });
      setSuccess(`Le mot de passe de ${resettingUser.fullName} a été réinitialisé.`);
      setResettingUser(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de réinitialiser ce mot de passe.');
    } finally { setSaving(false); }
  }

  const currentRolePermissions = useMemo(() => ADMIN_MODULES.map(permissionFor), [permissions, selectedRole]);
  const tabs: Array<[Tab, string]> = [['school', 'Établissement'], ['permissions', 'Rôles et permissions'], ['users', 'Comptes existants']];

  return (
    <section className="workspace-page">
      <button className="back-link" onClick={onBack}>← Retour à la vue générale</button>
      <div className="workspace-title-row"><div><p className="eyebrow">PARAMÈTRES ET ACCÈS</p><h1>Administration</h1><p>Configurez l’identité de l’école et préparez les rôles d’accès.</p></div><span className="module-count">{users.length} compte(s) existant(s)</span></div>
      <div className="admin-warning" role="note"><strong>Gestion des accès</strong><span>Les appartenances sont propres à cet établissement. Les changements de rôle et la réinitialisation de mot de passe sont réservés à l’administrateur et à la direction.</span></div>
      <nav className="organization-tabs" aria-label="Paramètres administratifs">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'organization-tab active' : 'organization-tab'} onClick={() => setTab(id)}>{label}</button>)}</nav>
      {error && <div className="feedback-message error-message" role="alert">{error}</div>}
      {success && <div className="feedback-message success-message" role="status">{success}</div>}
      {loading && <p className="inline-hint">Chargement des paramètres…</p>}

      {tab === 'school' && <form className="form-card admin-form" onSubmit={(event) => void saveProfile(event)}>
        <div className="admin-form-intro"><span className="module-number">01</span><div><strong>Identité de l’établissement</strong><small>Ces informations serviront aux documents et communications futurs.</small></div></div>
        <div className="admin-fields-grid">
          <Field label="Nom officiel"><input required maxLength={120} value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></Field>
          <Field label="Nom court"><input required maxLength={80} value={profile.shortName} onChange={(event) => setProfile({ ...profile, shortName: event.target.value })} /></Field>
          <Field label="Téléphone"><input type="tel" maxLength={30} value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} placeholder="+227…" /></Field>
          <Field label="Adresse courriel"><input type="email" maxLength={120} value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></Field>
          <Field label="Adresse"><input maxLength={180} value={profile.address} onChange={(event) => setProfile({ ...profile, address: event.target.value })} /></Field>
          <Field label="Ville"><input required maxLength={80} value={profile.city} onChange={(event) => setProfile({ ...profile, city: event.target.value })} /></Field>
          <Field label="Pays"><input required maxLength={80} value={profile.country} onChange={(event) => setProfile({ ...profile, country: event.target.value })} /></Field>
          <Field label="Site web"><input type="url" maxLength={160} value={profile.website} onChange={(event) => setProfile({ ...profile, website: event.target.value })} placeholder="https://…" /></Field>
          <Field label="Identifiant officiel"><input maxLength={80} value={profile.registrationId} onChange={(event) => setProfile({ ...profile, registrationId: event.target.value })} /></Field>
          <Field label="Devise"><select value={profile.currency} onChange={(event) => setProfile({ ...profile, currency: event.target.value })}><option value="XOF">Franc CFA BCEAO (XOF)</option><option value="EUR">Euro (EUR)</option><option value="USD">Dollar américain (USD)</option></select></Field>
          <Field label="Langue"><select value={profile.language} onChange={(event) => setProfile({ ...profile, language: event.target.value })}><option value="fr">Français</option><option value="en">English</option></select></Field>
        </div>
        <button className="primary-button admin-save" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}</button>
      </form>}

      {tab === 'permissions' && <section className="form-card permissions-card">
        <div className="permissions-toolbar"><div><strong>Matrice des permissions</strong><small>Les permissions configurées sont vérifiées pour les requêtes de l’établissement.</small></div><label className="field-label">Rôle<select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as UserRole)}>{USER_ROLES.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label></div>
        <div className="permissions-table-wrap"><table className="permissions-table"><thead><tr><th>Module</th><th>Voir</th><th>Créer</th><th>Modifier</th><th>Supprimer</th></tr></thead><tbody>{currentRolePermissions.map((permission) => <tr key={permission.module}><th scope="row">{moduleLabels[permission.module]}</th>{(['canView', 'canCreate', 'canUpdate', 'canDelete'] as const).map((key) => <td key={key}><input type="checkbox" aria-label={`${moduleLabels[permission.module]} : ${key}`} checked={permission[key]} disabled={key !== 'canView' && !permission.canView} onChange={(event) => changePermission(permission.module, key, event.target.checked)} /></td>)}</tr>)}</tbody></table></div>
        <div className="permissions-footer"><span>{currentRolePermissions.filter((permission) => permission.canView).length} module(s) visibles pour ce rôle</span><button className="primary-button permissions-save" onClick={() => void savePermissions()} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer les droits'}</button></div>
      </section>}

      {tab === 'users' && <section className="form-card users-card"><div className="users-heading"><div><strong>Comptes déjà enregistrés</strong><small>Les mots de passe ne sont jamais affichés. L’administrateur ou la direction peut en définir un nouveau.</small></div><span className="module-count">{users.filter((user) => user.isActive).length} actif(s)</span></div>
        {!users.length ? <div className="list-empty"><strong>Aucun compte utilisateur</strong><span>Les membres de cet établissement apparaîtront ici.</span></div> : <div className="student-table-wrap"><table className="student-table admin-users-table"><thead><tr><th>Utilisateur</th><th>Rôle</th><th>État</th><th>Créé le</th><th>Action</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.fullName}</strong><small>{user.email ?? user.phone ?? 'Coordonnées à compléter'}</small></td><td><select aria-label={`Rôle de ${user.fullName}`} value={user.role} onChange={(event) => void changeUser(user.id, { role: event.target.value as UserRole })}>{USER_ROLES.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></td><td><span className={`student-status ${user.isActive ? 'active' : 'archived'}`}>{user.isActive ? 'Actif' : 'Désactivé'}</span></td><td>{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(user.createdAt))}</td><td className="admin-user-actions"><button className="table-action" onClick={() => void changeUser(user.id, { isActive: !user.isActive })}>{user.isActive ? 'Désactiver' : 'Réactiver'}</button>{canResetPasswords && <button className="table-action password-reset-action" onClick={() => { setResettingUser(user); setNewPassword(''); setConfirmPassword(''); setError(''); setSuccess(''); }}>Réinitialiser le mot de passe</button>}</td></tr>)}</tbody></table></div>}
      </section>}
      {resettingUser && <div className="school-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setResettingUser(null); }}><section className="school-modal password-reset-modal" role="dialog" aria-modal="true" aria-labelledby="reset-password-title"><button type="button" className="school-modal-close" aria-label="Fermer" disabled={saving} onClick={() => setResettingUser(null)}>×</button><span className="school-modal-mark">⌑</span><p className="eyebrow">ACCÈS AU COMPTE</p><h2 id="reset-password-title">Nouveau mot de passe</h2><p>Définissez un mot de passe temporaire pour <strong>{resettingUser.fullName}</strong>, puis transmettez-le directement à la personne concernée. Ce compte peut être partagé avec d’autres écoles ; ses sessions déjà ouvertes restent valides jusqu’à leur expiration.</p><form onSubmit={(event) => void resetUserPassword(event)}><label className="field-label">Nouveau mot de passe<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><small className="field-hint">12 caractères minimum, avec majuscule, minuscule et chiffre.</small></label><label className="field-label">Confirmer le mot de passe<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label><div className="school-modal-actions"><button type="button" className="school-modal-cancel" disabled={saving} onClick={() => setResettingUser(null)}>Annuler</button><button type="submit" className="primary-button" disabled={saving || !newPassword || newPassword !== confirmPassword}>{saving ? 'Enregistrement…' : 'Réinitialiser'}</button></div></form></section></div>}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field-label">{label}{children}</label>;
}