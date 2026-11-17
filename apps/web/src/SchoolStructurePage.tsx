import { FormEvent, useEffect, useState } from 'react';
import { apiRequest, Level, SchoolClass, SchoolYear } from './api';

type SchoolLevelType = 'PRIMARY' | 'MIDDLE' | 'HIGH';

export function SchoolStructurePage({ onBack }: { onBack: () => void }) {
  const [years, setYears] = useState<SchoolYear[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [yearName, setYearName] = useState('');
  const [yearStart, setYearStart] = useState('');
  const [yearEnd, setYearEnd] = useState('');
  const [yearIsCurrent, setYearIsCurrent] = useState(true);
  const [levelName, setLevelName] = useState('');
  const [levelType, setLevelType] = useState<SchoolLevelType>('PRIMARY');
  const [className, setClassName] = useState('');
  const [classYearId, setClassYearId] = useState('');
  const [classLevelId, setClassLevelId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [yearData, levelData, classData] = await Promise.all([
        apiRequest<SchoolYear[]>('/school-years'),
        apiRequest<Level[]>('/levels'),
        apiRequest<SchoolClass[]>('/classes'),
      ]);
      setYears(yearData);
      setLevels(levelData);
      setClasses(classData);
      setClassYearId((current) => current || yearData.find((year) => year.isCurrent)?.id || yearData[0]?.id || '');
      setClassLevelId((current) => current || levelData[0]?.id || '');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de charger la structure scolaire.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>, action: () => Promise<unknown>, successMessage: string) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await action();
      setSuccess(successMessage);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’enregistrer ces paramètres.');
    } finally {
      setSaving(false);
    }
  }

  const levelTypeNames: Record<SchoolLevelType, string> = {
    PRIMARY: 'Primaire',
    MIDDLE: 'Collège',
    HIGH: 'Lycée',
  };

  return (
    <section className="workspace-page">
      <button className="back-link" onClick={onBack}>← Retour à la vue générale</button>
      <div className="workspace-title-row"><div><p className="eyebrow">PARAMÈTRES DE L’ÉTABLISSEMENT</p><h1>Années et classes</h1><p>Configurez la structure scolaire avant d’affecter les élèves.</p></div><span className="module-count">{years.length} années · {levels.length} niveaux · {classes.length} classes</span></div>
      {error && <div className="feedback-message error-message" role="alert">{error}</div>}
      {success && <div className="feedback-message success-message" role="status">{success}</div>}

      <div className="structure-forms">
        <form className="form-card structure-form" onSubmit={(event) => void handleSubmit(event, () => apiRequest('/school-years', { method: 'POST', body: { name: yearName, startsOn: yearStart, endsOn: yearEnd, isCurrent: yearIsCurrent } }), 'Année scolaire créée.') }>
          <div className="form-card-heading"><span className="module-number">01</span><div><strong>Année scolaire</strong><small>Définissez la période scolaire.</small></div></div>
          <label className="field-label">Nom<input required maxLength={30} value={yearName} onChange={(event) => setYearName(event.target.value)} placeholder="2026–2027" /></label>
          <div className="form-row"><label className="field-label">Début<input required type="date" value={yearStart} onChange={(event) => setYearStart(event.target.value)} /></label><label className="field-label">Fin<input required type="date" value={yearEnd} onChange={(event) => setYearEnd(event.target.value)} /></label></div>
          <label className="checkbox-field"><input type="checkbox" checked={yearIsCurrent} onChange={(event) => setYearIsCurrent(event.target.checked)} />Définir comme année en cours</label>
          <button className="primary-button" disabled={saving}>{saving ? 'Enregistrement…' : 'Ajouter l’année'}</button>
        </form>

        <form className="form-card structure-form" onSubmit={(event) => void handleSubmit(event, () => apiRequest('/levels', { method: 'POST', body: { name: levelName, type: levelType, sortOrder: levels.length + 1 } }), 'Niveau créé.') }>
          <div className="form-card-heading"><span className="module-number">02</span><div><strong>Niveau scolaire</strong><small>Les noms restent configurables.</small></div></div>
          <label className="field-label">Nom du niveau<input required maxLength={50} value={levelName} onChange={(event) => setLevelName(event.target.value)} placeholder="Ex. CE1, 6e, Seconde" /></label>
          <label className="field-label">Cycle<select value={levelType} onChange={(event) => setLevelType(event.target.value as SchoolLevelType)}>{Object.entries(levelTypeNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <div className="form-spacer" />
          <button className="primary-button" disabled={saving}>{saving ? 'Enregistrement…' : 'Ajouter le niveau'}</button>
        </form>

        <form className="form-card structure-form" onSubmit={(event) => void handleSubmit(event, () => apiRequest('/classes', { method: 'POST', body: { name: className, schoolYearId: classYearId, levelId: classLevelId } }), 'Classe créée.') }>
          <div className="form-card-heading"><span className="module-number">03</span><div><strong>Classe</strong><small>Associez classe, niveau et année.</small></div></div>
          <label className="field-label">Nom de la classe<input required maxLength={60} value={className} onChange={(event) => setClassName(event.target.value)} placeholder="Ex. A, B, Groupe 1" /></label>
          <label className="field-label">Niveau<select required value={classLevelId} onChange={(event) => setClassLevelId(event.target.value)}><option value="" disabled>Choisir un niveau</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.name} · {levelTypeNames[level.type]}</option>)}</select></label>
          <label className="field-label">Année scolaire<select required value={classYearId} onChange={(event) => setClassYearId(event.target.value)}><option value="" disabled>Choisir une année</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? ' · En cours' : ''}</option>)}</select></label>
          <button className="primary-button" disabled={saving || levels.length === 0 || years.length === 0}>{saving ? 'Enregistrement…' : 'Ajouter la classe'}</button>
          {(levels.length === 0 || years.length === 0) && <p className="inline-hint">Créez au moins une année et un niveau avant d’ajouter une classe.</p>}
        </form>
      </div>

      <section className="configured-list">
        <div className="section-heading"><div><p className="eyebrow">STRUCTURE ACTUELLE</p><h2>Classes configurées</h2></div><button className="refresh-button" onClick={() => void loadData()} disabled={loading}>{loading ? 'Chargement…' : 'Actualiser'}</button></div>
        {classes.length === 0 && !loading ? <div className="list-empty"><strong>Aucune classe configurée</strong><span>Ajoutez une année, un niveau puis une classe pour commencer les inscriptions.</span></div> : <div className="configured-grid">{classes.map((schoolClass) => <article className="configured-card" key={schoolClass.id}><span className="module-number">{schoolClass.level.type === 'PRIMARY' ? 'P' : schoolClass.level.type === 'MIDDLE' ? 'C' : 'L'}</span><div><strong>{schoolClass.level.name} · {schoolClass.name}</strong><small>{schoolClass.schoolYear.name} · {schoolClass._count?.enrollments ?? 0} inscription(s)</small></div></article>)}</div>}
      </section>
    </section>
  );
}