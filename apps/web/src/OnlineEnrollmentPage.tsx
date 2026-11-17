import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, OnlineEnrollmentPublicForm, OnlineEnrollmentRequest } from './api';
import { useAccess } from './AccessContext';

type Props = { onBack: () => void; schoolSlug: string };
type StatusFilter = 'ALL' | OnlineEnrollmentRequest['status'];
type ApplicationForm = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  classId: string;
  guardianFirstName: string;
  guardianLastName: string;
  guardianPhone: string;
  guardianEmail: string;
  guardianAddress: string;
  relationship: string;
};

const initialForm: ApplicationForm = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  sex: '',
  classId: '',
  guardianFirstName: '',
  guardianLastName: '',
  guardianPhone: '',
  guardianEmail: '',
  guardianAddress: '',
  relationship: 'Parent',
};

const statusNames: Record<OnlineEnrollmentRequest['status'], string> = {
  PENDING: 'À examiner',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Refusée',
  ENROLLED: 'Inscrit',
};

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('fr-FR');
}

export function OnlineEnrollmentPage({ onBack, schoolSlug }: Props) {
  const { can } = useAccess();
  const [requests, setRequests] = useState<OnlineEnrollmentRequest[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const publicUrl = `${window.location.origin}/inscription/${encodeURIComponent(schoolSlug)}`;

  async function loadRequests() {
    setLoading(true);
    setError('');
    try {
      setRequests(await apiRequest<OnlineEnrollmentRequest[]>('/online-enrollment/requests'));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les demandes d’inscription.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadRequests(); }, []);

  async function perform(id: string, task: () => Promise<unknown>, message: string) {
    setSavingId(id);
    setError('');
    setSuccess('');
    try {
      await task();
      setSuccess(message);
      await loadRequests();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de traiter cette demande.');
    } finally {
      setSavingId('');
    }
  }

  const visibleRequests = useMemo(
    () => filter === 'ALL' ? requests : requests.filter((request) => request.status === filter),
    [filter, requests],
  );
  const pendingCount = requests.filter((request) => request.status === 'PENDING').length;
  const acceptedCount = requests.filter((request) => request.status === 'ACCEPTED').length;
  const enrolledCount = requests.filter((request) => request.status === 'ENROLLED').length;

  return <section className="workspace-page">
    <button className="back-link" onClick={onBack}>← Retour à la vue générale</button>
    <div className="workspace-title-row">
      <div><p className="eyebrow">ADMISSIONS</p><h1>Demandes d’inscription en ligne</h1><p>Recevez les dossiers, examinez-les et transformez les demandes acceptées en inscriptions élèves.</p></div>
    </div>
    <div className="online-enrollment-link"><div><strong>Formulaire public de candidature</strong><small>Partagez ce lien aux familles. Il ne donne accès qu’au formulaire et aux classes ouvertes.</small><a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a></div><a className="secondary-button" href={publicUrl} target="_blank" rel="noreferrer">Ouvrir le formulaire</a></div>
    {error && <div className="feedback-message error-message" role="alert">{error}</div>}
    {success && <div className="feedback-message success-message" role="status">{success}</div>}
    <section className="portal-summary-grid" aria-label="Résumé des demandes">
      <article className="portal-summary-card"><span>À examiner</span><strong>{pendingCount}</strong><small>dossiers en attente</small></article>
      <article className="portal-summary-card"><span>Acceptées</span><strong>{acceptedCount}</strong><small>à convertir en élèves</small></article>
      <article className="portal-summary-card"><span>Inscrits</span><strong>{enrolledCount}</strong><small>dossiers déjà créés</small></article>
      <article className="portal-summary-card"><span>Total</span><strong>{requests.length}</strong><small>candidatures reçues</small></article>
    </section>
    <div className="organization-tabs" role="group" aria-label="Filtrer les demandes">
      {([['ALL', 'Toutes'], ['PENDING', 'À examiner'], ['ACCEPTED', 'Acceptées'], ['REJECTED', 'Refusées'], ['ENROLLED', 'Inscrits']] as Array<[StatusFilter, string]>).map(([status, label]) => <button key={status} type="button" className={filter === status ? 'organization-tab active' : 'organization-tab'} onClick={() => setFilter(status)}>{label}</button>)}
    </div>
    <section className="online-request-list">
      <div className="section-heading"><div><p className="eyebrow">DOSSIERS REÇUS</p><h2>Candidatures ({visibleRequests.length})</h2></div><button type="button" className="refresh-button" disabled={loading} onClick={() => void loadRequests()}>{loading ? 'Chargement…' : 'Actualiser'}</button></div>
      {loading ? <p className="list-empty">Chargement des candidatures…</p> : visibleRequests.length ? visibleRequests.map((request) => <ApplicationCard key={request.id} request={request} saving={savingId === request.id} canUpdate={can('online-enrollment', 'canUpdate')} canCreate={can('online-enrollment', 'canCreate')} onPerform={perform} />) : <p className="list-empty">Aucune demande dans cette catégorie.</p>}
    </section>
  </section>;
}

function ApplicationCard({ request, saving, canUpdate, canCreate, onPerform }: {
  request: OnlineEnrollmentRequest;
  saving: boolean;
  canUpdate: boolean;
  canCreate: boolean;
  onPerform: (id: string, task: () => Promise<unknown>, message: string) => Promise<void>;
}) {
  const [reviewNote, setReviewNote] = useState(request.reviewNote ?? '');
  const canReview = request.status === 'PENDING' && canUpdate;
  const canEnroll = request.status === 'ACCEPTED' && canCreate;

  function review(status: 'ACCEPTED' | 'REJECTED') {
    void onPerform(request.id, () => apiRequest(`/online-enrollment/requests/${request.id}/review`, {
      method: 'PATCH',
      body: { status, ...(reviewNote.trim() ? { reviewNote: reviewNote.trim() } : {}) },
    }), status === 'ACCEPTED' ? 'Demande acceptée.' : 'Demande refusée.');
  }

  return <article className="online-request-card">
    <header className="online-request-header">
      <div><span className={`communication-status status-${request.status.toLowerCase()}`}>{statusNames[request.status]}</span><h3>{request.lastName} {request.firstName}</h3><small>Reçue le {dateLabel(request.createdAt)} · Classe demandée : {request.requestedClass.level.name} {request.requestedClass.name} ({request.requestedClass.schoolYear.name})</small></div>
      {request.convertedStudent && <span className="module-count">Matricule {request.convertedStudent.matricule}</span>}
    </header>
    <div className="online-request-details">
      <div><strong>Élève</strong><span>{request.dateOfBirth ? `Né(e) le ${dateLabel(request.dateOfBirth)}` : 'Date de naissance non renseignée'}{request.sex ? ` · ${request.sex === 'F' ? 'Fille' : request.sex === 'M' ? 'Garçon' : 'Autre'}` : ''}</span></div>
      <div><strong>Responsable : {request.guardianFirstName} {request.guardianLastName}</strong><span>{request.relationship} · {request.guardianPhone}{request.guardianEmail ? ` · ${request.guardianEmail}` : ''}</span>{request.guardianAddress && <span>{request.guardianAddress}</span>}</div>
    </div>
    {request.reviewNote && <p className="online-review-note">Note de traitement : {request.reviewNote}</p>}
    {canReview && <div className="online-review-controls"><label className="field-label">Note interne (facultative)<textarea maxLength={1000} rows={2} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} /></label><div><button type="button" className="primary-button" disabled={saving} onClick={() => review('ACCEPTED')}>Accepter</button><button type="button" className="table-action danger-action" disabled={saving} onClick={() => review('REJECTED')}>Refuser</button></div></div>}
    {canCreate && <div className="online-notify-controls"><button type="button" className="secondary-button" disabled={saving} onClick={() => void onPerform(request.id, () => apiRequest(`/online-enrollment/requests/${request.id}/notify`, { method: 'POST' }), 'Alerte e-mail envoyée à l’administrateur configuré.')}>Envoyer l’alerte e-mail</button></div>}
    {canEnroll && <div className="online-convert-controls"><p>La conversion crée le dossier élève, le responsable associé et l’inscription dans la classe demandée.</p><button type="button" className="primary-button" disabled={saving} onClick={() => void onPerform(request.id, () => apiRequest(`/online-enrollment/requests/${request.id}/enroll`, { method: 'POST' }), 'Demande convertie en inscription élève.')}>Créer le dossier élève</button></div>}
  </article>;
}

export function PublicEnrollmentPage({ schoolSlug }: { schoolSlug: string }) {
  const [formData, setFormData] = useState<OnlineEnrollmentPublicForm | null>(null);
  const [form, setForm] = useState<ApplicationForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [requestNumber, setRequestNumber] = useState('');
  const [notificationSent, setNotificationSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void apiRequest<OnlineEnrollmentPublicForm>(`/online-enrollment/public/${encodeURIComponent(schoolSlug)}`)
      .then((data) => { if (!cancelled) setFormData(data); })
      .catch((requestError) => { if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'Établissement introuvable.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [schoolSlug]);

  const schoolYear = formData?.schoolYears[0];
  const classes = formData?.schoolYears.flatMap((year) => year.classes.map((schoolClass) => ({ ...schoolClass, schoolYearName: year.name }))) ?? [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const request = await apiRequest<{ id: string; status: string; notificationSent: boolean }>(`/online-enrollment/public/${encodeURIComponent(schoolSlug)}`, {
        method: 'POST',
        body: {
          firstName: form.firstName,
          lastName: form.lastName,
          ...(form.dateOfBirth ? { dateOfBirth: form.dateOfBirth } : {}),
          ...(form.sex ? { sex: form.sex } : {}),
          classId: form.classId,
          guardianFirstName: form.guardianFirstName,
          guardianLastName: form.guardianLastName,
          guardianPhone: form.guardianPhone,
          ...(form.guardianEmail.trim() ? { guardianEmail: form.guardianEmail.trim() } : {}),
          ...(form.guardianAddress.trim() ? { guardianAddress: form.guardianAddress.trim() } : {}),
          relationship: form.relationship,
        },
      });
      setRequestNumber(request.id);
      setNotificationSent(request.notificationSent);
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’envoyer la demande.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="public-enrollment-shell"><p className="list-empty">Chargement du formulaire…</p></main>;
  if (submitted) return <main className="public-enrollment-shell"><section className="public-enrollment-card"><p className="eyebrow">DEMANDE TRANSMISE</p><h1>Merci pour votre candidature</h1><p>La demande a été enregistrée par {formData?.school.name}. L’établissement l’examinera et vous contactera avec les coordonnées fournies.</p>{notificationSent ? <p className="feedback-message success-message" role="status">Une notification a été envoyée à l’administrateur de l’établissement.</p> : <p className="feedback-message error-message" role="alert">La demande est enregistrée, mais l’établissement n’a pas pu être averti par e-mail. Contactez directement l’école si nécessaire.</p>}<div className="public-request-reference">Référence : <strong>{requestNumber}</strong></div><p className="inline-hint">Conservez cette référence. Aucun compte élève n’est créé avant l’acceptation par l’établissement.</p></section></main>;

  return <main className="public-enrollment-shell">
    <section className="public-enrollment-card">
      <a className="public-school-brand" href="/"><span className="module-number">S</span><span>{formData?.school.shortName}</span></a>
      <p className="eyebrow">CANDIDATURE SCOLAIRE{schoolYear ? ` · ${schoolYear.name}` : ''}</p>
      <h1>Demande d’inscription</h1>
      <p>Remplissez ce formulaire pour transmettre une demande à {formData?.school.name}{formData?.school.city ? `, ${formData.school.city}` : ''}. Les champs marqués d’un astérisque sont obligatoires.</p>
      {error && <div className="feedback-message error-message" role="alert">{error}</div>}
      {classes.length ? <form className="public-enrollment-form" onInput={() => setError('')} onInvalidCapture={() => setError('Veuillez renseigner les champs obligatoires et vérifier les informations saisies.')} onSubmit={(event) => void submit(event)}>
        <h2>Informations de l’élève</h2>
        <div className="form-row"><label className="field-label">Prénom *<input required maxLength={80} value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label><label className="field-label">Nom *<input required maxLength={80} value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label></div>
        <div className="form-row"><label className="field-label">Date de naissance<input type="date" value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} /></label><label className="field-label">Sexe<select value={form.sex} onChange={(event) => setForm({ ...form, sex: event.target.value })}><option value="">Non précisé</option><option value="F">Fille</option><option value="M">Garçon</option><option value="OTHER">Autre</option></select></label></div>
        <label className="field-label">Classe demandée *<select required value={form.classId} onChange={(event) => setForm({ ...form, classId: event.target.value })}><option value="">Choisir une classe</option>{classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.level.name} {schoolClass.name} · {schoolClass.schoolYearName}</option>)}</select></label>
        <h2>Responsable légal</h2>
        <div className="form-row"><label className="field-label">Prénom *<input required maxLength={80} value={form.guardianFirstName} onChange={(event) => setForm({ ...form, guardianFirstName: event.target.value })} /></label><label className="field-label">Nom *<input required maxLength={80} value={form.guardianLastName} onChange={(event) => setForm({ ...form, guardianLastName: event.target.value })} /></label></div>
        <div className="form-row"><label className="field-label">Téléphone *<input required type="tel" minLength={6} maxLength={30} value={form.guardianPhone} onChange={(event) => setForm({ ...form, guardianPhone: event.target.value })} /></label><label className="field-label">Courriel<input type="email" maxLength={120} value={form.guardianEmail} onChange={(event) => setForm({ ...form, guardianEmail: event.target.value })} /></label></div>
        <div className="form-row"><label className="field-label">Lien avec l’élève *<input required maxLength={40} value={form.relationship} onChange={(event) => setForm({ ...form, relationship: event.target.value })} placeholder="Parent, tuteur…" /></label><label className="field-label">Adresse<input maxLength={180} value={form.guardianAddress} onChange={(event) => setForm({ ...form, guardianAddress: event.target.value })} /></label></div>
        <p className="public-privacy-note">Ces informations sont transmises uniquement à l’établissement pour examiner cette demande.</p>
        <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Envoi en cours…' : 'Envoyer la demande'}</button>
      </form> : <div className="admin-warning"><strong>Inscriptions indisponibles</strong><span>L’établissement n’a pas encore ouvert de classe pour une année scolaire en cours. Contactez directement l’école.</span></div>}
      <footer>{formData?.school.phone && <span>{formData.school.phone}</span>}{formData?.school.email && <span>{formData.school.email}</span>}</footer>
    </section>
  </main>;
}
