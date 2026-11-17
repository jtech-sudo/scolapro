import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AcademicTeachingAssignment, apiRequest, Assessment, ClassRoster, TermGradeSummary } from './api';
import { useAccess } from './AccessContext';

type Tab = 'assessments' | 'averages';
type ScoreDraft = { score: string; comment: string };

export function GradesPage({ onBack }: { onBack: () => void }) {
  const { can } = useAccess();
  const [tab, setTab] = useState<Tab>('assessments');
  const [assignments, setAssignments] = useState<AcademicTeachingAssignment[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [selectedTermId, setSelectedTermId] = useState('');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [roster, setRoster] = useState<ClassRoster | null>(null);
  const [scores, setScores] = useState<Record<string, ScoreDraft>>({});
  const [summary, setSummary] = useState<TermGradeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [assessmentName, setAssessmentName] = useState('');
  const [assessmentType, setAssessmentType] = useState('Devoir');
  const [assessmentDate, setAssessmentDate] = useState('');
  const [maximumScore, setMaximumScore] = useState('20');
  const [coefficient, setCoefficient] = useState('1');
  const [onlineStartsAt, setOnlineStartsAt] = useState('');
  const [onlineEndsAt, setOnlineEndsAt] = useState('');
  const [questionType, setQuestionType] = useState<'MULTIPLE_CHOICE' | 'WRITTEN'>('MULTIPLE_CHOICE');
  const [questionPrompt, setQuestionPrompt] = useState('');
  const [questionPoints, setQuestionPoints] = useState('10');
  const [questionChoices, setQuestionChoices] = useState(['', '', '', '']);
  const [correctChoiceIndex, setCorrectChoiceIndex] = useState(0);

  async function loadBase() {
    setLoading(true);
    setError('');
    try {
      const assignmentData = await apiRequest<AcademicTeachingAssignment[]>('/academic/teaching-assignments');
      setAssignments(assignmentData);
      setSelectedAssignmentId((current) => assignmentData.some((assignment) => assignment.id === current) ? current : assignmentData[0]?.id ?? '');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les classes et matières.');
    } finally { setLoading(false); }
  }

  async function loadAssessments() {
    if (!selectedAssignmentId || !selectedTermId) {
      setAssessments([]);
      setSelectedAssessmentId('');
      return;
    }
    const assignment = assignments.find((item) => item.id === selectedAssignmentId);
    if (!assignment) return;
    try {
      const data = await apiRequest<Assessment[]>(`/academic/assessments?classId=${assignment.class.id}&subjectId=${assignment.subject.id}&termId=${selectedTermId}`);
      setAssessments(data);
      setSelectedAssessmentId((current) => data.some((assessment) => assessment.id === current) ? current : data[0]?.id ?? '');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les évaluations.');
    }
  }

  useEffect(() => { void loadBase(); }, []);
  useEffect(() => {
    const assignment = assignments.find((item) => item.id === selectedAssignmentId);
    const terms = assignment?.class.schoolYear.terms ?? [];
    setSelectedTermId((current) => terms.some((term) => term.id === current) ? current : terms[0]?.id ?? '');
  }, [assignments, selectedAssignmentId]);
  useEffect(() => { void loadAssessments(); }, [selectedAssignmentId, selectedTermId, assignments]);
  useEffect(() => {
    const assessment = assessments.find((item) => item.id === selectedAssessmentId);
    if (!assessment) {
      setRoster(null);
      setScores({});
      return;
    }
    setRoster(null);
    void apiRequest<ClassRoster>(`/academic/classes/${assessment.classId}/roster`)
      .then((data) => {
        setRoster(data);
        const existing = new Map(assessment.grades.map((grade) => [grade.student.id, { score: grade.score, comment: grade.comment ?? '' }]));
        setScores(Object.fromEntries(data.students.map((student) => [student.id, existing.get(student.id) ?? { score: '', comment: '' }])));
      })
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Impossible de charger la liste de classe.'));
  }, [assessments, selectedAssessmentId]);
  useEffect(() => {
    const assignment = assignments.find((item) => item.id === selectedAssignmentId);
    if (!assignment || !selectedTermId || tab !== 'averages') { setSummary(null); return; }
    const params = new URLSearchParams({ classId: assignment.class.id, subjectId: assignment.subject.id, termId: selectedTermId });
    void apiRequest<TermGradeSummary>(`/academic/term-summary?${params}`)
      .then(setSummary)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Impossible de calculer les moyennes.'));
  }, [assignments, selectedAssignmentId, selectedTermId, tab, assessments]);

  async function submit(event: FormEvent<HTMLFormElement>, task: () => Promise<unknown>, message: string, reset?: () => void) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try { await task(); reset?.(); setSuccess(message); await loadAssessments(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Impossible d’enregistrer.'); }
    finally { setSaving(false); }
  }

  async function saveGrades(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const gradeEntries = Object.entries(scores).filter(([, value]) => value.score.trim()).map(([studentId, value]) => ({ studentId, score: value.score, ...(value.comment.trim() ? { comment: value.comment.trim() } : {}) }));
    if (!gradeEntries.length) { setError('Saisissez au moins une note avant d’enregistrer.'); return; }
    await submit(event, () => apiRequest(`/academic/assessments/${selectedAssessmentId}/grades`, { method: 'PUT', body: { grades: gradeEntries } }), 'Notes enregistrées et corrections tracées.');
  }

  async function toggleLock(assessment: Assessment) {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/academic/assessments/${assessment.id}`, { method: 'PATCH', body: { status: assessment.status === 'LOCKED' ? 'OPEN' : 'LOCKED' } });
      setSuccess(assessment.status === 'LOCKED' ? 'Évaluation rouverte ; la prochaine correction sera auditée.' : 'Évaluation verrouillée contre les modifications.');
      await loadAssessments();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Impossible de modifier le verrouillage.'); }
    finally { setSaving(false); }
  }

  async function publishOnlineAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAssessment) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (!onlineStartsAt || !onlineEndsAt) {
        throw new Error('Définissez une date de début et de fin pour l’évaluation en ligne.');
      }
      await apiRequest(`/academic/assessments/${selectedAssessment.id}/online`, {
        method: 'PATCH',
        body: {
          onlineEnabled: true,
          onlineStartsAt,
          onlineEndsAt,
        },
      });
      setSuccess('Évaluation en ligne activée.');
      await loadAssessments();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’activer l’évaluation en ligne.');
    } finally { setSaving(false); }
  }

  async function addExamQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAssessment) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload: Record<string, unknown> = {
        type: questionType,
        prompt: questionPrompt.trim(),
        points: questionPoints,
      };
      if (questionType === 'MULTIPLE_CHOICE') {
        payload.choices = questionChoices.map((choice, index) => ({ text: choice.trim(), isCorrect: index === correctChoiceIndex }));
      }
      if (!questionPrompt.trim()) throw new Error('Rédigez l’énoncé de la question.');
      if (questionType === 'MULTIPLE_CHOICE' && questionChoices.filter((choice) => choice.trim()).length < 2) {
        throw new Error('Ajoutez au moins deux propositions de réponse.');
      }
      await apiRequest(`/academic/assessments/${selectedAssessment.id}/questions`, {
        method: 'POST',
        body: payload,
      });
      setQuestionPrompt('');
      setQuestionPoints('10');
      setQuestionChoices(['', '', '', '']);
      setCorrectChoiceIndex(0);
      setSuccess('Question ajoutée à l’épreuve en ligne.');
      await loadAssessments();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’ajouter la question.');
    } finally { setSaving(false); }
  }

  const assignment = assignments.find((item) => item.id === selectedAssignmentId);
  const terms = assignment?.class.schoolYear.terms ?? [];
  const selectedAssessment = assessments.find((item) => item.id === selectedAssessmentId);
  const tabs: Array<[Tab, string]> = [['assessments', 'Évaluations et saisie'], ['averages', 'Moyennes de période']];
  const scoredCount = useMemo(() => Object.values(scores).filter((value) => value.score.trim()).length, [scores]);

  return (
    <section className="workspace-page academic-workspace academic-grades-page">
      <button className="back-link" onClick={onBack}>← Retour à la vue générale</button>
      <div className="workspace-title-row"><div><p className="eyebrow">SUIVI PÉDAGOGIQUE</p><h1>Notes et évaluations</h1><p>Configurez les évaluations, leurs barèmes et coefficients, puis saisissez les notes.</p></div><span className="module-count">{assignments.length} affectation(s) pédagogique(s)</span></div>
      <div className="admin-warning" role="note"><strong>Paramètres par niveau</strong><span>La note de période présentée ici est une moyenne pondérée normalisée en pourcentage. La formule officielle du bulletin doit encore être validée par la direction.</span></div>
      {error && <div className="feedback-message error-message" role="alert">{error}</div>}
      {success && <div className="feedback-message success-message" role="status">{success}</div>}
      <div className="grade-filters"><label className="field-label">Classe · matière<select value={selectedAssignmentId} onChange={(event) => setSelectedAssignmentId(event.target.value)}><option value="">Choisir une affectation</option>{assignments.map((item) => <option key={item.id} value={item.id}>{item.class.level.name} {item.class.name} · {item.subject.name} · {item.class.schoolYear.name}</option>)}</select></label><label className="field-label">Trimestre<select value={selectedTermId} onChange={(event) => setSelectedTermId(event.target.value)}><option value="">Choisir une période</option>{terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select></label></div>
      <nav className="organization-tabs" aria-label="Gestion des notes">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'organization-tab active' : 'organization-tab'} onClick={() => setTab(id)}>{label}</button>)}</nav>
      {loading && <p className="inline-hint">Chargement des données pédagogiques…</p>}
      {!assignments.length && !loading ? <Empty text="Aucune affectation pédagogique. Configurez les matières et enseignants dans Organisation scolaire." /> : !terms.length && !loading ? <Empty text="Aucun trimestre défini pour l’année de cette classe. Configurez les périodes scolaires avant les évaluations." /> : <>
        {tab === 'assessments' && <div className="grade-layout">
          {can('grades', 'canCreate') && <form className="form-card" onSubmit={(event) => void submit(event, () => apiRequest('/academic/assessments', { method: 'POST', body: { name: assessmentName, assessmentType, classId: assignment?.class.id, subjectId: assignment?.subject.id, termId: selectedTermId, assessmentDate, maximumScore, coefficient } }), 'Évaluation créée.', () => setAssessmentName(''))}>
            <FormHeading title="Créer une évaluation" detail="Le coefficient contribue à la moyenne pondérée de la matière." />
            <label className="field-label">Nom<input required maxLength={100} value={assessmentName} onChange={(event) => setAssessmentName(event.target.value)} placeholder="Composition 1" /></label>
            <label className="field-label">Type<select value={assessmentType} onChange={(event) => setAssessmentType(event.target.value)}><option>Devoir</option><option>Interrogation</option><option>Composition</option><option>Examen</option><option>Oral</option><option>Pratique</option></select></label>
            <div className="form-row"><label className="field-label">Barème<input required type="number" min="0.01" step="0.01" value={maximumScore} onChange={(event) => setMaximumScore(event.target.value)} /></label><label className="field-label">Coefficient<input required type="number" min="0.01" step="0.01" value={coefficient} onChange={(event) => setCoefficient(event.target.value)} /></label></div>
            <label className="field-label">Date<input required type="date" value={assessmentDate} onChange={(event) => setAssessmentDate(event.target.value)} /></label>
            <button className="primary-button" disabled={saving || !assignment || !selectedTermId}>{saving ? 'Enregistrement…' : 'Créer l’évaluation'}</button>
          </form>}
          <div className="grade-assessment-list"><div className="section-heading"><div><p className="eyebrow">ÉVALUATIONS DE LA PÉRIODE</p><h2>{assessments.length} évaluation(s)</h2></div></div>{assessments.length ? <div className="records-list">{assessments.map((assessment) => <button key={assessment.id} className={`assessment-record ${selectedAssessmentId === assessment.id ? 'selected' : ''}`} onClick={() => setSelectedAssessmentId(assessment.id)}><span className="module-number">{assessment.coefficient}×</span><span className="assessment-copy"><strong>{assessment.name}</strong><small>{assessment.assessmentType} · {assessment.maximumScore} pts · {dateLabel(assessment.assessmentDate)} · {assessment.grades.length} note(s)</small></span><span className={`assessment-lock ${assessment.status.toLowerCase()}`}>{assessment.status === 'LOCKED' ? 'Verrouillée' : 'Ouverte'}</span></button>)}</div> : <Empty text="Créez une évaluation pour saisir les notes de cette classe et de cette période." />}</div>
        </div>}
        {tab === 'assessments' && selectedAssessment && <>
          {(can('grades', 'canUpdate') || can('grades', 'canCreate')) && <Gradebook assessment={selectedAssessment} roster={roster} scores={scores} setScores={setScores} saving={saving} scoredCount={scoredCount} onSave={saveGrades} onToggleLock={toggleLock} />}
          {can('grades', 'canUpdate') && <form className="form-card" onSubmit={(event) => void publishOnlineAssessment(event)}>
            <div className="form-card-heading"><span className="module-number">02</span><div><strong>Épreuve en ligne</strong><small>Active la passation sur une fenêtre de dates et ajoute les questions.</small></div></div>
            <label className="field-label">Activer l’épreuve en ligne<input type="checkbox" checked={selectedAssessment.onlineEnabled} onChange={async (event) => {
              const next = event.target.checked;
              setSaving(true);
              setError('');
              setSuccess('');
              try {
                await apiRequest(`/academic/assessments/${selectedAssessment.id}/online`, {
                  method: 'PATCH',
                  body: {
                    onlineEnabled: next,
                    onlineStartsAt: selectedAssessment.onlineStartsAt ?? (onlineStartsAt || undefined),
                    onlineEndsAt: selectedAssessment.onlineEndsAt ?? (onlineEndsAt || undefined),
                  },
                });
                setSuccess(next ? 'Épreuve en ligne activée.' : 'Épreuve en ligne désactivée.');
                await loadAssessments();
              } catch (requestError) {
                setError(requestError instanceof Error ? requestError.message : 'Impossible de modifier le statut en ligne.');
              } finally { setSaving(false); }
            }} /></label>
            <div className="form-row"><label className="field-label">Début<input type="datetime-local" value={selectedAssessment.onlineStartsAt ? selectedAssessment.onlineStartsAt.slice(0, 16) : onlineStartsAt} onChange={(event) => setOnlineStartsAt(event.target.value)} /></label><label className="field-label">Fin<input type="datetime-local" value={selectedAssessment.onlineEndsAt ? selectedAssessment.onlineEndsAt.slice(0, 16) : onlineEndsAt} onChange={(event) => setOnlineEndsAt(event.target.value)} /></label></div>
            <button className="primary-button" disabled={saving || !onlineStartsAt || !onlineEndsAt}>{saving ? 'Mise à jour…' : 'Publier l’épreuve'}</button>
          </form>}
          {can('grades', 'canCreate') && <form className="form-card" onSubmit={(event) => void addExamQuestion(event)}>
            <div className="form-card-heading"><span className="module-number">03</span><div><strong>Question de l’épreuve</strong><small>Ajoutez un QCM ou une question écrite.</small></div></div>
            <label className="field-label">Type<select value={questionType} onChange={(event) => setQuestionType(event.target.value as 'MULTIPLE_CHOICE' | 'WRITTEN')}><option value="MULTIPLE_CHOICE">QCM</option><option value="WRITTEN">Réponse écrite</option></select></label>
            <label className="field-label">Énoncé<textarea value={questionPrompt} onChange={(event) => setQuestionPrompt(event.target.value)} rows={3} placeholder="Question ou consigne" /></label>
            <div className="form-row"><label className="field-label">Points<input type="number" min="1" step="1" value={questionPoints} onChange={(event) => setQuestionPoints(event.target.value)} /></label></div>
            {questionType === 'MULTIPLE_CHOICE' && <div className="exam-choice-list">{questionChoices.map((choice, index) => <div key={index} className="exam-choice-row"><label className="field-label">Choix {index + 1}<input value={choice} onChange={(event) => setQuestionChoices((current) => current.map((existing, existingIndex) => existingIndex === index ? event.target.value : existing))} /></label><label className="inline-option"><input type="radio" name="correct-choice" checked={correctChoiceIndex === index} onChange={() => setCorrectChoiceIndex(index)} /> Bonne réponse</label></div>)}</div>}
            <button className="primary-button" disabled={saving || !questionPrompt.trim()}>{saving ? 'Enregistrement…' : 'Ajouter la question'}</button>
          </form>}
        </>}
        {tab === 'averages' && <AverageReport summary={summary} />}
      </>}
      <div className="security-note"><strong>Protection des résultats</strong><span>Les accès sont contrôlés selon le rôle et les saisies sont auditées. Une évaluation verrouillée doit être rouverte explicitement avant toute modification.</span></div>
    </section>
  );
}

function Gradebook({ assessment, roster, scores, setScores, saving, scoredCount, onSave, onToggleLock }: {
  assessment: Assessment; roster: ClassRoster | null; scores: Record<string, ScoreDraft>; setScores: (update: (current: Record<string, ScoreDraft>) => Record<string, ScoreDraft>) => void; saving: boolean; scoredCount: number; onSave: (event: FormEvent<HTMLFormElement>) => void; onToggleLock: (assessment: Assessment) => void;
}) {
  const { can } = useAccess();
  return <form className="form-card gradebook" onSubmit={onSave}>
    <div className="gradebook-heading"><div><p className="eyebrow">SAISIE DES NOTES</p><h2>{assessment.name} · /{assessment.maximumScore}</h2><small>{assessment.class.level.name} {assessment.class.name} · {assessment.subject.name} · {assessment.term.name} · coefficient {assessment.coefficient}</small></div>{can('grades', 'canUpdate') && <button type="button" className={assessment.status === 'LOCKED' ? 'secondary-button' : 'table-action danger-action'} disabled={saving} onClick={() => onToggleLock(assessment)}>{assessment.status === 'LOCKED' ? 'Rouvrir pour correction' : 'Verrouiller les notes'}</button>}</div>
    {!roster ? <p className="list-empty">Chargement de la classe…</p> : roster.students.length === 0 ? <Empty text="Aucun élève actif inscrit dans cette classe." /> : <div className="student-table-wrap"><table className="student-table grade-table"><thead><tr><th>Élève</th><th>Note / {assessment.maximumScore}</th><th>Appréciation courte</th></tr></thead><tbody>{roster.students.map((student) => <tr key={student.id}><td><strong>{student.lastName} {student.firstName}</strong><small>{student.matricule}</small></td><td><input className="score-input" aria-label={`Note de ${student.firstName} ${student.lastName}`} disabled={assessment.status === 'LOCKED'} type="number" min="0" max={assessment.maximumScore} step="0.01" value={scores[student.id]?.score ?? ''} onChange={(event) => setScores((current) => ({ ...current, [student.id]: { ...(current[student.id] ?? { score: '', comment: '' }), score: event.target.value } }))} /></td><td><input className="comment-input" aria-label={`Appréciation de ${student.firstName} ${student.lastName}`} disabled={assessment.status === 'LOCKED'} maxLength={300} value={scores[student.id]?.comment ?? ''} onChange={(event) => setScores((current) => ({ ...current, [student.id]: { ...(current[student.id] ?? { score: '', comment: '' }), comment: event.target.value } }))} placeholder="Facultatif" /></td></tr>)}</tbody></table></div>}
    <div className="gradebook-footer"><span>{scoredCount} note(s) saisie(s) · seules les notes non vides sont envoyées</span>{can('grades', 'canUpdate') && <button className="primary-button" disabled={saving || assessment.status === 'LOCKED' || scoredCount === 0}>{saving ? 'Enregistrement…' : 'Enregistrer les notes'}</button>}</div>
  </form>;
}

function AverageReport({ summary }: { summary: TermGradeSummary | null }) {
  if (!summary) return <Empty text="Choisissez une classe, une matière et un trimestre pour consulter les moyennes." />;
  return <section className="form-card"><div className="section-heading"><div><p className="eyebrow">RÉSULTATS PONDÉRÉS</p><h2>Moyenne par élève · pourcentage</h2></div><span className="module-count">{summary.assessmentCount} évaluations</span></div>{summary.students.length ? <div className="records-list">{summary.students.map(({ student, averagePercent, assessmentCount }) => <div className="average-row" key={student.id}><div><strong>{student.lastName} {student.firstName}</strong><small>{student.matricule} · {assessmentCount} note(s) comptabilisée(s)</small></div><strong className="average-score">{averagePercent === null ? '—' : `${averagePercent} %`}</strong></div>)}</div> : <Empty text="Aucun élève inscrit dans cette classe." />}<p className="inline-hint">Formule affichée : moyenne pondérée des pourcentages par coefficient. La formule officielle du bulletin reste à valider pour chaque niveau.</p></section>;
}

function FormHeading({ title, detail }: { title: string; detail: string }) { return <div className="form-card-heading"><span className="module-number">01</span><div><strong>{title}</strong><small>{detail}</small></div></div>; }
function Empty({ text }: { text: string }) { return <div className="list-empty"><strong>Rien à afficher</strong><span>{text}</span></div>; }
function dateLabel(value: string) { return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value)); }