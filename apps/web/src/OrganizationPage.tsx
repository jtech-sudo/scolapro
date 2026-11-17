import { FormEvent, useEffect, useState } from 'react';
import {
  apiRequest,
  Guardian,
  Level,
  SchoolClass,
  SchoolYear,
  Student,
  Subject,
  Teacher,
  TeachingAssignment,
} from './api';
import { useAccess } from './AccessContext';

type Tab = 'calendar' | 'structure' | 'families' | 'teaching';
type LevelType = 'PRIMARY' | 'MIDDLE' | 'HIGH';

const cycleNames: Record<LevelType, string> = { PRIMARY: 'Primaire', MIDDLE: 'Collège', HIGH: 'Lycée' };

export function OrganizationPage({ onBack }: { onBack: () => void }) {
  const { can } = useAccess();
  const [tab, setTab] = useState<Tab>('calendar');
  const [years, setYears] = useState<SchoolYear[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<TeachingAssignment[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [yearData, levelData, classData, studentData, guardianData, teacherData, subjectData, assignmentData] = await Promise.all([
        apiRequest<SchoolYear[]>('/school-years'),
        apiRequest<Level[]>('/levels'),
        apiRequest<SchoolClass[]>('/classes'),
        apiRequest<{ data: Student[] }>('/students?page=1&pageSize=100'),
        apiRequest<Guardian[]>('/guardians'),
        apiRequest<Teacher[]>('/teachers'),
        apiRequest<Subject[]>('/subjects'),
        apiRequest<TeachingAssignment[]>('/teaching-assignments'),
      ]);
      setYears(yearData);
      setLevels(levelData);
      setClasses(classData);
      setStudents(studentData.data);
      setGuardians(guardianData);
      setTeachers(teacherData);
      setSubjects(subjectData);
      setAssignments(assignmentData);
      setSelectedYearId((current) => yearData.some((year) => year.id === current) ? current : yearData.find((year) => year.isCurrent)?.id ?? yearData[0]?.id ?? '');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les paramètres de l’établissement.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>, task: () => Promise<unknown>, message: string, reset?: () => void) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await task();
      reset?.();
      setSuccess(message);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’enregistrer ces paramètres.');
    } finally {
      setSaving(false);
    }
  }

  async function changeActive(path: string, isActive: boolean, label: string) {
    setError('');
    setSuccess('');
    try {
      await apiRequest(path, { method: 'PATCH', body: { isActive } });
      setSuccess(`${label} ${isActive ? 'réactivé' : 'archivé'}.`);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de modifier le statut.');
    }
  }

  async function removeAssignment(id: string) {
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/teaching-assignments/${id}`, { method: 'DELETE' });
      setSuccess('Affectation retirée.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de retirer cette affectation.');
    }
  }

  async function removeOrganizationItem(path: string, label: string) {
    if (!window.confirm(`Supprimer ${label.toLowerCase()} ? Si des données y sont liées, l’élément sera archivé pour préserver l’historique.`)) return;
    setError('');
    setSuccess('');
    try {
      const result = await apiRequest<{ deleted: boolean; archived: boolean; message: string }>(path, { method: 'DELETE' });
      setSuccess(result.message || `${label} supprimé.`);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : `Impossible de supprimer ${label.toLowerCase()}.`);
    }
  }

  const nav: Array<[Tab, string]> = [
    ['calendar', 'Années et trimestres'],
    ['structure', 'Niveaux et classes'],
    ['families', 'Familles et responsables'],
    ['teaching', 'Équipe et matières'],
  ];

  return (
    <section className="workspace-page">
      <button className="back-link" onClick={onBack}>← Retour à la vue générale</button>
      <div className="workspace-title-row">
        <div><p className="eyebrow">CONFIGURATION DE L’ÉTABLISSEMENT</p><h1>Organisation scolaire</h1><p>Configurez le calendrier, les classes, les familles et l’équipe pédagogique.</p></div>
        <span className="module-count">{years.length} années · {levels.length} niveaux · {classes.length} classes</span>
      </div>
      <nav className="organization-tabs" aria-label="Sections d’organisation scolaire">
        {nav.map(([id, label]) => <button key={id} className={tab === id ? 'organization-tab active' : 'organization-tab'} onClick={() => setTab(id)}>{label}</button>)}
      </nav>
      {error && <div className="feedback-message error-message" role="alert">{error}</div>}
      {success && <div className="feedback-message success-message" role="status">{success}</div>}
      {loading && <p className="inline-hint">Actualisation des données…</p>}

      {tab === 'calendar' && <CalendarTab years={years} selectedYearId={selectedYearId} setSelectedYearId={setSelectedYearId} saving={saving} submit={submit} />}
      {tab === 'structure' && <StructureTab years={years} levels={levels} classes={classes} saving={saving} submit={submit} changeActive={changeActive} removeItem={removeOrganizationItem} />}
      {tab === 'families' && <FamiliesTab students={students} guardians={guardians} saving={saving} submit={submit} />}
      {tab === 'teaching' && <TeachingTab classes={classes} teachers={teachers} subjects={subjects} assignments={assignments} saving={saving} submit={submit} changeActive={changeActive} removeAssignment={removeAssignment} canCreateSubjects={can('grades', 'canCreate')} canUpdateSubjects={can('grades', 'canUpdate')} />}

      <div className="security-note"><strong>Accès et archivage</strong><span>Les permissions dépendent du rôle de chaque membre. Les éléments retirés restent archivés lorsqu’ils sont liés à des données afin de préserver l’historique.</span></div>
    </section>
  );
}

function CalendarTab({ years, selectedYearId, setSelectedYearId, saving, submit }: {
  years: SchoolYear[];
  selectedYearId: string;
  setSelectedYearId: (id: string) => void;
  saving: boolean;
  submit: (event: FormEvent<HTMLFormElement>, task: () => Promise<unknown>, message: string, reset?: () => void) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [isCurrent, setIsCurrent] = useState(false);
  const [termName, setTermName] = useState('');
  const [termOrder, setTermOrder] = useState('1');
  const [termStart, setTermStart] = useState('');
  const [termEnd, setTermEnd] = useState('');
  const chosenYear = years.find((year) => year.id === selectedYearId);
  const terms = chosenYear?.terms ?? [];

  return <>
    <div className="organization-grid two-column">
      <form className="form-card" onSubmit={(event) => void submit(event, () => apiRequest('/school-years', { method: 'POST', body: { name, startsOn, endsOn, isCurrent } }), 'Année scolaire créée.', () => { setName(''); setStartsOn(''); setEndsOn(''); setIsCurrent(false); })}>
        <FormHeading index="01" title="Créer une année scolaire" detail="La première année est activée automatiquement." />
        <label className="field-label">Nom<input required maxLength={30} value={name} onChange={(event) => setName(event.target.value)} placeholder="2026–2027" /></label>
        <div className="form-row"><label className="field-label">Début<input type="date" required value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></label><label className="field-label">Fin<input type="date" required value={endsOn} onChange={(event) => setEndsOn(event.target.value)} /></label></div>
        <label className="checkbox-field"><input type="checkbox" checked={years.length === 0 || isCurrent} disabled={years.length === 0} onChange={(event) => setIsCurrent(event.target.checked)} />Année en cours</label>
        <button className="primary-button" disabled={saving}>{saving ? 'Enregistrement…' : 'Ajouter l’année'}</button>
      </form>

      <div className="form-card">
        <FormHeading index="02" title="Trimestres" detail="Les périodes doivent rester dans l’année choisie." />
        <label className="field-label">Année scolaire<select value={selectedYearId} onChange={(event) => setSelectedYearId(event.target.value)}><option value="">Choisir une année</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? ' · En cours' : ''}</option>)}</select></label>
        <form onSubmit={(event) => void submit(event, () => apiRequest(`/school-years/${selectedYearId}/terms`, { method: 'POST', body: { name: termName, order: Number(termOrder), startsOn: termStart, endsOn: termEnd } }), 'Période scolaire ajoutée.', () => { setTermName(''); setTermOrder(String(terms.length + 2)); setTermStart(''); setTermEnd(''); })}>
          <div className="form-row"><label className="field-label">Nom<input required disabled={!selectedYearId} maxLength={40} value={termName} onChange={(event) => setTermName(event.target.value)} placeholder="1er trimestre" /></label><label className="field-label">Ordre<input required disabled={!selectedYearId} min="1" type="number" value={termOrder} onChange={(event) => setTermOrder(event.target.value)} /></label></div>
          <div className="form-row"><label className="field-label">Début<input required disabled={!selectedYearId} type="date" value={termStart} onChange={(event) => setTermStart(event.target.value)} /></label><label className="field-label">Fin<input required disabled={!selectedYearId} type="date" value={termEnd} onChange={(event) => setTermEnd(event.target.value)} /></label></div>
          <button className="primary-button" disabled={saving || !selectedYearId}>{saving ? 'Enregistrement…' : 'Ajouter la période'}</button>
        </form>
      </div>
    </div>
    <div className="configured-list"><div className="section-heading"><div><p className="eyebrow">CALENDRIER ENREGISTRÉ</p><h2>{chosenYear?.name ?? 'Trimestres'}</h2></div>{chosenYear && !chosenYear.isCurrent && <form onSubmit={(event) => void submit(event, () => apiRequest(`/school-years/${chosenYear.id}`, { method: 'PATCH', body: { isCurrent: true } }), `${chosenYear.name} définie comme année en cours.`)}><button type="submit" className="secondary-button" disabled={saving}>Définir comme année en cours</button></form>}</div>
      {years.length === 0 ? <EmptyState text="Créez une année scolaire pour commencer." /> : terms.length === 0 ? <EmptyState text="Aucun trimestre n’est encore défini pour cette année." /> : <div className="records-list">{terms.map((term) => <div className="record-row" key={term.id}><span className="module-number">{String(term.order).padStart(2, '0')}</span><div><strong>{term.name}</strong><small>{formatDate(term.startsOn)} – {formatDate(term.endsOn)}</small></div><span className="module-state">Configuré</span></div>)}</div>}
    </div>
  </>;
}

function StructureTab({ years, levels, classes, saving, submit, changeActive, removeItem }: {
  years: SchoolYear[]; levels: Level[]; classes: SchoolClass[]; saving: boolean;
  submit: (event: FormEvent<HTMLFormElement>, task: () => Promise<unknown>, message: string, reset?: () => void) => Promise<void>;
  changeActive: (path: string, active: boolean, label: string) => Promise<void>;
  removeItem: (path: string, label: string) => Promise<void>;
}) {
  const [levelName, setLevelName] = useState('');
  const [levelType, setLevelType] = useState<LevelType>('PRIMARY');
  const [className, setClassName] = useState('');
  const [levelId, setLevelId] = useState('');
  const [schoolYearId, setSchoolYearId] = useState('');
  const [editingLevelId, setEditingLevelId] = useState('');
  const [editingLevelName, setEditingLevelName] = useState('');
  const [editingLevelType, setEditingLevelType] = useState<LevelType>('PRIMARY');
  const [editingClassId, setEditingClassId] = useState('');
  const [editingClassName, setEditingClassName] = useState('');
  const [editingClassLevelId, setEditingClassLevelId] = useState('');

  async function saveLevelEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingLevelId) return;
    await submit(event, () => apiRequest(`/levels/${editingLevelId}`, { method: 'PATCH', body: { name: editingLevelName, type: editingLevelType } }), 'Niveau modifié.', () => setEditingLevelId(''));
  }

  async function saveClassEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingClassId) return;
    await submit(event, () => apiRequest(`/classes/${editingClassId}`, { method: 'PATCH', body: { name: editingClassName, levelId: editingClassLevelId } }), 'Classe modifiée.', () => setEditingClassId(''));
  }

  return <>
    <div className="organization-grid two-column">
      <form className="form-card" onSubmit={(event) => void submit(event, () => apiRequest('/levels', { method: 'POST', body: { name: levelName, type: levelType, sortOrder: levels.length + 1 } }), 'Niveau créé.', () => setLevelName(''))}>
        <FormHeading index="01" title="Niveaux scolaires" detail="Les libellés suivent l’organisation pédagogique locale." />
        <label className="field-label">Nom du niveau<input required maxLength={50} value={levelName} onChange={(event) => setLevelName(event.target.value)} placeholder="Ex. CE1, 6e, Seconde" /></label>
        <label className="field-label">Cycle<select value={levelType} onChange={(event) => setLevelType(event.target.value as LevelType)}>{Object.entries(cycleNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button className="primary-button" disabled={saving}>{saving ? 'Enregistrement…' : 'Ajouter le niveau'}</button>
      </form>
      <form className="form-card" onSubmit={(event) => void submit(event, () => apiRequest('/classes', { method: 'POST', body: { name: className, levelId, schoolYearId } }), 'Classe créée.', () => setClassName(''))}>
        <FormHeading index="02" title="Classes" detail="Chaque classe appartient à un niveau et une année." />
        <label className="field-label">Nom de la classe<input required maxLength={60} value={className} onChange={(event) => setClassName(event.target.value)} placeholder="A, B, Groupe 1" /></label>
        <label className="field-label">Niveau<select required value={levelId} onChange={(event) => setLevelId(event.target.value)}><option value="">Choisir un niveau</option>{levels.filter((level) => level.isActive).map((level) => <option key={level.id} value={level.id}>{level.name} · {cycleNames[level.type]}</option>)}</select></label>
        <label className="field-label">Année scolaire<select required value={schoolYearId} onChange={(event) => setSchoolYearId(event.target.value)}><option value="">Choisir une année</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label>
        <button className="primary-button" disabled={saving || !levels.some((level) => level.isActive) || !years.length}>{saving ? 'Enregistrement…' : 'Créer la classe'}</button>
      </form>
    </div>
    <div className="configured-list"><div className="section-heading"><div><p className="eyebrow">STRUCTURE ACTUELLE</p><h2>Niveaux et classes</h2></div></div>
      <div className="organization-grid two-column"><div className="records-list">{levels.map((level) => <div className="record-row organization-record" key={level.id}><span className="module-number">{level.sortOrder}</span>{editingLevelId === level.id ? <form className="inline-edit-form" onSubmit={(event) => void saveLevelEdit(event)}><input required maxLength={50} value={editingLevelName} onChange={(event) => setEditingLevelName(event.target.value)} aria-label="Nom du niveau" /><select value={editingLevelType} onChange={(event) => setEditingLevelType(event.target.value as LevelType)} aria-label="Cycle">{Object.entries(cycleNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button className="table-action" disabled={saving}>Enregistrer</button><button type="button" className="table-action" onClick={() => setEditingLevelId('')}>Annuler</button></form> : <><div><strong>{level.name}</strong><small>{cycleNames[level.type]} · {level._count?.classes ?? 0} classe(s) · {level.isActive ? 'Actif' : 'Archivé'}</small></div><button className="table-action" onClick={() => { setEditingLevelId(level.id); setEditingLevelName(level.name); setEditingLevelType(level.type); }}>Modifier</button><button className="table-action" onClick={() => void changeActive(`/levels/${level.id}`, !level.isActive, 'Niveau')}>{level.isActive ? 'Archiver' : 'Réactiver'}</button><button className="table-action danger-action" onClick={() => void removeItem(`/levels/${level.id}`, 'Niveau')}>Supprimer</button></>}</div>)}{!levels.length && <EmptyState text="Aucun niveau créé." />}</div>
        <div className="records-list">{classes.map((schoolClass) => <div className="record-row organization-record" key={schoolClass.id}><span className="module-number">{schoolClass.level.type === 'PRIMARY' ? 'P' : schoolClass.level.type === 'MIDDLE' ? 'C' : 'L'}</span>{editingClassId === schoolClass.id ? <form className="inline-edit-form" onSubmit={(event) => void saveClassEdit(event)}><input required maxLength={60} value={editingClassName} onChange={(event) => setEditingClassName(event.target.value)} aria-label="Nom de la classe" /><select required value={editingClassLevelId} onChange={(event) => setEditingClassLevelId(event.target.value)} aria-label="Niveau de la classe">{levels.filter((level) => level.isActive).map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select><button className="table-action" disabled={saving}>Enregistrer</button><button type="button" className="table-action" onClick={() => setEditingClassId('')}>Annuler</button></form> : <><div><strong>{schoolClass.level.name} · {schoolClass.name}</strong><small>{schoolClass.schoolYear.name} · {schoolClass._count?.enrollments ?? 0} élèves · {schoolClass.isActive ? 'Active' : 'Archivée'}</small></div><button className="table-action" onClick={() => { setEditingClassId(schoolClass.id); setEditingClassName(schoolClass.name); setEditingClassLevelId(schoolClass.levelId); }}>Modifier</button><button className="table-action" onClick={() => void changeActive(`/classes/${schoolClass.id}`, !schoolClass.isActive, 'Classe')}>{schoolClass.isActive ? 'Archiver' : 'Réactiver'}</button><button className="table-action danger-action" onClick={() => void removeItem(`/classes/${schoolClass.id}`, 'Classe')}>Supprimer</button></>}</div>)}{!classes.length && <EmptyState text="Aucune classe créée." />}</div>
      </div>
    </div>
  </>;
}

function FamiliesTab({ students, guardians, saving, submit }: {
  students: Student[]; guardians: Guardian[]; saving: boolean;
  submit: (event: FormEvent<HTMLFormElement>, task: () => Promise<unknown>, message: string, reset?: () => void) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [studentId, setStudentId] = useState('');
  const [relationship, setRelationship] = useState('Parent');
  const [guardianId, setGuardianId] = useState('');

  async function createAndLink() {
    const guardian = await apiRequest<Guardian>('/guardians', { method: 'POST', body: { firstName, lastName, ...(phone ? { phone } : {}), ...(email ? { email } : {}) } });
    if (studentId) await apiRequest(`/guardians/${guardian.id}/students`, { method: 'POST', body: { studentId, relationship, isPrimary: true } });
  }

  return <>
    <div className="organization-grid two-column">
      <form className="form-card" onSubmit={(event) => void submit(event, createAndLink, 'Responsable familial créé et lié.', () => { setFirstName(''); setLastName(''); setPhone(''); setEmail(''); })}>
        <FormHeading index="01" title="Créer un responsable" detail="Rattachez-le à un élève existant si disponible." />
        <div className="form-row"><label className="field-label">Prénom<input required value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label><label className="field-label">Nom<input required value={lastName} onChange={(event) => setLastName(event.target.value)} /></label></div>
        <div className="form-row"><label className="field-label">Téléphone<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label className="field-label">Courriel<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label></div>
        <label className="field-label">Élève<select value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">Créer sans rattacher</option>{students.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName} · {student.matricule}</option>)}</select></label>
        {studentId && <label className="field-label">Lien familial<input value={relationship} onChange={(event) => setRelationship(event.target.value)} placeholder="Mère, père, tuteur…" /></label>}
        <button className="primary-button" disabled={saving}>{saving ? 'Enregistrement…' : 'Créer le responsable'}</button>
      </form>
      <form className="form-card" onSubmit={(event) => void submit(event, () => apiRequest(`/guardians/${guardianId}/students`, { method: 'POST', body: { studentId, relationship, isPrimary: false } }), 'Élève lié au responsable.', () => { setGuardianId(''); setStudentId(''); })}>
        <FormHeading index="02" title="Lier une famille existante" detail="Un élève peut avoir plusieurs responsables." />
        <label className="field-label">Responsable<select required value={guardianId} onChange={(event) => setGuardianId(event.target.value)}><option value="">Choisir un responsable</option>{guardians.filter((guardian) => guardian.isActive).map((guardian) => <option key={guardian.id} value={guardian.id}>{guardian.firstName} {guardian.lastName} · {guardian.phone ?? 'Sans téléphone'}</option>)}</select></label>
        <label className="field-label">Élève<select required value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">Choisir un élève</option>{students.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName} · {student.matricule}</option>)}</select></label>
        <label className="field-label">Lien familial<input required value={relationship} onChange={(event) => setRelationship(event.target.value)} placeholder="Mère, père, tuteur…" /></label>
        <div className="form-spacer" />
        <button className="primary-button" disabled={saving || !guardians.length || !students.length}>{saving ? 'Enregistrement…' : 'Lier le responsable'}</button>
      </form>
    </div>
    <div className="configured-list"><div className="section-heading"><div><p className="eyebrow">DOSSIERS FAMILIAUX</p><h2>Responsables ({guardians.length})</h2></div></div>
      {guardians.length ? <div className="configured-grid">{guardians.map((guardian) => <article className="configured-card" key={guardian.id}><span className="profile-badge">{guardian.firstName[0]}{guardian.lastName[0]}</span><div><strong>{guardian.firstName} {guardian.lastName}</strong><small>{guardian.phone ?? guardian.email ?? 'Coordonnées à compléter'} · {guardian.students?.length ?? 0} élève(s)</small></div></article>)}</div> : <EmptyState text="Aucun responsable familial enregistré." />}
    </div>
  </>;
}

function TeachingTab({ classes, teachers, subjects, assignments, saving, submit, changeActive, removeAssignment, canCreateSubjects, canUpdateSubjects }: {
  classes: SchoolClass[]; teachers: Teacher[]; subjects: Subject[]; assignments: TeachingAssignment[]; saving: boolean;
  submit: (event: FormEvent<HTMLFormElement>, task: () => Promise<unknown>, message: string, reset?: () => void) => Promise<void>;
  changeActive: (path: string, active: boolean, label: string) => Promise<void>;
  removeAssignment: (id: string) => Promise<void>;
  canCreateSubjects: boolean;
  canUpdateSubjects: boolean;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [editingSubjectId, setEditingSubjectId] = useState('');
  const [editingSubjectName, setEditingSubjectName] = useState('');
  const [editingSubjectCode, setEditingSubjectCode] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [classId, setClassId] = useState('');
  return <>
    <div className="organization-grid two-column">
      <form className="form-card" onSubmit={(event) => void submit(event, () => apiRequest('/teachers', { method: 'POST', body: { firstName, lastName, ...(specialty ? { specialty } : {}) } }), 'Enseignant ajouté.', () => { setFirstName(''); setLastName(''); setSpecialty(''); })}>
        <FormHeading index="01" title="Équipe enseignante" detail="Un matricule interne est généré automatiquement." />
        <div className="form-row"><label className="field-label">Prénom<input required value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label><label className="field-label">Nom<input required value={lastName} onChange={(event) => setLastName(event.target.value)} /></label></div>
        <label className="field-label">Spécialité<input value={specialty} onChange={(event) => setSpecialty(event.target.value)} placeholder="Ex. Mathématiques" /></label>
        <button className="primary-button" disabled={saving}>{saving ? 'Enregistrement…' : 'Ajouter l’enseignant'}</button>
      </form>
      {canCreateSubjects && <form className="form-card" onSubmit={(event) => void submit(event, () => apiRequest('/subjects', { method: 'POST', body: { name: subjectName, code: subjectCode } }), 'Matière ajoutée.', () => { setSubjectName(''); setSubjectCode(''); })}>
        <FormHeading index="02" title="Matières enseignées" detail="Le code est unique et normalisé en majuscules." />
        <label className="field-label">Nom de la matière<input required maxLength={100} value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="Mathématiques" /></label>
        <label className="field-label">Code<input required maxLength={20} value={subjectCode} onChange={(event) => setSubjectCode(event.target.value)} placeholder="MATH" /></label>
        <button className="primary-button" disabled={saving}>{saving ? 'Enregistrement…' : 'Ajouter la matière'}</button>
      </form>}
    </div>
    <form className="form-card assignment-form" onSubmit={(event) => void submit(event, () => apiRequest('/teaching-assignments', { method: 'POST', body: { classId, subjectId, teacherId } }), 'Enseignement affecté à la classe.', () => { setTeacherId(''); setSubjectId(''); setClassId(''); })}>
      <FormHeading index="03" title="Affectations pédagogiques" detail="Associez une matière et un enseignant à chaque classe." />
      <div className="form-row three-column"><label className="field-label">Classe<select required value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">Choisir</option>{classes.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.level.name} · {item.name} · {item.schoolYear.name}</option>)}</select></label><label className="field-label">Matière<select required value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">Choisir</option>{subjects.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}</select></label><label className="field-label">Enseignant<select required value={teacherId} onChange={(event) => setTeacherId(event.target.value)}><option value="">Choisir</option>{teachers.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName}</option>)}</select></label></div>
      <button className="primary-button compact-button" disabled={saving || !classes.length || !subjects.length || !teachers.length}>{saving ? 'Enregistrement…' : 'Créer l’affectation'}</button>
    </form>
    <div className="configured-list"><div className="section-heading"><div><p className="eyebrow">ÉQUIPE ET PROGRAMME</p><h2>Enseignants, matières, affectations</h2></div></div>
      <div className="organization-grid two-column">
        <div className="records-list">{teachers.map((teacher) => <div className="record-row" key={teacher.id}><span className="profile-badge">{teacher.firstName[0]}{teacher.lastName[0]}</span><div><strong>{teacher.firstName} {teacher.lastName}</strong><small>{teacher.employeeNumber} · {teacher.specialty ?? 'Spécialité non précisée'}</small></div><button className="table-action" onClick={() => void changeActive(`/teachers/${teacher.id}`, !teacher.isActive, 'Enseignant')}>{teacher.isActive ? 'Archiver' : 'Réactiver'}</button></div>)}{!teachers.length && <EmptyState text="Aucun enseignant enregistré." />}</div>
        <div className="records-list">{subjects.map((subject) => <div className="record-row organization-record" key={subject.id}><span className="module-number">{(editingSubjectId === subject.id ? editingSubjectCode : subject.code).slice(0, 3)}</span>{editingSubjectId === subject.id ? <form className="inline-edit-form" onSubmit={(event) => void submit(event, () => apiRequest(`/subjects/${subject.id}`, { method: 'PATCH', body: { name: editingSubjectName, code: editingSubjectCode } }), 'Matière modifiée.', () => setEditingSubjectId(''))}><input required minLength={1} maxLength={100} value={editingSubjectName} onChange={(event) => setEditingSubjectName(event.target.value)} aria-label="Nom de la matière" /><input required minLength={1} maxLength={20} value={editingSubjectCode} onChange={(event) => setEditingSubjectCode(event.target.value)} aria-label="Code de la matière" /><button className="table-action" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button><button type="button" className="table-action" disabled={saving} onClick={() => setEditingSubjectId('')}>Annuler</button></form> : <><div><strong>{subject.name}</strong><small>{subject.code} · {subject._count?.assignments ?? 0} classe(s) · {subject.isActive ? 'Active' : 'Archivée'}</small></div>{canUpdateSubjects && <button className="table-action" type="button" onClick={() => { setEditingSubjectId(subject.id); setEditingSubjectName(subject.name); setEditingSubjectCode(subject.code); }}>Modifier</button>}{canUpdateSubjects && <button className="table-action" type="button" onClick={() => void changeActive(`/subjects/${subject.id}`, !subject.isActive, 'Matière')}>{subject.isActive ? 'Archiver' : 'Réactiver'}</button>}</>}</div>)}{!subjects.length && <EmptyState text="Aucune matière définie." />}</div>
      </div>
      <div className="records-list assignment-list">{assignments.map((assignment) => <div className="record-row" key={assignment.id}><span className="module-number">{assignment.subject.code.slice(0, 3)}</span><div><strong>{assignment.subject.name} · {assignment.class.level.name} {assignment.class.name}</strong><small>{assignment.class.schoolYear.name} · {assignment.teacher.firstName} {assignment.teacher.lastName}</small></div><button className="table-action danger-action" onClick={() => void removeAssignment(assignment.id)}>Retirer</button></div>)}{!assignments.length && <EmptyState text="Aucune affectation pédagogique pour le moment." />}</div>
    </div>
  </>;
}

function FormHeading({ index, title, detail }: { index: string; title: string; detail: string }) {
  return <div className="form-card-heading"><span className="module-number">{index}</span><div><strong>{title}</strong><small>{detail}</small></div></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="list-empty"><strong>Rien à afficher</strong><span>{text}</span></div>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value));
}