import { FormEvent, useEffect, useState } from 'react';
import { apiRequest, CommunicationRecipient, PortalNotice } from './api';
import { useAccess } from './AccessContext';

function statusLabel(status: PortalNotice['status']) {
  if (status === 'READY') return 'Prête';
  if (status === 'ARCHIVED') return 'Archivée';
  return 'Brouillon';
}

export function CommunicationPage({ onBack }: { onBack: () => void }) {
  const { can } = useAccess();
  const [recipients, setRecipients] = useState<CommunicationRecipient[]>([]);
  const [notices, setNotices] = useState<PortalNotice[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [guardianId, setGuardianId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [nextRecipients, nextNotices] = await Promise.all([
        apiRequest<CommunicationRecipient[]>('/communication/recipients'),
        apiRequest<PortalNotice[]>('/communication/notices'),
      ]);
      setRecipients(nextRecipients);
      setNotices(nextNotices);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les communications.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  async function createNotice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest<PortalNotice>('/communication/notices', {
        method: 'POST',
        body: { title, body, ...(guardianId ? { guardianId } : {}) },
      });
      setTitle('');
      setBody('');
      setGuardianId('');
      setSuccess('Communication enregistrée en brouillon.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’enregistrer cette communication.');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(notice: PortalNotice, status: PortalNotice['status']) {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest<PortalNotice>(`/communication/notices/${notice.id}`, { method: 'PATCH', body: { status } });
      setSuccess(status === 'READY' ? 'Communication marquée comme prête.' : status === 'ARCHIVED' ? 'Communication archivée.' : 'Communication remise en brouillon.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de mettre à jour cette communication.');
    } finally {
      setSaving(false);
    }
  }

  const draftCount = notices.filter((notice) => notice.status === 'DRAFT').length;
  const readyCount = notices.filter((notice) => notice.status === 'READY').length;

  return <section className="workspace-page">
    <button className="back-link" onClick={onBack}>← Retour à la vue générale</button>
    <div className="workspace-title-row">
      <div><p className="eyebrow">VIE SCOLAIRE ET FAMILLES</p><h1>Communication aux familles</h1><p>Préparez des annonces générales ou adressées au responsable d’un élève.</p></div>
    </div>
    <div className="admin-warning" role="note"><strong>Envoi non connecté</strong><span>Les communications peuvent être préparées, validées et archivées. Aucun courriel, SMS ou notification n’est envoyé pour le moment.</span></div>
    <section className="portal-summary-grid" aria-label="Résumé des communications">
      <article className="portal-summary-card"><span>Responsables disponibles</span><strong>{recipients.length}</strong><small>avec au moins un élève actif</small></article>
      <article className="portal-summary-card"><span>Brouillons</span><strong>{draftCount}</strong><small>communications à finaliser</small></article>
      <article className="portal-summary-card"><span>Prêtes</span><strong>{readyCount}</strong><small>validées, non envoyées</small></article>
      <article className="portal-summary-card"><span>Historique</span><strong>{notices.length}</strong><small>communications enregistrées</small></article>
    </section>
    {error && <div className="feedback-message error-message" role="alert">{error}</div>}
    {success && <div className="feedback-message success-message" role="status">{success}</div>}
    {can('communication', 'canCreate') && <form className="form-card communication-compose" onSubmit={(event) => void createNotice(event)}>
      <div className="form-card-heading"><span className="module-number">+</span><div><strong>Préparer une communication</strong><small>Un brouillon peut être modifié, marqué prêt ou archivé.</small></div></div>
      <label className="field-label">Titre<input required minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
      <label className="field-label">Destinataire<select value={guardianId} onChange={(event) => setGuardianId(event.target.value)}><option value="">Toutes les familles</option>{recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{recipient.firstName} {recipient.lastName} · {recipient.studentCount} élève{recipient.studentCount === 1 ? '' : 's'}</option>)}</select></label>
      <label className="field-label">Message<textarea required minLength={3} maxLength={4000} rows={5} value={body} onChange={(event) => setBody(event.target.value)} /></label>
      <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer le brouillon'}</button>
    </form>}
    <section className="communication-history">
      <div className="section-heading"><div><p className="eyebrow">SUIVI</p><h2>Communications enregistrées</h2></div></div>
      {loading ? <p className="list-empty">Chargement des communications…</p> : notices.length ? <div className="communication-list">{notices.map((notice) => (
        <article className="communication-card" key={notice.id}>
          <div className="communication-card-heading"><div><span className={`communication-status status-${notice.status.toLowerCase()}`}>{statusLabel(notice.status)}</span><h3>{notice.title}</h3></div><time dateTime={notice.createdAt}>{new Date(notice.createdAt).toLocaleDateString('fr-FR')}</time></div>
          <p className="communication-audience">{notice.guardian ? `Destinataire : ${notice.guardian.firstName} ${notice.guardian.lastName}` : 'Destinataire : toutes les familles'}</p>
          <p className="communication-body">{notice.body}</p>
          {notice.status !== 'ARCHIVED' && <div className="communication-actions">
            {can('communication', 'canUpdate') && notice.status === 'DRAFT' && <button className="secondary-button" type="button" disabled={saving} onClick={() => void updateStatus(notice, 'READY')}>Marquer prête</button>}
            {can('communication', 'canUpdate') && notice.status === 'READY' && <button className="secondary-button" type="button" disabled={saving} onClick={() => void updateStatus(notice, 'DRAFT')}>Remettre en brouillon</button>}
            {can('communication', 'canUpdate') && <button className="table-action" type="button" disabled={saving} onClick={() => void updateStatus(notice, 'ARCHIVED')}>Archiver</button>}
          </div>}
        </article>
      ))}</div> : <p className="list-empty">Aucune communication enregistrée.</p>}
    </section>
  </section>;
}
