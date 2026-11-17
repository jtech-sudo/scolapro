import { FormEvent, useEffect, useState } from 'react';
import { apiRequest, AttendanceReport, AttendanceSession, AttendanceSlot, AttendanceStatus, SchoolClass } from './api';
import { useAccess } from './AccessContext';

type Tab = 'rollcall' | 'report';
type DraftRecord = { status: AttendanceStatus; arrivalTime: string; reason: string; isJustified: boolean };
const statusLabels: Record<AttendanceStatus, string> = { PRESENT: 'Présent', ABSENT: 'Absent', LATE: 'En retard', EXCUSED: 'Excusé' };

function localDateToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function AttendancePage({ onBack }: { onBack: () => void }) {
  const { can } = useAccess();
  const [tab, setTab] = useState<Tab>('rollcall');
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(localDateToday());
  const [slot, setSlot] = useState<AttendanceSlot>('MORNING');
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftRecord>>({});
  const [reportFrom, setReportFrom] = useState(localDateToday());
  const [reportTo, setReportTo] = useState(localDateToday());
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    void apiRequest<SchoolClass[]>('/classes').then((data) => {
      const active = data.filter((item) => item.isActive);
      setClasses(active);
      setClassId((current) => active.some((item) => item.id === current) ? current : active[0]?.id ?? '');
    }).catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les classes.'))
      .finally(() => setLoading(false));
  }, []);

  function setAttendanceDraft(studentId: string, patch: Partial<DraftRecord>) {
    setDrafts((current) => {
      const previous = current[studentId] ?? { status: 'PRESENT' as AttendanceStatus, arrivalTime: '', reason: '', isJustified: false };
      return { ...current, [studentId]: { ...previous, ...patch } };
    });
  }

  async function openSession() {
    if (!classId || !date) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const opened = await apiRequest<AttendanceSession>('/attendance/sessions/open', { method: 'POST', body: { classId, date, slot } });
      setSession(opened);
      setDrafts(Object.fromEntries(opened.records.map((record) => [record.studentId, { status: record.status, arrivalTime: record.arrivalTime ?? '', reason: record.reason ?? '', isJustified: record.isJustified }])));
      setSuccess(`Appel chargé : ${opened.records.length} élève(s) dans ${opened.class.level.name} ${opened.class.name}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’ouvrir la feuille d’appel.');
    } finally { setSaving(false); }
  }

  async function saveAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/attendance/sessions/${session.id}/records`, {
        method: 'PUT',
        body: { records: session.records.map((record) => ({ studentId: record.studentId, ...drafts[record.studentId], ...(drafts[record.studentId]?.arrivalTime ? {} : { arrivalTime: undefined }) })) },
      });
      setSuccess('Présences, absences et retards enregistrés. Les modifications sont auditées.');
      await openSession();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’enregistrer l’appel.');
    } finally { setSaving(false); }
  }

  async function loadReport() {
    if (!classId || !reportFrom || !reportTo) return;
    setSaving(true);
    setError('');
    try {
      const params = new URLSearchParams({ classId, from: reportFrom, to: reportTo });
      setReport(await apiRequest<AttendanceReport>(`/attendance/report?${params}`));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de générer le rapport de présence.');
    } finally { setSaving(false); }
  }

  useEffect(() => { if (tab === 'report' && classId) void loadReport(); }, [tab, classId]);

  const presentCount = session?.records.filter((record) => drafts[record.studentId]?.status === 'PRESENT').length ?? 0;
  const absentCount = session?.records.filter((record) => drafts[record.studentId]?.status === 'ABSENT').length ?? 0;
  const lateCount = session?.records.filter((record) => drafts[record.studentId]?.status === 'LATE').length ?? 0;
  const tabs: Array<[Tab, string]> = [['rollcall', 'Appel par classe'], ['report', 'Absences et retards']];

  return <section className="workspace-page">
    <button className="back-link" onClick={onBack}>← Retour à la vue générale</button>
    <div className="workspace-title-row"><div><p className="eyebrow">SUIVI DE L’ASSIDUITÉ</p><h1>Présences</h1><p>Faites l’appel par classe et suivez les absences, retards et justificatifs.</p></div><span className="module-count">{classes.length} classe(s) active(s)</span></div>
    <div className="admin-warning" role="note"><strong>Mode de démonstration</strong><span>Les appels sont enregistrés localement et journalisés. L’authentification n’est pas encore activée.</span></div>
    {error && <div className="feedback-message error-message" role="alert">{error}</div>}
    {success && <div className="feedback-message success-message" role="status">{success}</div>}
    <nav className="organization-tabs" aria-label="Sections de présence">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'organization-tab active' : 'organization-tab'} onClick={() => setTab(id)}>{label}</button>)}</nav>

    {tab === 'rollcall' && <>
      <div className="attendance-filters"><label className="field-label">Classe<select value={classId} onChange={(event) => { setClassId(event.target.value); setSession(null); }}><option value="">Choisir une classe</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.level.name} {item.name} · {item.schoolYear.name}</option>)}</select></label><label className="field-label">Date<input type="date" value={date} onChange={(event) => { setDate(event.target.value); setSession(null); }} /></label><label className="field-label">Créneau<select value={slot} onChange={(event) => { setSlot(event.target.value as AttendanceSlot); setSession(null); }}><option value="MORNING">Matin</option><option value="AFTERNOON">Après-midi</option></select></label>{can('attendance', 'canCreate') && <button className="primary-button open-attendance" disabled={!classId || !date || saving} onClick={() => void openSession()}>{saving ? 'Chargement…' : session ? 'Actualiser l’appel' : 'Ouvrir la feuille d’appel'}</button>}</div>
      {!session ? <Empty text={loading ? 'Chargement des classes…' : 'Choisissez une classe, une date et un créneau pour ouvrir l’appel.'} /> : <form className="form-card attendance-sheet" onSubmit={saveAttendance}>
        <div className="section-heading attendance-sheet-heading"><div><p className="eyebrow">{session.slot === 'MORNING' ? 'MATIN' : 'APRÈS-MIDI'} · {dateLabel(session.date)}</p><h2>{session.class.level.name} {session.class.name}</h2></div><div className="attendance-counters"><span className="status-counter present">{presentCount} présents</span><span className="status-counter absent">{absentCount} absents</span><span className="status-counter late">{lateCount} retards</span></div></div>
        {session.records.length ? <div className="student-table-wrap"><table className="student-table attendance-table"><thead><tr><th>Élève</th><th>Statut</th><th>Heure d’arrivée</th><th>Motif / justificatif</th><th>Justifiée</th></tr></thead><tbody>{session.records.map((record) => { const draft = drafts[record.studentId] ?? { status: 'PRESENT' as AttendanceStatus, arrivalTime: '', reason: '', isJustified: false }; return <tr key={record.studentId}><td><strong>{record.student.lastName} {record.student.firstName}</strong><small>{record.student.matricule}</small></td><td><select disabled={!can('attendance', 'canUpdate')} className={`attendance-status-select ${draft.status.toLowerCase()}`} value={draft.status} onChange={(event) => setAttendanceDraft(record.studentId, { status: event.target.value as AttendanceStatus, ...(event.target.value !== 'LATE' ? { arrivalTime: '' } : {}), ...(event.target.value === 'PRESENT' ? { isJustified: false } : {}) })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td><input type="time" disabled={!can('attendance', 'canUpdate') || draft.status !== 'LATE'} value={draft.arrivalTime} onChange={(event) => setAttendanceDraft(record.studentId, { arrivalTime: event.target.value })} aria-label={`Heure d’arrivée de ${record.student.firstName}`} /></td><td><input disabled={!can('attendance', 'canUpdate')} maxLength={300} value={draft.reason} onChange={(event) => setAttendanceDraft(record.studentId, { reason: event.target.value })} placeholder={draft.status === 'PRESENT' ? 'Facultatif' : 'Motif ou précision'} aria-label={`Motif de ${record.student.firstName}`} /></td><td><input type="checkbox" checked={draft.isJustified} disabled={!can('attendance', 'canUpdate') || draft.status === 'PRESENT'} onChange={(event) => setAttendanceDraft(record.studentId, { isJustified: event.target.checked })} aria-label={`Absence justifiée de ${record.student.firstName}`} /></td></tr>; })}</tbody></table></div> : <Empty text="Aucun élève actif n’est inscrit dans cette classe." />}
        <div className="attendance-footer"><span>{session.records.length} élève(s) dans l’appel · présents par défaut</span>{can('attendance', 'canUpdate') && <button className="primary-button" disabled={saving || !session.records.length}>{saving ? 'Enregistrement…' : 'Enregistrer l’appel'}</button>}</div>
      </form>}
    </>}

    {tab === 'report' && <section className="form-card"><div className="attendance-report-filters"><label className="field-label">Classe<select value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">Choisir une classe</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.level.name} {item.name} · {item.schoolYear.name}</option>)}</select></label><label className="field-label">Du<input type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} /></label><label className="field-label">Au<input type="date" value={reportTo} onChange={(event) => setReportTo(event.target.value)} /></label><label className="field-label">Créneau<select value={slot} onChange={(event) => setSlot(event.target.value as AttendanceSlot)}><option value="MORNING">Matin</option><option value="AFTERNOON">Après-midi</option></select></label><button className="primary-button" disabled={!classId || saving} onClick={() => void loadReport()}>{saving ? 'Calcul…' : 'Générer le rapport'}</button></div>
      {!report ? <Empty text="Choisissez une classe et une période pour consulter les statistiques." /> : <><div className="attendance-counters report-counters"><span className="status-counter present">{report.totals.present} présences</span><span className="status-counter absent">{report.totals.absent} absences</span><span className="status-counter late">{report.totals.late} retards</span><span className="status-counter excused">{report.totals.excused} excusées</span><span className="module-count">{report.sessionCount} appel(s)</span></div><div className="records-list attendance-report-list">{report.students.map((item) => <div className="average-row" key={item.student.id}><div><strong>{item.student.lastName} {item.student.firstName}</strong><small>{item.student.matricule} · {item.sessions} appel(s) · {item.absent} absence(s) · {item.late} retard(s)</small></div><strong className="average-score">{item.attendanceRate} %</strong></div>)}{!report.students.length && <Empty text="Aucun appel enregistré durant cette période." />}</div></>}</section>}
    <div className="security-note"><strong>Données sensibles</strong><span>Les statuts d’assiduité peuvent être consultés par les familles seulement lorsque le portail sécurisé sera mis en service.</span></div>
  </section>;
}

function Empty({ text }: { text: string }) { return <div className="list-empty"><strong>Rien à afficher</strong><span>{text}</span></div>; }
function dateLabel(value: string) { return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(`${value.slice(0, 10)}T12:00:00`)); }