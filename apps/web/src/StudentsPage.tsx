import { FormEvent, useEffect, useState } from 'react';
import { apiRequest, SchoolClass, Student, StudentDetails } from './api';
import { useAccess } from './AccessContext';

type StudentsResponse = {
  data: Student[];
  pagination: { total: number; page: number; pageSize: number; pageCount: number };
};

export function StudentsPage({ onBack, initialStudentId }: { onBack: () => void; initialStudentId?: string | null }) {
  const { can } = useAccess();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [search, setSearch] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [sex, setSex] = useState('');
  const [classId, setClassId] = useState('');
  const [enrollmentChoices, setEnrollmentChoices] = useState<Record<string, string>>({});
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentDetails, setStudentDetails] = useState<StudentDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  async function loadData(query = search) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '100' });
      if (query.trim()) params.set('search', query.trim());
      const [studentResponse, classResponse] = await Promise.all([
        apiRequest<StudentsResponse>(`/students?${params.toString()}`),
        apiRequest<SchoolClass[]>('/classes'),
      ]);
      setStudents(studentResponse.data);
      setClasses(classResponse);
      if (query.trim()) {
        const normalizedQuery = query.trim().toLocaleUpperCase('fr');
        const exactMatch = studentResponse.data.find(
          (student) => student.matricule.trim().toLocaleUpperCase('fr') === normalizedQuery,
        );
        setSelectedStudentId(exactMatch?.id ?? null);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les élèves.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData('');
  }, []);

  useEffect(() => {
    if (initialStudentId) setSelectedStudentId(initialStudentId);
  }, [initialStudentId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadData(search), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!selectedStudentId) {
      setStudentDetails(null);
      setDetailsError('');
      return;
    }
    let cancelled = false;
    setDetailsLoading(true);
    setDetailsError('');
    void apiRequest<StudentDetails>(`/students/${selectedStudentId}`)
      .then((details) => { if (!cancelled) setStudentDetails(details); })
      .catch((requestError) => {
        if (!cancelled) setDetailsError(requestError instanceof Error ? requestError.message : 'Impossible de charger le dossier élève.');
      })
      .finally(() => { if (!cancelled) setDetailsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedStudentId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest<Student>('/students', {
        method: 'POST',
        body: {
          firstName,
          lastName,
          ...(dateOfBirth ? { dateOfBirth } : {}),
          ...(sex ? { sex } : {}),
          ...(classId ? { classId } : {}),
        },
      });
      setFirstName('');
      setLastName('');
      setDateOfBirth('');
      setSex('');
      setClassId('');
      setSuccess('L’élève a été inscrit. Son matricule a été créé automatiquement.');
      await loadData(search);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’inscrire cet élève.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStudent(student: Student) {
    setError('');
    setSuccess('');
    try {
      await apiRequest<Student>(`/students/${student.id}`, {
        method: 'PATCH',
        body: { isActive: !student.isActive },
      });
      setSuccess(student.isActive ? 'Le dossier a été archivé.' : 'Le dossier a été réactivé.');
      await loadData(search);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de modifier ce dossier.');
    }
  }

  async function changeEnrollment(student: Student) {
    const nextClassId = enrollmentChoices[student.id];
    if (!nextClassId) return;
    const nextClass = classes.find((item) => item.id === nextClassId);
    if (!nextClass) {
      setError('La classe sélectionnée est introuvable. Actualisez la liste et réessayez.');
      return;
    }
    setError('');
    setSuccess('');
    try {
      await apiRequest<Student>(`/students/${student.id}/enrollments`, { method: 'POST', body: { classId: nextClassId } });
      const currentEnrollment = student.enrollments[0];
      const isReEnrollment = currentEnrollment && currentEnrollment.schoolClass.schoolYear.id !== nextClass.schoolYearId;
      setSuccess(isReEnrollment
        ? `${student.firstName} ${student.lastName} a été réinscrit(e) en ${nextClass.schoolYear.name}.`
        : `Affectation de ${student.firstName} ${student.lastName} mise à jour.`);
      setEnrollmentChoices((current) => ({ ...current, [student.id]: '' }));
      await loadData(search);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de modifier l’inscription.');
    }
  }

  const classGroups = Array.from(
    classes.filter((item) => item.isActive).reduce((groups, item) => {
      const group = groups.get(item.schoolYearId) ?? { name: item.schoolYear.name, classes: [] as SchoolClass[] };
      group.classes.push(item);
      groups.set(item.schoolYearId, group);
      return groups;
    }, new Map<string, { name: string; classes: SchoolClass[] }>()),
    ([yearId, group]) => ({ yearId, ...group }),
  );
  const formatDate = (value: string | null) => value
    ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value))
    : 'Non renseignée';
  const formatAmount = (value: number | string) => `${Number(value).toLocaleString('fr-FR')} F CFA`;

  return (
    <section className="workspace-page">
      <button className="back-link" onClick={onBack}>← Retour à la vue générale</button>
      <div className="workspace-title-row">
        <div><p className="eyebrow">MODULE GESTION SCOLARITÉ</p><h1>Gestion scolarité</h1><p>Gérez les inscriptions, les dossiers élèves, les familles et les affectations scolaires.</p></div>
        <span className="module-count">{students.length} dossier{students.length === 1 ? '' : 's'} affiché{students.length === 1 ? '' : 's'}</span>
      </div>

      <div className="workspace-columns">
        {can('people', 'canCreate') && <form className="form-card" onSubmit={handleSubmit}>
          <div className="form-card-heading"><span className="module-number">+</span><div><strong>Nouvelle inscription</strong><small>Le matricule est attribué automatiquement. Les élèves existants se réinscrivent dans une nouvelle année depuis la liste.</small></div></div>
          <label className="field-label">Prénom<input required maxLength={80} value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" /></label>
          <label className="field-label">Nom<input required maxLength={80} value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" /></label>
          <div className="form-row">
            <label className="field-label">Date de naissance<input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} /></label>
            <label className="field-label">Sexe<select value={sex} onChange={(event) => setSex(event.target.value)}><option value="">Non renseigné</option><option value="F">Féminin</option><option value="M">Masculin</option><option value="OTHER">Autre</option></select></label>
          </div>
          <label className="field-label">Classe<select value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">Aucune classe pour le moment</option>{classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name} · {schoolClass.level.name} · {schoolClass.schoolYear.name}</option>)}</select></label>
          {classes.length === 0 && <p className="inline-hint">Aucune classe n’est configurée. Vous pouvez inscrire l’élève puis créer les classes dans « Années et classes ».</p>}
          <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Créer le dossier élève'}</button>
        </form>}

        <div className="list-card">
          <div className="list-card-heading"><div><strong>Liste des élèves</strong><small>Une recherche exacte par matricule ouvre directement le dossier.</small></div><label className="list-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom ou matricule" aria-label="Rechercher un élève par nom ou matricule" /></label></div>
          {error && <div className="feedback-message error-message" role="alert">{error}</div>}
          {success && <div className="feedback-message success-message" role="status">{success}</div>}
          {loading ? <p className="list-empty">Chargement des dossiers…</p> : students.length === 0 ? <div className="list-empty"><strong>Aucun élève trouvé</strong><span>Inscrivez un élève avec le formulaire ou ajustez la recherche.</span></div> : (
            <div className="student-table-wrap"><table className="student-table"><thead><tr><th>Élève</th><th>Classe</th><th>Responsable(s)</th><th>Statut</th><th><span className="visually-hidden">Action</span></th></tr></thead><tbody>
              {students.map((student) => {
                const enrollment = student.enrollments[0];
                const selectedClass = classes.find((item) => item.id === enrollmentChoices[student.id]);
                const isReEnrollment = Boolean(enrollment && selectedClass && enrollment.schoolClass.schoolYear.id !== selectedClass.schoolYearId);
                return (
                  <tr key={student.id}>
                    <td><strong>{student.firstName} {student.lastName}</strong><small>{student.matricule}</small></td>
                    <td>{enrollment ? <>{enrollment.schoolClass.name}<small>{enrollment.schoolClass.level.name} · {enrollment.schoolClass.schoolYear.name}{enrollment.schoolClass.schoolYear.isCurrent ? ' · année en cours' : ''}</small></> : <span className="muted-cell">Non affecté</span>}</td>
                    <td>{student.guardians?.length ? student.guardians.map((link) => <small key={link.guardian.id}>{link.guardian.firstName} {link.guardian.lastName}{link.isPrimary ? ' · principal' : ''}</small>) : <span className="muted-cell">Non renseigné</span>}</td>
                    <td><span className={`student-status ${student.isActive ? 'active' : 'archived'}`}>{student.isActive ? 'Actif' : 'Archivé'}</span></td>
                    <td><div className="student-actions">
                      <button className="table-action" onClick={() => setSelectedStudentId(student.id)} aria-expanded={selectedStudentId === student.id}>Voir le dossier</button>
                      {can('people', 'canCreate') && <>
                        <select aria-label={`Année et classe de destination pour ${student.firstName} ${student.lastName}`} value={enrollmentChoices[student.id] ?? ''} onChange={(event) => setEnrollmentChoices((current) => ({ ...current, [student.id]: event.target.value }))}>
                          <option value="">Choisir une année et une classe…</option>
                          {classGroups.map((group) => <optgroup key={group.yearId} label={group.name}>{group.classes.map((item) => <option key={item.id} value={item.id}>{item.level.name} · {item.name}</option>)}</optgroup>)}
                        </select>
                        <button className="table-action" disabled={!selectedClass} onClick={() => void changeEnrollment(student)}>{isReEnrollment ? 'Réinscrire' : enrollment ? 'Affecter' : 'Inscrire'}</button>
                      </>}
                      {can('people', 'canUpdate') && <button className="table-action" onClick={() => void toggleStudent(student)}>{student.isActive ? 'Archiver' : 'Réactiver'}</button>}
                    </div></td>
                  </tr>
                );
              })}
            </tbody></table></div>
          )}
        </div>
      </div>
      {selectedStudentId && <section className="student-detail-card" aria-labelledby="student-detail-heading">
        <div className="student-detail-header">
          <div><p className="eyebrow">DOSSIER ÉLÈVE</p><h2 id="student-detail-heading">{studentDetails ? `${studentDetails.firstName} ${studentDetails.lastName}` : 'Chargement du dossier'}</h2></div>
          <button type="button" className="table-action" onClick={() => setSelectedStudentId(null)}>Fermer le dossier</button>
        </div>
        {detailsLoading && <p className="list-empty">Chargement de toutes les informations…</p>}
        {detailsError && <div className="feedback-message error-message" role="alert">{detailsError}</div>}
        {studentDetails && <>
          <div className="student-detail-summary">
            <div><span>Matricule</span><strong>{studentDetails.matricule}</strong></div>
            <div><span>Date de naissance</span><strong>{formatDate(studentDetails.dateOfBirth)}</strong></div>
            <div><span>Sexe</span><strong>{studentDetails.sex === 'F' ? 'Féminin' : studentDetails.sex === 'M' ? 'Masculin' : studentDetails.sex ?? 'Non renseigné'}</strong></div>
            <div><span>Statut du dossier</span><strong>{studentDetails.isActive ? 'Actif' : 'Archivé'}</strong></div>
          </div>

          <div className="student-detail-grid">
            <section className="student-detail-section">
              <h3>Famille et responsables</h3>
              {studentDetails.guardians?.length ? studentDetails.guardians.map((link) => (
                <article className="student-detail-entry" key={link.guardian.id}>
                  <strong>{link.guardian.firstName} {link.guardian.lastName}{link.isPrimary ? ' · principal' : ''}</strong>
                  <span>{link.relationship || 'Lien non renseigné'}</span>
                  <span>{link.guardian.phone || 'Téléphone non renseigné'} · {link.guardian.email || 'Courriel non renseigné'}</span>
                  {link.guardian.address && <span>{link.guardian.address}</span>}
                </article>
              )) : <p className="student-detail-empty">Aucun responsable associé.</p>}
            </section>

            <section className="student-detail-section">
              <h3>Historique scolaire</h3>
              {studentDetails.enrollments.length ? studentDetails.enrollments.map((item) => (
                <article className="student-detail-entry" key={item.id}>
                  <strong>{item.schoolClass.schoolYear.name} · {item.schoolClass.level.name} {item.schoolClass.name}</strong>
                  <span>{item.status === 'ACTIVE' ? 'Inscription active' : item.status === 'TRANSFERRED' ? 'Transféré' : item.status}</span>
                  <span>Inscrit le {formatDate(item.enrolledAt)}</span>
                </article>
              )) : <p className="student-detail-empty">Aucune inscription enregistrée.</p>}
            </section>

            <section className="student-detail-section">
              <h3>Notes et évaluations <small>{studentDetails.grades.length}</small></h3>
              {studentDetails.grades.length ? studentDetails.grades.map((grade) => (
                <article className="student-detail-entry" key={grade.id}>
                  <strong>{grade.assessment.subject.name} · {grade.assessment.name}: {grade.score}/{grade.assessment.maximumScore}</strong>
                  <span>{grade.assessment.term.schoolYear.name} · {grade.assessment.term.name} · {grade.assessment.class.name} · {formatDate(grade.assessment.assessmentDate)}</span>
                  {grade.comment && <span>{grade.comment}</span>}
                </article>
              )) : <p className="student-detail-empty">Aucune note enregistrée.</p>}
            </section>

            <section className="student-detail-section">
              <h3>Bulletins <small>{studentDetails.reportCards.length}</small></h3>
              {studentDetails.reportCards.length ? studentDetails.reportCards.map((card) => (
                <article className="student-detail-entry" key={card.id}>
                  <strong>{card.schoolYear.name} · {card.term.name} · {card.schoolClass.name}</strong>
                  <span>Moyenne : {card.overallAverage ?? 'Non calculée'}{card.rank ? ` · Rang : ${card.rank}/${card.classSize ?? '—'}` : ''} · {card.status === 'VALIDATED' ? 'Validé' : 'Brouillon'}</span>
                  {card.generalComment && <span>{card.generalComment}</span>}
                </article>
              )) : <p className="student-detail-empty">Aucun bulletin enregistré.</p>}
            </section>

            <section className="student-detail-section">
              <h3>Présences récentes <small>{studentDetails.attendance.length}</small></h3>
              {studentDetails.attendance.length ? studentDetails.attendance.map((record) => (
                <article className="student-detail-entry" key={record.id}>
                  <strong>{formatDate(record.session.date)} · {record.session.class.name} · {record.session.slot === 'MORNING' ? 'Matin' : 'Après-midi'}</strong>
                  <span>{record.status === 'PRESENT' ? 'Présent' : record.status === 'ABSENT' ? 'Absent' : record.status === 'LATE' ? 'En retard' : record.status}{record.arrivalTime ? ` à ${record.arrivalTime}` : ''}{record.isJustified ? ' · Justifié' : ''}</span>
                  {record.reason && <span>{record.reason}</span>}
                </article>
              )) : <p className="student-detail-empty">Aucune présence enregistrée.</p>}
            </section>

            <section className="student-detail-section">
              <h3>Factures et paiements <small>{studentDetails.invoices.length}</small></h3>
              {studentDetails.invoices.length ? studentDetails.invoices.map((invoice) => {
                const paid = invoice.allocations
                  .filter((allocation) => allocation.payment.status === 'RECORDED')
                  .reduce((total, allocation) => total + Number(allocation.amount), 0);
                return <article className="student-detail-entry" key={invoice.id}>
                  <strong>{invoice.invoiceNumber} · {invoice.feeType.name} · {invoice.schoolYear.name}</strong>
                  <span>Montant : {formatAmount(invoice.amountDue)} · Payé : {formatAmount(paid)} · Solde : {formatAmount(Math.max(0, Number(invoice.amountDue) - paid))}</span>
                  <span>Échéance : {formatDate(invoice.dueDate)} · {invoice.installments.length} échéance(s)</span>
                  {invoice.allocations.map((allocation) => <span key={allocation.payment.receiptNumber}>Reçu {allocation.payment.receiptNumber} · {formatAmount(allocation.amount)} · {formatDate(allocation.payment.receivedAt)}</span>)}
                </article>;
              }) : <p className="student-detail-empty">Aucune facture enregistrée.</p>}
            </section>

            <section className="student-detail-section">
              <h3>Bibliothèque <small>{studentDetails.libraryLoans.length}</small></h3>
              {studentDetails.libraryLoans.length ? studentDetails.libraryLoans.map((loan) => (
                <article className="student-detail-entry" key={loan.id}>
                  <strong>{loan.book.title}</strong>
                  <span>{loan.book.author || 'Auteur non renseigné'} · Emprunté le {formatDate(loan.issuedAt)} · Retour prévu le {formatDate(loan.dueAt)}</span>
                  <span>{loan.returnedAt ? `Retourné le ${formatDate(loan.returnedAt)}` : 'Pas encore retourné'}</span>
                  {loan.note && <span>{loan.note}</span>}
                </article>
              )) : <p className="student-detail-empty">Aucun emprunt enregistré.</p>}
            </section>
          </div>
        </>}
      </section>}
      <div className="security-note"><strong>Protection des données</strong><span>Les accès sont contrôlés selon les permissions de l’établissement. Archivez les dossiers inutilisés et limitez l’accès aux personnes autorisées.</span></div>
    </section>
  );
}