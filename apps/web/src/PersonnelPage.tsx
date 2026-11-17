import { FormEvent, useEffect, useState } from 'react';
import { apiRequest, StaffMember } from './api';
import { useAccess } from './AccessContext';

type StaffForm = {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  position: string;
  phone: string;
  email: string;
  contractType: string;
  hiredAt: string;
};

const emptyForm: StaffForm = {
  employeeNumber: '',
  firstName: '',
  lastName: '',
  position: '',
  phone: '',
  email: '',
  contractType: '',
  hiredAt: '',
};

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('fr-FR');
}

function leaveStatus(status: StaffMember['leaves'][number]['status']) {
  if (status === 'APPROVED') return 'Approuvé';
  if (status === 'REJECTED') return 'Refusé';
  return 'En attente';
}

export function PersonnelPage({ onBack }: { onBack: () => void }) {
  const { can } = useAccess();
  const [records, setRecords] = useState<StaffMember[]>([]);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadRecords() {
    setLoading(true);
    setError('');
    try {
      setRecords(await apiRequest<StaffMember[]>('/personnel/records'));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les dossiers du personnel.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadRecords(); }, []);

  async function perform(task: () => Promise<unknown>, message: string) {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await task();
      setSuccess(message);
      await loadRecords();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de terminer cette opération.');
    } finally {
      setSaving(false);
    }
  }

  async function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await perform(() => apiRequest('/personnel/records', {
      method: 'POST',
      body: {
        ...(form.employeeNumber.trim() ? { employeeNumber: form.employeeNumber.trim() } : {}),
        firstName: form.firstName,
        lastName: form.lastName,
        position: form.position,
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        ...(form.email.trim() ? { email: form.email.trim() } : {}),
        ...(form.contractType.trim() ? { contractType: form.contractType.trim() } : {}),
        ...(form.hiredAt ? { hiredAt: form.hiredAt } : {}),
      },
    }), 'Dossier du personnel créé.');
    setForm(emptyForm);
  }

  const activeCount = records.filter((record) => record.isActive).length;
  const pendingLeaves = records.flatMap((record) => record.leaves).filter((leave) => leave.status === 'PENDING').length;

  return <section className="workspace-page">
    <button className="back-link" onClick={onBack}>← Retour à la vue générale</button>
    <div className="workspace-title-row">
      <div><p className="eyebrow">RESSOURCES HUMAINES</p><h1>Gestion du personnel</h1><p>Centralisez les dossiers du personnel administratif et suivez les demandes de congé.</p></div>
    </div>
    <section className="portal-summary-grid" aria-label="Résumé du personnel">
      <article className="portal-summary-card"><span>Dossiers actifs</span><strong>{activeCount}</strong><small>membres du personnel</small></article>
      <article className="portal-summary-card"><span>Dossiers archivés</span><strong>{records.length - activeCount}</strong><small>historique conservé</small></article>
      <article className="portal-summary-card"><span>Congés en attente</span><strong>{pendingLeaves}</strong><small>demandes à examiner</small></article>
      <article className="portal-summary-card"><span>Total du personnel</span><strong>{records.length}</strong><small>hors enseignants déjà suivis dans l’organisation scolaire</small></article>
    </section>
    {error && <div className="feedback-message error-message" role="alert">{error}</div>}
    {success && <div className="feedback-message success-message" role="status">{success}</div>}
    {can('personnel', 'canCreate') && <form className="form-card staff-create-form" onSubmit={(event) => void createStaff(event)}>
      <div className="form-card-heading"><span className="module-number">+</span><div><strong>Ajouter un membre du personnel</strong><small>Saisissez un matricule ou laissez le champ vide pour le générer automatiquement.</small></div></div>
      <label className="field-label">Matricule (facultatif)<input maxLength={30} value={form.employeeNumber} onChange={(event) => setForm({ ...form, employeeNumber: event.target.value })} placeholder="Ex. EMP-001" /></label>
      <label className="field-label">Prénom<input required maxLength={80} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label>
      <label className="field-label">Nom<input required maxLength={80} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label>
      <label className="field-label">Fonction<input required minLength={2} maxLength={100} value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} placeholder="Ex. Secrétaire" /></label>
      <label className="field-label">Téléphone<input maxLength={30} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
      <label className="field-label">Courriel<input type="email" maxLength={120} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label className="field-label">Type de contrat<input maxLength={60} value={form.contractType} onChange={(event) => setForm({ ...form, contractType: event.target.value })} placeholder="Ex. CDI, CDD" /></label>
      <label className="field-label">Date d’embauche<input type="date" value={form.hiredAt} onChange={(event) => setForm({ ...form, hiredAt: event.target.value })} /></label>
      <button className="primary-button" disabled={saving}>{saving ? 'Enregistrement…' : 'Créer le dossier'}</button>
    </form>}
    <section className="staff-records-section">
      <div className="section-heading"><div><p className="eyebrow">DOSSIERS ET CONGÉS</p><h2>Personnel de l’établissement</h2></div><button className="refresh-button" type="button" onClick={() => void loadRecords()} disabled={loading}>{loading ? 'Chargement…' : 'Actualiser'}</button></div>
      {loading ? <p className="list-empty">Chargement des dossiers…</p> : records.length ? <div className="staff-record-list">{records.map((record) => <StaffCard key={record.id} record={record} saving={saving} canCreate={can('personnel', 'canCreate')} canUpdate={can('personnel', 'canUpdate')} onPerform={perform} />)}</div> : <p className="list-empty">Aucun dossier du personnel enregistré.</p>}
    </section>
  </section>;
}

function StaffCard({ record, saving, canCreate, canUpdate, onPerform }: {
  record: StaffMember;
  saving: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  onPerform: (task: () => Promise<unknown>, message: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [employeeNumber, setEmployeeNumber] = useState(record.employeeNumber);
  const [firstName, setFirstName] = useState(record.firstName);
  const [lastName, setLastName] = useState(record.lastName);
  const [position, setPosition] = useState(record.position);
  const [phone, setPhone] = useState(record.phone ?? '');
  const [email, setEmail] = useState(record.email ?? '');
  const [contractType, setContractType] = useState(record.contractType ?? '');
  const [hiredAt, setHiredAt] = useState(record.hiredAt?.slice(0, 10) ?? '');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onPerform(() => apiRequest(`/personnel/records/${record.id}`, {
      method: 'PATCH',
      body: {
        employeeNumber: employeeNumber.trim(),
        firstName, lastName, position,
        phone: phone || null,
        email: email || null,
        contractType: contractType || null,
        hiredAt: hiredAt || null,
      },
    }), 'Dossier du personnel modifié.');
    setEditing(false);
  }

  async function requestLeave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onPerform(() => apiRequest(`/personnel/records/${record.id}/leaves`, {
      method: 'POST',
      body: { startsOn: leaveStart, endsOn: leaveEnd, ...(leaveReason.trim() ? { reason: leaveReason.trim() } : {}) },
    }), 'Demande de congé enregistrée.');
    setLeaveStart('');
    setLeaveEnd('');
    setLeaveReason('');
  }

  return <article className={`staff-record-card ${record.isActive ? '' : 'is-archived'}`}>
    <header className="staff-record-header">
      <span className="profile-badge">{record.firstName[0]}{record.lastName[0]}</span>
      <div><strong>{record.firstName} {record.lastName}</strong><small>{record.employeeNumber} · {record.position}</small><small>{[record.phone, record.email, record.contractType].filter(Boolean).join(' · ') || 'Coordonnées et contrat à compléter'}{record.hiredAt ? ` · Embauche ${dateLabel(record.hiredAt)}` : ''}</small></div>
      <span className={`student-status ${record.isActive ? 'active' : 'archived'}`}>{record.isActive ? 'Actif' : 'Archivé'}</span>
    </header>
    {editing && <form className="staff-edit-form" onSubmit={(event) => void saveRecord(event)}>
      <label className="field-label">Matricule<input required minLength={1} maxLength={30} value={employeeNumber} onChange={(event) => setEmployeeNumber(event.target.value)} /></label>
      <label className="field-label">Prénom<input required maxLength={80} value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>
      <label className="field-label">Nom<input required maxLength={80} value={lastName} onChange={(event) => setLastName(event.target.value)} /></label>
      <label className="field-label">Fonction<input required minLength={2} maxLength={100} value={position} onChange={(event) => setPosition(event.target.value)} /></label>
      <label className="field-label">Téléphone<input maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
      <label className="field-label">Courriel<input type="email" maxLength={120} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label className="field-label">Contrat<input maxLength={60} value={contractType} onChange={(event) => setContractType(event.target.value)} /></label>
      <label className="field-label">Date d’embauche<input type="date" value={hiredAt} onChange={(event) => setHiredAt(event.target.value)} /></label>
      <div className="staff-form-actions"><button className="primary-button" disabled={saving}>Enregistrer</button><button type="button" className="secondary-button" disabled={saving} onClick={() => setEditing(false)}>Annuler</button></div>
    </form>}
    {canUpdate && <div className="staff-record-actions">
      <button className="table-action" type="button" onClick={() => setEditing((current) => !current)}>{editing ? 'Fermer' : 'Modifier'}</button>
      <button className="table-action" type="button" disabled={saving} onClick={() => void onPerform(() => apiRequest(`/personnel/records/${record.id}`, { method: 'PATCH', body: { isActive: !record.isActive } }), record.isActive ? 'Dossier archivé.' : 'Dossier réactivé.')}>{record.isActive ? 'Archiver' : 'Réactiver'}</button>
    </div>}
    {record.isActive && canCreate && <form className="staff-leave-form" onSubmit={(event) => void requestLeave(event)}>
      <strong>Nouvelle demande de congé</strong>
      <label className="field-label">Début<input type="date" required value={leaveStart} onChange={(event) => setLeaveStart(event.target.value)} /></label>
      <label className="field-label">Fin<input type="date" required min={leaveStart || undefined} value={leaveEnd} onChange={(event) => setLeaveEnd(event.target.value)} /></label>
      <label className="field-label">Motif<input maxLength={500} value={leaveReason} onChange={(event) => setLeaveReason(event.target.value)} /></label>
      <button className="secondary-button" disabled={saving}>Enregistrer la demande</button>
    </form>}
    {record.leaves.length > 0 && <div className="staff-leave-history"><strong>Historique des congés</strong>{record.leaves.map((leave) => <div className="staff-leave-row" key={leave.id}>
      <span>{dateLabel(leave.startsOn)} – {dateLabel(leave.endsOn)}{leave.reason ? ` · ${leave.reason}` : ''}</span>
      <span className={`communication-status status-${leave.status.toLowerCase()}`}>{leaveStatus(leave.status)}</span>
      {leave.status === 'PENDING' && canUpdate && <><button className="table-action" type="button" disabled={saving} onClick={() => void onPerform(() => apiRequest(`/personnel/leaves/${leave.id}`, { method: 'PATCH', body: { status: 'APPROVED' } }), 'Congé approuvé.')}>Approuver</button><button className="table-action danger-action" type="button" disabled={saving} onClick={() => void onPerform(() => apiRequest(`/personnel/leaves/${leave.id}`, { method: 'PATCH', body: { status: 'REJECTED' } }), 'Congé refusé.')}>Refuser</button></>}
    </div>)}</div>}
  </article>;
}
