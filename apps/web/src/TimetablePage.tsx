import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, SchoolYear, TeachingAssignment, TimetableEntry } from './api';
import { useAccess } from './AccessContext';

const weekDays = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
];

export function TimetablePage({ onBack }: { onBack: () => void }) {
  const { can } = useAccess();
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [schoolYearId, setSchoolYearId] = useState('');
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [assignmentId, setAssignmentId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [startsAt, setStartsAt] = useState('08:00');
  const [endsAt, setEndsAt] = useState('09:00');
  const [room, setRoom] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    void apiRequest<SchoolYear[]>('/school-years')
      .then((years) => {
        if (cancelled) return;
        setSchoolYears(years);
        setSchoolYearId(years.find((year) => year.isCurrent)?.id ?? years[0]?.id ?? '');
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les années scolaires.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!schoolYearId) {
      setAssignments([]);
      setEntries([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    void Promise.all([
      apiRequest<TeachingAssignment[]>(`/academic/teaching-assignments?schoolYearId=${encodeURIComponent(schoolYearId)}`),
      apiRequest<TimetableEntry[]>(`/timetable?schoolYearId=${encodeURIComponent(schoolYearId)}`),
    ])
      .then(([nextAssignments, nextEntries]) => {
        if (cancelled) return;
        setAssignments(nextAssignments);
        setEntries(nextEntries);
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'Impossible de charger l’emploi du temps.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [schoolYearId]);

  const entriesByDay = useMemo(() => new Map(
    weekDays.map(({ value }) => [
      value,
      entries.filter((entry) => entry.dayOfWeek === value).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    ]),
  ), [entries]);

  async function createEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest<TimetableEntry>('/timetable', {
        method: 'POST',
        body: { assignmentId, dayOfWeek: Number(dayOfWeek), startsAt, endsAt, room },
      });
      setSuccess('Le cours a été ajouté à l’emploi du temps.');
      await refreshEntries();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’ajouter ce cours.');
    } finally {
      setSaving(false);
    }
  }

  async function refreshEntries() {
    if (!schoolYearId) return;
    const updatedEntries = await apiRequest<TimetableEntry[]>(`/timetable?schoolYearId=${encodeURIComponent(schoolYearId)}`);
    setEntries(updatedEntries);
  }

  async function deleteEntry(entry: TimetableEntry) {
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/timetable/${entry.id}`, { method: 'DELETE' });
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      setSuccess('Le cours a été supprimé.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de supprimer ce cours.');
    }
  }

  return (
    <section className="workspace-page">
      <button className="back-link" onClick={onBack}>← Retour à la vue générale</button>
      <div className="workspace-title-row">
        <div><p className="eyebrow">ORGANISATION PÉDAGOGIQUE</p><h1>Emploi du temps</h1><p>Planifiez les cours par classe et enseignant. Les conflits de créneaux sont contrôlés automatiquement.</p></div>
        <label className="field-label timetable-year-select">Année scolaire<select value={schoolYearId} onChange={(event) => setSchoolYearId(event.target.value)}><option value="">Aucune année configurée</option>{schoolYears.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? ' · En cours' : ''}</option>)}</select></label>
      </div>

      {error && <div className="feedback-message error-message" role="alert">{error}</div>}
      {success && <div className="feedback-message success-message" role="status">{success}</div>}
      <div className="timetable-layout">
        {can('timetable', 'canCreate') && <form className="form-card timetable-form" onSubmit={(event) => void createEntry(event)}>
          <div className="form-card-heading"><span className="module-number">+</span><div><strong>Ajouter un cours</strong><small>La matière et l’enseignant proviennent des affectations pédagogiques.</small></div></div>
          <label className="field-label">Classe, matière et enseignant<select required value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}><option value="">Choisir une affectation…</option>{assignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.class.level.name} {assignment.class.name} · {assignment.subject.name} · {assignment.teacher.firstName} {assignment.teacher.lastName}</option>)}</select></label>
          {assignments.length === 0 && <p className="inline-hint">Aucune affectation active. Configurez les classes, matières et enseignants avant de planifier les cours.</p>}
          <label className="field-label">Jour<select value={dayOfWeek} onChange={(event) => setDayOfWeek(event.target.value)}>{weekDays.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label>
          <div className="form-row">
            <label className="field-label">Début<input type="time" required value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
            <label className="field-label">Fin<input type="time" required value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label>
          </div>
          <label className="field-label">Salle (facultatif)<input maxLength={60} value={room} onChange={(event) => setRoom(event.target.value)} placeholder="Ex. Salle 4" /></label>
          <button className="primary-button" type="submit" disabled={saving || !assignmentId}>{saving ? 'Enregistrement…' : 'Ajouter au planning'}</button>
        </form>}

        <div className="timetable-board">
          {loading ? <p className="list-empty">Chargement de l’emploi du temps…</p> : !schoolYearId ? <p className="list-empty">Créez une année scolaire pour planifier les cours.</p> : weekDays.map((day) => {
            const dayEntries = entriesByDay.get(day.value) ?? [];
            return <section className="timetable-day" key={day.value}>
              <header><h2>{day.label}</h2><span>{dayEntries.length} cours</span></header>
              {dayEntries.length ? dayEntries.map((entry) => (
                <article className="timetable-entry" key={entry.id}>
                  <time>{entry.startsAt}<span>{entry.endsAt}</span></time>
                  <div><strong>{entry.assignment.subject.name}</strong><span>{entry.assignment.class.level.name} {entry.assignment.class.name}</span><small>{entry.assignment.teacher.firstName} {entry.assignment.teacher.lastName}{entry.room ? ` · ${entry.room}` : ''}</small></div>
                  {can('timetable', 'canDelete') && <button type="button" className="table-action" aria-label={`Supprimer ${entry.assignment.subject.name} de ${day.label}`} onClick={() => void deleteEntry(entry)}>Supprimer</button>}
                </article>
              )) : <p className="timetable-day-empty">Aucun cours planifié.</p>}
            </section>;
          })}
        </div>
      </div>
    </section>
  );
}
