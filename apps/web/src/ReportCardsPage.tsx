import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiRequest, Level, ReportCardPreview, ReportCardRecord, ReportCardRule, SchoolClass, SchoolProfile, SchoolYear, Term } from './api';
import { useAccess } from './AccessContext';

type Tab = 'rules' | 'prepare' | 'validate';
type Formula = 'WEIGHTED_SUBJECT_PERCENT' | 'WEIGHTED_RAW_SCORE';

const formulas: Record<Formula, string> = {
  WEIGHTED_SUBJECT_PERCENT: 'Moyenne pondérée en pourcentage',
  WEIGHTED_RAW_SCORE: 'Moyenne pondérée sur le barème choisi',
};

export function ReportCardsPage({ onBack }: { onBack: () => void }) {
  const { can } = useAccess();
  const [tab, setTab] = useState<Tab>('rules');
  const [years, setYears] = useState<SchoolYear[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [schoolProfile, setSchoolProfile] = useState<SchoolProfile | null>(null);
  const [rules, setRules] = useState<ReportCardRule[]>([]);
  const [schoolYearId, setSchoolYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [termId, setTermId] = useState('');
  const [preview, setPreview] = useState<ReportCardPreview | null>(null);
  const [reportCards, setReportCards] = useState<ReportCardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [ruleName, setRuleName] = useState('Règle trimestrielle');
  const [scope, setScope] = useState<'LEVEL' | 'CLASS'>('LEVEL');
  const [levelId, setLevelId] = useState('');
  const [ruleClassId, setRuleClassId] = useState('');
  const [maximumScore, setMaximumScore] = useState('20');
  const [formula, setFormula] = useState<Formula>('WEIGHTED_SUBJECT_PERCENT');
  const [rankByAverage, setRankByAverage] = useState(true);
  const [mentionsText, setMentionsText] = useState('80:Très bien\n70:Bien\n60:Assez bien\n0:Aucune mention');

  async function loadBase() {
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
      void apiRequest<SchoolProfile>('/admin/school-profile').then(setSchoolProfile).catch(() => setSchoolProfile(null));
      setSchoolYearId((current) => yearData.some((year) => year.id === current) ? current : yearData.find((year) => year.isCurrent)?.id ?? yearData[0]?.id ?? '');
      setLevelId((current) => levelData.some((level) => level.id === current) ? current : levelData[0]?.id ?? '');
      setRuleClassId((current) => classData.some((item) => item.id === current) ? current : classData[0]?.id ?? '');
      setClassId((current) => classData.some((item) => item.id === current) ? current : classData[0]?.id ?? '');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de charger la structure scolaire.');
    } finally { setLoading(false); }
  }

  async function loadRules() {
    if (!schoolYearId) { setRules([]); return; }
    try { setRules(await apiRequest<ReportCardRule[]>(`/report-cards/rules?schoolYearId=${encodeURIComponent(schoolYearId)}`)); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les règles.'); }
  }

  async function loadCards() {
    if (!classId || !termId) { setReportCards([]); return; }
    const params = new URLSearchParams({ classId, termId });
    try { setReportCards(await apiRequest<ReportCardRecord[]>(`/report-cards?${params}`)); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les bulletins.'); }
  }

  useEffect(() => { void loadBase(); }, []);
  useEffect(() => { void loadRules(); }, [schoolYearId]);
  const yearClasses = classes.filter((item) => item.schoolYear.id === schoolYearId);
  const selectedClass = classes.find((item) => item.id === classId);
  const terms = years.find((year) => year.id === schoolYearId)?.terms ?? [];
  useEffect(() => {
    setClassId((current) => yearClasses.some((item) => item.id === current) ? current : yearClasses[0]?.id ?? '');
  }, [schoolYearId, classes]);
  useEffect(() => {
    const availableTerms = selectedClass ? years.find((year) => year.id === selectedClass.schoolYear.id)?.terms ?? [] : terms;
    setTermId((current) => availableTerms.some((term) => term.id === current) ? current : availableTerms[0]?.id ?? '');
  }, [selectedClass, years]);
  useEffect(() => { setPreview(null); void loadCards(); }, [classId, termId]);

  async function submit(event: FormEvent<HTMLFormElement>, task: () => Promise<unknown>, message: string, reset?: () => void) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try { await task(); reset?.(); setSuccess(message); await loadRules(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Impossible d’enregistrer la règle.'); }
    finally { setSaving(false); }
  }

  function parseMentions() {
    return mentionsText.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const [minimum, ...label] = line.split(':');
      return { minimum: Number(minimum), label: label.join(':').trim() };
    });
  }

  async function buildPreview() {
    if (!classId || !termId) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const params = new URLSearchParams({ classId, termId });
      setPreview(await apiRequest<ReportCardPreview>(`/report-cards/preview?${params}`));
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Impossible de calculer l’aperçu.'); }
    finally { setSaving(false); }
  }

  async function generateCards() {
    if (!classId || !termId) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      await apiRequest('/report-cards/generate', { method: 'POST', body: { classId, termId } });
      setSuccess('Bulletins brouillons générés. Vérifiez-les avant validation.');
      setPreview(null);
      await loadCards();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Impossible de générer les bulletins.'); }
    finally { setSaving(false); }
  }

  async function changeCardStatus(card: ReportCardRecord) {
    const status = card.status === 'VALIDATED' ? 'DRAFT' : 'VALIDATED';
    if (status === 'VALIDATED' && !window.confirm(`Valider définitivement le bulletin de ${card.student.firstName} ${card.student.lastName} ?`)) return;
    if (status === 'DRAFT' && !window.confirm('Rouvrir ce bulletin validé ? Cette correction sera journalisée.')) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      await apiRequest(`/report-cards/${card.id}`, { method: 'PATCH', body: { status } });
      setSuccess(status === 'VALIDATED' ? 'Bulletin validé et verrouillé.' : 'Bulletin rouvert pour correction.');
      await loadCards();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Impossible de modifier le statut du bulletin.'); }
    finally { setSaving(false); }
  }

  const tabs: Array<[Tab, string]> = [['rules', 'Règles de calcul'], ['prepare', 'Préparer les bulletins'], ['validate', 'Validation']];
  const filteredRuleClasses = classes.filter((item) => item.schoolYear.id === schoolYearId && item.level.id === levelId);
  const summaryCards = [
    { label: 'Règles actives', value: String(rules.filter((rule) => rule.effective).length), detail: 'règles validées' },
    { label: 'Classe sélectionnée', value: selectedClass ? `${selectedClass.level.name} ${selectedClass.name}` : '—', detail: selectedClass ? selectedClass.schoolYear.name : 'Aucune classe' },
    { label: 'Bulletins enregistrés', value: String(reportCards.length), detail: 'documents de la période' },
    { label: 'Validés', value: String(reportCards.filter((card) => card.status === 'VALIDATED').length), detail: 'bulletins verrouillés' },
  ];
  const validationQueue = [
    { label: 'À valider', value: String(reportCards.filter((card) => card.status !== 'VALIDATED').length), detail: 'documents restant à contrôler' },
    { label: 'Moyenne la plus haute', value: reportCards.length ? `${Math.max(...reportCards.map((card) => Number(card.overallAverage ?? 0))).toFixed(1)} / 20` : '—', detail: 'meilleure moyenne de la classe' },
    { label: 'Classement', value: selectedClass ? `${selectedClass.level.name} ${selectedClass.name}` : '—', detail: 'équipe de référence' },
  ];

  return <section className="workspace-page academic-workspace academic-report-cards-page">
    <button className="back-link" onClick={onBack}>← Retour à la vue générale</button>
    <div className="workspace-title-row"><div><p className="eyebrow">RÉSULTATS TRIMESTRIELS</p><h1>Bulletins</h1><p>Configurez les calculs, prévisualisez et générez les bulletins avant validation.</p></div><span className="module-count">{rules.filter((rule) => rule.effective).length} règle(s) active(s)</span></div>
    <div className="admin-warning" role="note"><strong>Formules à valider</strong><span>Chaque règle est explicite par niveau ou classe, année et trimestre. Confirmez avec la direction la formule, le classement et les mentions avant l’utilisation officielle.</span></div>
    <section className="report-summary-grid" aria-label="Résumé des bulletins">
      {summaryCards.map((card) => (
        <article className="report-summary-card" key={card.label}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <small>{card.detail}</small>
        </article>
      ))}
    </section>
    <section className="report-overview-grid" aria-label="Suivi de validation des bulletins">
      {validationQueue.map((item) => (
        <article className="report-overview-card" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.detail}</small>
        </article>
      ))}
    </section>
    {error && <div className="feedback-message error-message" role="alert">{error}</div>}
    {success && <div className="feedback-message success-message" role="status">{success}</div>}
    <div className="report-filters"><label className="field-label">Année scolaire<select value={schoolYearId} onChange={(event) => setSchoolYearId(event.target.value)}><option value="">Choisir une année</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label><label className="field-label">Classe<select value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">Choisir une classe</option>{yearClasses.map((item) => <option key={item.id} value={item.id}>{item.level.name} {item.name}</option>)}</select></label><label className="field-label">Trimestre<select value={termId} onChange={(event) => setTermId(event.target.value)}><option value="">Choisir un trimestre</option>{(selectedClass ? years.find((year) => year.id === selectedClass.schoolYear.id)?.terms ?? [] : terms).map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select></label></div>
    <nav className="organization-tabs" aria-label="Gestion des bulletins">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'organization-tab active' : 'organization-tab'} onClick={() => setTab(id)}>{label}</button>)}</nav>
    {loading && <p className="inline-hint">Chargement du calendrier et des règles…</p>}
    {tab === 'rules' && <div className="report-rule-layout">{can('report-cards', 'canCreate') && <form className="form-card" onSubmit={(event) => void submit(event, () => apiRequest('/report-cards/rules', { method: 'POST', body: { name: ruleName, scope, levelId, ...(scope === 'CLASS' ? { classId: ruleClassId } : {}), schoolYearId, termId, maximumScore, formula, rankByAverage, mentions: parseMentions() } }), 'Règle de bulletin enregistrée.', () => setRuleName('Règle trimestrielle'))}>
      <FormHeading title="Configurer une règle" detail="Une règle de classe priorise celle du niveau pour la période." />
      <label className="field-label">Nom de la règle<input required maxLength={100} value={ruleName} onChange={(event) => setRuleName(event.target.value)} /></label>
      <label className="field-label">Portée<select value={scope} onChange={(event) => setScope(event.target.value as 'LEVEL' | 'CLASS')}><option value="LEVEL">Par niveau</option><option value="CLASS">Par classe (remplacement)</option></select></label>
      <label className="field-label">Niveau<select required value={levelId} onChange={(event) => setLevelId(event.target.value)}><option value="">Choisir un niveau</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label>
      {scope === 'CLASS' && <label className="field-label">Classe<select required value={ruleClassId} onChange={(event) => setRuleClassId(event.target.value)}><option value="">Choisir une classe</option>{filteredRuleClasses.map((item) => <option key={item.id} value={item.id}>{item.level.name} {item.name}</option>)}</select></label>}
      <label className="field-label">Trimestre<select required value={termId} onChange={(event) => setTermId(event.target.value)}><option value="">Choisir un trimestre</option>{terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select></label>
      <label className="field-label">Barème du bulletin<input required type="number" min="0.01" step="0.01" value={maximumScore} onChange={(event) => setMaximumScore(event.target.value)} /></label>
      <label className="field-label">Formule<select value={formula} onChange={(event) => setFormula(event.target.value as Formula)}>{Object.entries(formulas).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="checkbox-field"><input type="checkbox" checked={rankByAverage} onChange={(event) => setRankByAverage(event.target.checked)} />Calculer le rang de classe</label>
      <label className="field-label">Seuils de mentions (seuil:libellé, un par ligne)<textarea className="mentions-input" value={mentionsText} onChange={(event) => setMentionsText(event.target.value)} rows={5} /></label>
      <p className="inline-hint">Les seuils sont des pourcentages de la moyenne générale, de 0 à 100. Le plus haut seuil atteint s’applique.</p>
      <button className="primary-button" disabled={saving || !schoolYearId || !termId || !levelId || (scope === 'CLASS' && !ruleClassId)}>{saving ? 'Enregistrement…' : 'Enregistrer la règle'}</button>
    </form>}<div className="records-list report-rule-list">{rules.length ? rules.map((rule) => <div className="record-row" key={rule.id}><span className={`student-status ${rule.effective ? 'active' : 'archived'}`}>{rule.effective ? 'Active' : 'Inactive'}</span><div><strong>{rule.name}</strong><small>{rule.scope === 'CLASS' ? rule.schoolClass?.name : rule.level.name} · {rule.schoolYear.name} · {rule.term.name}</small><small>{formulas[rule.calculationConfig.formula]} · /{rule.maximumScore}</small></div>{can('report-cards', 'canUpdate') && <button className="table-action" onClick={async () => { try { await apiRequest(`/report-cards/rules/${rule.id}`, { method: 'PATCH', body: { effective: !rule.effective } }); await loadRules(); setSuccess(rule.effective ? 'Règle désactivée.' : 'Règle activée.'); } catch (e) { setError(e instanceof Error ? e.message : 'Erreur de modification.'); } }}>{rule.effective ? 'Désactiver' : 'Activer'}</button>}</div>) : <Empty text="Aucune règle définie pour cette année scolaire." />}</div></div>}
    {tab === 'prepare' && <><PrepareTab classId={classId} termId={termId} preview={preview} saving={saving} onPreview={buildPreview} onGenerate={generateCards} />{preview?.students.length ? <ReportCardPrintFeature preview={preview} profile={schoolProfile} /> : null}</>}
    {tab === 'validate' && <ValidateTab classId={classId} termId={termId} cards={reportCards} saving={saving} onRefresh={loadCards} onStatus={changeCardStatus} />}
    <div className="security-note"><strong>Résultats protégés</strong><span>L’authentification et les autorisations par rôle sont actives. Les bulletins validés sont verrouillés et les validations/réouvertures sont tracées.</span></div>
  </section>;
}

function PrepareTab({ classId, termId, preview, saving, onPreview, onGenerate }: { classId: string; termId: string; preview: ReportCardPreview | null; saving: boolean; onPreview: () => Promise<void>; onGenerate: () => Promise<void> }) {
  const { can } = useAccess();
  return <section className="form-card report-prepare"><div className="section-heading"><div><p className="eyebrow">CALCUL ET APERÇU</p><h2>Préparer les bulletins</h2><p className="inline-hint">Choisissez d’abord la classe et le trimestre en haut de la page.</p></div><div className="report-actions"><button className="secondary-button" disabled={saving || !classId || !termId} onClick={() => void onPreview()}>{saving ? 'Calcul…' : 'Calculer l’aperçu'}</button>{can('report-cards', 'canCreate') && <button className="primary-button" disabled={saving || !preview || !preview.students.length} onClick={() => void onGenerate()}>{saving ? 'Traitement…' : 'Générer les brouillons'}</button>}</div></div>{!preview ? <Empty text="Aperçu non calculé. Le calcul n’enregistre aucun bulletin." /> : <><div className="report-preview-banner"><strong>{preview.rule.name}</strong><span>{preview.class.level.name} {preview.class.name} · {preview.term.name} · {formulas[preview.rule.calculationConfig.formula]}</span></div><div className="report-preview-table-wrap"><table className="student-table report-preview-table"><thead><tr><th>Élève</th>{Array.from(new Map(preview.students.flatMap((card) => card.subjects).map((subject) => [subject.code, subject])).values()).map((subject) => <th key={subject.code}>{subject.name}<small>/{preview.rule.maximumScore}</small></th>)}<th>Moyenne</th><th>Rang</th><th>Mention</th></tr></thead><tbody>{preview.students.map((card) => <tr key={card.student.id}><td><strong>{card.student.lastName} {card.student.firstName}</strong><small>{card.student.matricule}</small></td>{Array.from(new Map(preview.students.flatMap((item) => item.subjects).map((subject) => [subject.code, subject])).keys()).map((code) => <td key={code}>{card.subjects.find((subject) => subject.code === code)?.average ?? '—'}</td>)}<td><strong>{card.overallAverage ?? '—'}</strong></td><td>{card.rank ?? '—'}</td><td>{card.mention ?? '—'}</td></tr>)}</tbody></table></div></>}</section>;
}

function ReportCardPrintFeature({ preview, profile }: { preview: ReportCardPreview; profile: SchoolProfile | null }) {
  const [studentId, setStudentId] = useState(preview.students[0]?.student.id ?? '');
  const [showPreview, setShowPreview] = useState(false);
  const selected = preview.students.find((card) => card.student.id === studentId) ?? preview.students[0];
  const address = [profile?.address, [profile?.city, profile?.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  const contactDetails = [profile?.phone, profile?.email, profile?.website, profile?.registrationId ? `N° ${profile.registrationId}` : null].filter(Boolean).join(' · ');
  const isPercentageScale = selected?.formula === 'WEIGHTED_SUBJECT_PERCENT';

  return <section className="form-card report-print-feature">
    <div className="section-heading">
      <div><p className="eyebrow">DOCUMENT INDIVIDUEL</p><h2>Bulletin de notes</h2><p className="inline-hint">Prévisualisez puis imprimez le bulletin d’un élève de la classe sélectionnée.</p></div>
      <div className="report-actions">
        <label className="field-label report-student-select">Élève<select value={selected?.student.id ?? ''} onChange={(event) => { setStudentId(event.target.value); setShowPreview(false); }}>{preview.students.map((card) => <option key={card.student.id} value={card.student.id}>{card.student.lastName} {card.student.firstName}</option>)}</select></label>
        <button className="secondary-button" type="button" disabled={!selected} onClick={() => setShowPreview((current) => !current)}>{showPreview ? 'Masquer l’aperçu' : 'Prévisualiser le bulletin'}</button>
      </div>
    </div>
    {showPreview && selected && <article className="report-card-print-sheet">
      <header className="report-document-header">
        {profile?.logoDataUrl && <img src={profile.logoDataUrl} alt={`Logo ${profile.name}`} />}
        <div className="report-school-details"><strong>{profile?.name || 'Établissement scolaire'}</strong>{profile?.shortName && profile.shortName !== profile.name && <span>{profile.shortName}</span>}{address && <span>{address}</span>}{contactDetails && <span>{contactDetails}</span>}</div>
        <div className="report-document-title"><span>BULLETIN SCOLAIRE</span><strong>{preview.term.name}</strong><small>{preview.class.schoolYear.name}</small></div>
      </header>
      <div className="report-student-details">
        <div><small>ÉLÈVE</small><strong>{selected.student.lastName} {selected.student.firstName}</strong></div>
        <div><small>MATRICULE</small><strong>{selected.student.matricule || '—'}</strong></div>
        <div><small>CLASSE</small><strong>{preview.class.level.name} {preview.class.name}</strong></div>
        <div><small>ANNÉE SCOLAIRE</small><strong>{preview.class.schoolYear.name}</strong></div>
      </div>
      <div className="report-document-table-wrap"><table className="report-document-table">
        <thead><tr><th>Matière</th><th>Notes des évaluations</th><th>Coeff.</th><th>Moyenne{isPercentageScale ? ` / ${selected.maximumScore}` : ''}</th></tr></thead>
        <tbody>{selected.subjects.map((subject) => <tr key={subject.subjectId ?? subject.code}>
          <td><strong>{subject.name}</strong><small>{subject.code}</small></td>
          <td>{subject.grades.length ? <div className="report-grade-list">{subject.grades.map((grade) => <span key={grade.assessmentId}><strong>{grade.score} / {grade.maximumScore}</strong><small>{grade.name} · coef. {grade.coefficient}</small></span>)}</div> : '—'}</td>
          <td>{subject.coefficientTotal}</td>
          <td><strong>{subject.average ?? '—'}</strong></td>
        </tr>)}</tbody>
      </table></div>
      <div className="report-results-summary">
        <div className="report-overall-average"><small>MOYENNE GÉNÉRALE{isPercentageScale ? ` / ${selected.maximumScore}` : ''}</small><strong>{selected.overallAverage ?? '—'}</strong></div>
        <div><small>RANG</small><strong>{selected.rank ? `${selected.rank} / ${selected.classSize}` : '—'}</strong></div>
        <div><small>MENTION</small><strong>{selected.mention ?? '—'}</strong></div>
      </div>
      <div className="report-attendance-line"><strong>Absences</strong><span>Justifiées : ______</span><span>Non justifiées : ______</span></div>
      <section className="report-appreciation"><strong>Appréciation générale</strong><div /></section>
      <footer className="report-signatures"><div><strong>Le professeur principal</strong><span /></div><div><strong>La direction</strong><span /></div><div><strong>Signature du parent</strong><span /></div></footer>
      <div className="report-print-actions"><button type="button" className="primary-button" onClick={() => window.print()}>Imprimer le bulletin</button></div>
    </article>}
  </section>;
}

function ValidateTab({ classId, termId, cards, saving, onRefresh, onStatus }: { classId: string; termId: string; cards: ReportCardRecord[]; saving: boolean; onRefresh: () => Promise<void>; onStatus: (card: ReportCardRecord) => Promise<void> }) {
  const { can } = useAccess();
  useEffect(() => { void onRefresh(); }, [classId, termId]);
  if (!classId || !termId) return <Empty text="Choisissez une classe et un trimestre." />;
  return <section className="form-card"><div className="section-heading"><div><p className="eyebrow">VALIDATION PÉDAGOGIQUE</p><h2>{cards.length} bulletin(s) · {cards.filter((card) => card.status === 'VALIDATED').length} validé(s)</h2></div><button className="refresh-button" onClick={() => void onRefresh()}>Actualiser</button></div>{cards.length ? <div className="records-list">{cards.map((card) => <div className="record-row report-card-record" key={card.id}><span className={`student-status ${card.status === 'VALIDATED' ? 'active' : 'archived'}`}>{card.status === 'VALIDATED' ? 'Validé' : 'Brouillon'}</span><div><strong>{card.student.lastName} {card.student.firstName}</strong><small>{card.student.matricule} · Moyenne {card.overallAverage ?? '—'} · Rang {card.rank ?? '—'} / {card.classSize ?? '—'}</small></div>{can('report-cards', 'canUpdate') && <button className={card.status === 'VALIDATED' ? 'table-action danger-action' : 'table-action'} disabled={saving} onClick={() => void onStatus(card)}>{card.status === 'VALIDATED' ? 'Rouvrir' : 'Valider'}</button>}</div>)}</div> : <Empty text="Aucun brouillon. Calculez un aperçu puis générez les bulletins." />}</section>;
}

function FormHeading({ title, detail }: { title: string; detail: string }) { return <div className="form-card-heading"><span className="module-number">01</span><div><strong>{title}</strong><small>{detail}</small></div></div>; }
function Empty({ text }: { text: string }) { return <div className="list-empty"><strong>Rien à afficher</strong><span>{text}</span></div>; }