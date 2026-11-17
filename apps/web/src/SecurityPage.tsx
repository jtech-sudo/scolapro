import { useEffect, useState } from 'react';
import { apiRequest } from './api';

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: unknown;
  createdAt: string;
  actorUserId: string | null;
};

type ArchivedStudent = { id: string; matricule: string; firstName: string; lastName: string; updatedAt: string };

type Tab = 'activity' | 'archives';

const actionNames: Record<string, string> = {
  USER_SIGNED_IN: 'Connexion utilisateur',
  SCHOOL_PROFILE_UPDATED: 'Paramètres de l’établissement modifiés',
  ROLE_PERMISSIONS_UPDATED: 'Permissions modifiées',
  USER_ACCESS_UPDATED: 'Accès utilisateur modifié',
  USER_PASSWORD_RESET: 'Mot de passe réinitialisé',
  STUDENT_CREATED: 'Dossier élève créé',
  STUDENT_UPDATED: 'Dossier élève modifié',
  STUDENT_ENROLLED: 'Élève affecté à une classe',
  STUDENT_RESTORED_FROM_ARCHIVE: 'Élève restauré des archives',
  SCHOOL_CREATED_BY_PLATFORM: 'Établissement créé',
};

export function SecurityPage({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('activity');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [archivedStudents, setArchivedStudents] = useState<ArchivedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [logData, archiveData] = await Promise.all([
        apiRequest<AuditLog[]>('/admin/security/audit-logs'),
        apiRequest<ArchivedStudent[]>('/admin/security/archives/students'),
      ]);
      setLogs(logData);
      setArchivedStudents(archiveData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les données de sécurité.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadData(); }, []);

  async function restoreStudent(student: ArchivedStudent) {
    setRestoringId(student.id);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/admin/security/archives/students/${student.id}/restore`, { method: 'POST' });
      setSuccess(`Le dossier de ${student.firstName} ${student.lastName} a été restauré.`);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de restaurer ce dossier.');
    } finally { setRestoringId(''); }
  }

  return <section className="workspace-page security-page">
    <button className="back-link" onClick={onBack}>← Retour à la vue générale</button>
    <div className="workspace-title-row"><div><p className="eyebrow">PROTECTION ET TRAÇABILITÉ</p><h1>Sécurité et archives</h1><p>Consultez l’activité récente et gérez les dossiers élèves archivés.</p></div><button className="refresh-button" onClick={() => void loadData()}>↻ Actualiser</button></div>
    <div className="security-summary"><article><span aria-hidden="true">◷</span><div><small>ÉVÉNEMENTS JOURNALISÉS</small><strong>{logs.length}</strong><p>100 dernières opérations au maximum</p></div></article><article><span aria-hidden="true">▣</span><div><small>DOSSIERS ARCHIVÉS</small><strong>{archivedStudents.length}</strong><p>Élèves désactivés et restaurables</p></div></article><article><span aria-hidden="true">⌑</span><div><small>SAUVEGARDES</small><strong>À configurer</strong><p>Aucune sauvegarde automatique n’est paramétrée ici</p></div></article></div>
    <div className="security-configuration-note" role="note"><strong>À retenir sur les sauvegardes</strong><span>Le journal d’audit et les archives consultables ne remplacent pas une sauvegarde. Configurez des sauvegardes chiffrées, régulières et testez leur restauration avant la production.</span></div>
    <nav className="organization-tabs" aria-label="Sécurité et archives"><button className={tab === 'activity' ? 'organization-tab active' : 'organization-tab'} onClick={() => setTab('activity')}>Journal d’activité</button><button className={tab === 'archives' ? 'organization-tab active' : 'organization-tab'} onClick={() => setTab('archives')}>Archives élèves <span className="security-tab-count">{archivedStudents.length}</span></button></nav>
    {error && <div className="feedback-message error-message" role="alert">{error}</div>}
    {success && <div className="feedback-message success-message" role="status">{success}</div>}
    {loading && <p className="inline-hint">Chargement des données de sécurité…</p>}
    {tab === 'activity' && !loading && <section className="form-card security-record-card"><div className="security-record-heading"><div><strong>Journal d’audit</strong><small>Opérations récentes sur cet établissement, du plus récent au plus ancien.</small></div><span className="module-count">{logs.length} événement(s)</span></div>{logs.length ? <div className="security-audit-list">{logs.map((log) => <article className="security-audit-row" key={log.id}><span className="security-audit-mark" aria-hidden="true">✓</span><div className="security-audit-main"><strong>{actionNames[log.action] ?? log.action.replaceAll('_', ' ').toLocaleLowerCase('fr')}</strong><small>{log.entityType}{log.entityId ? ` · ${log.entityId}` : ''}</small>{log.details !== null && log.details !== undefined ? <details><summary>Détails de l’opération</summary><pre>{JSON.stringify(log.details, null, 2)}</pre></details> : null}</div><time dateTime={log.createdAt}>{new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(log.createdAt))}</time></article>)}</div> : <div className="list-empty"><strong>Aucune activité enregistrée</strong><span>Les prochains événements réalisés dans cet espace seront listés ici.</span></div>}</section>}
    {tab === 'archives' && !loading && <section className="form-card security-record-card"><div className="security-record-heading"><div><strong>Dossiers élèves archivés</strong><small>Les dossiers sont conservés et peuvent être réactivés sans recréer l’élève.</small></div><span className="module-count">{archivedStudents.length} dossier(s)</span></div>{archivedStudents.length ? <div className="security-archive-list">{archivedStudents.map((student) => <article className="security-archive-row" key={student.id}><span className="archive-student-avatar" aria-hidden="true">{student.firstName[0]}{student.lastName[0]}</span><span className="security-archive-copy"><strong>{student.lastName} {student.firstName}</strong><small>{student.matricule} · Archivé le {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(student.updatedAt))}</small></span><button className="table-action" disabled={restoringId === student.id} onClick={() => void restoreStudent(student)}>{restoringId === student.id ? 'Restauration…' : 'Restaurer le dossier'}</button></article>)}</div> : <div className="list-empty"><strong>Aucun dossier archivé</strong><span>Les dossiers archivés apparaîtront dans cette liste.</span></div>}</section>}
  </section>;
}
