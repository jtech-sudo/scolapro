import { FormEvent, useEffect, useState } from 'react';
import { apiRequest, LibraryBook, LibraryLoan, Student } from './api';

type Tab = 'catalog' | 'loans' | 'history';

function dateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function LibraryPage({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<Tab>('catalog');
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loans, setLoans] = useState<LibraryLoan[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [category, setCategory] = useState('');
  const [totalCopies, setTotalCopies] = useState('1');
  const [bookSearch, setBookSearch] = useState('');
  const [bookId, setBookId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [dueAt, setDueAt] = useState(dateAfter(14));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [bookData, loanData, studentData] = await Promise.all([
        apiRequest<LibraryBook[]>('/library/books'),
        apiRequest<LibraryLoan[]>('/library/loans'),
        apiRequest<{ data: Student[] }>('/students?page=1&pageSize=100'),
      ]);
      setBooks(bookData);
      setLoans(loanData);
      setStudents(studentData.data.filter((student) => student.isActive));
      setBookId((current) => current && bookData.some((book) => book.id === current && book.isActive && book.availableCopies > 0) ? current : bookData.find((book) => book.isActive && book.availableCopies > 0)?.id ?? '');
      setStudentId((current) => current && studentData.data.some((student) => student.id === current && student.isActive) ? current : studentData.data.find((student) => student.isActive)?.id ?? '');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les données de la bibliothèque.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  async function createBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      await apiRequest<LibraryBook>('/library/books', { method: 'POST', body: { title, author, isbn, category, totalCopies: Number(totalCopies) } });
      setTitle(''); setAuthor(''); setIsbn(''); setCategory(''); setTotalCopies('1');
      setSuccess('Ouvrage ajouté au catalogue.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’ajouter cet ouvrage.');
    } finally { setSaving(false); }
  }

  async function createLoan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      await apiRequest<LibraryLoan>('/library/loans', { method: 'POST', body: { bookId, studentId, dueAt } });
      setSuccess('Prêt enregistré. Un exemplaire a été réservé.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’enregistrer ce prêt.');
    } finally { setSaving(false); }
  }

  async function returnLoan(loan: LibraryLoan) {
    setSaving(true); setError(''); setSuccess('');
    try {
      await apiRequest<LibraryLoan>(`/library/loans/${loan.id}/return`, { method: 'POST' });
      setSuccess(`Retour enregistré pour « ${loan.book.title} ».`);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible d’enregistrer ce retour.');
    } finally { setSaving(false); }
  }

  async function toggleBook(book: LibraryBook) {
    setSaving(true); setError(''); setSuccess('');
    try {
      await apiRequest<LibraryBook>(`/library/books/${book.id}`, { method: 'PATCH', body: { isActive: !book.isActive } });
      setSuccess(book.isActive ? 'Ouvrage archivé.' : 'Ouvrage réactivé.');
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de modifier cet ouvrage.');
    } finally { setSaving(false); }
  }

  const activeLoans = loans.filter((loan) => !loan.returnedAt);
  const returnedLoans = loans.filter((loan) => Boolean(loan.returnedAt));
  const today = new Date().toISOString().slice(0, 10);
  const overdueLoans = activeLoans.filter((loan) => loan.dueAt.slice(0, 10) < today);
  const filteredBooks = books.filter((book) => !bookSearch.trim() || `${book.title} ${book.author ?? ''} ${book.isbn ?? ''} ${book.category ?? ''}`.toLocaleLowerCase('fr').includes(bookSearch.trim().toLocaleLowerCase('fr')));
  const availableBooks = books.filter((book) => book.isActive && book.availableCopies > 0);
  const librarySummary = [
    { label: 'Titres actifs', value: String(books.filter((book) => book.isActive).length), detail: 'ouvrages référencés' },
    { label: 'Exemplaires disponibles', value: String(books.filter((book) => book.isActive).reduce((total, book) => total + book.availableCopies, 0)), detail: 'en stock aujourd’hui' },
    { label: 'Prêts en cours', value: String(activeLoans.length), detail: 'emprunts actifs' },
    { label: 'En retard', value: String(overdueLoans.length), detail: 'retours à surveiller' },
  ];
  const tabs: Array<[Tab, string]> = [['catalog', 'Catalogue'], ['loans', `Prêts en cours (${activeLoans.length})`], ['history', `Historique (${returnedLoans.length})`]];

  return <section className="workspace-page library-page">
    <button className="back-link" onClick={onBack}>← Retour à la vue générale</button>
    <div className="workspace-title-row"><div><p className="eyebrow">GESTION DES RESSOURCES SCOLAIRES</p><h1>Bibliothèque</h1><p>Catalogue, disponibilité et prêts aux élèves.</p></div></div>
    {error && <div className="feedback-message error-message" role="alert">{error}</div>}
    {success && <div className="feedback-message success-message" role="status">{success}</div>}
    <section className="library-summary-grid" aria-label="Résumé de la bibliothèque">
      {librarySummary.map((item) => (
        <article key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.detail}</small>
        </article>
      ))}
    </section>
    <section className="library-operations" aria-label="Suivi opérationnel de la bibliothèque">
      <div className="library-operations-card">
        <span>À traiter</span>
        <strong>{overdueLoans.length ? `${overdueLoans.length} retard(s)` : 'Aucun retard'}</strong>
        <small>{overdueLoans.length ? 'Relancer les élèves concernés' : 'Tout est à jour'}</small>
      </div>
      <div className="library-operations-card">
        <span>Disponibilité</span>
        <strong>{availableBooks.length ? `${availableBooks.length} ouvrages` : '0 ouvrage'}</strong>
        <small>{availableBooks.length ? 'prêts immédiatement disponibles' : 'aucune copie active disponible'}</small>
      </div>
    </section>
    <nav className="organization-tabs" aria-label="Sections de la bibliothèque">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'organization-tab active' : 'organization-tab'} onClick={() => setTab(id)}>{label}</button>)}</nav>
    {loading && <p className="inline-hint">Chargement du catalogue…</p>}
    {!loading && tab === 'catalog' && <div className="organization-grid two-column library-layout">
      <form className="form-card" onSubmit={(event) => void createBook(event)}><div className="form-card-heading"><span className="module-number">01</span><div><strong>Ajouter un ouvrage</strong><small>Les exemplaires disponibles sont suivis automatiquement.</small></div></div>
        <label className="field-label">Titre<input required minLength={1} maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <div className="form-row"><label className="field-label">Auteur<input maxLength={120} value={author} onChange={(event) => setAuthor(event.target.value)} /></label><label className="field-label">Catégorie<input maxLength={80} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Roman, sciences…" /></label></div>
        <div className="form-row"><label className="field-label">ISBN<input maxLength={32} value={isbn} onChange={(event) => setIsbn(event.target.value)} /></label><label className="field-label">Nombre d’exemplaires<input required type="number" min="1" max="10000" step="1" value={totalCopies} onChange={(event) => setTotalCopies(event.target.value)} /></label></div>
        <button className="primary-button" disabled={saving}>{saving ? 'Enregistrement…' : 'Ajouter au catalogue'}</button>
      </form>
      <section className="configured-list library-catalog"><div className="section-heading"><div><p className="eyebrow">INVENTAIRE</p><h2>Ouvrages ({filteredBooks.length})</h2></div><label className="list-search"><span aria-hidden="true">⌕</span><input aria-label="Rechercher un ouvrage" value={bookSearch} onChange={(event) => setBookSearch(event.target.value)} placeholder="Titre, auteur, ISBN" /></label></div>
        {filteredBooks.length ? <div className="records-list">{filteredBooks.map((book) => <div className="record-row library-book-row" key={book.id}><span className={`student-status ${book.isActive ? 'active' : 'archived'}`}>{book.isActive ? `${book.availableCopies}/${book.totalCopies}` : 'Archivé'}</span><div><strong>{book.title}</strong><small>{[book.author, book.category, book.isbn].filter(Boolean).join(' · ') || 'Informations complémentaires à ajouter'}</small></div><button type="button" className="table-action" disabled={saving} onClick={() => void toggleBook(book)}>{book.isActive ? 'Archiver' : 'Réactiver'}</button></div>)}</div> : <Empty text="Aucun ouvrage ne correspond à la recherche." />}
      </section>
    </div>}
    {!loading && tab === 'loans' && <div className="organization-grid two-column library-layout">
      <form className="form-card" onSubmit={(event) => void createLoan(event)}><div className="form-card-heading"><span className="module-number">01</span><div><strong>Enregistrer un prêt</strong><small>Le stock est réservé jusqu’au retour de l’ouvrage.</small></div></div>
        <label className="field-label">Ouvrage<select required value={bookId} onChange={(event) => setBookId(event.target.value)}><option value="">Choisir un ouvrage disponible</option>{availableBooks.map((book) => <option key={book.id} value={book.id}>{book.title} · {book.availableCopies} disponible(s)</option>)}</select></label>
        <label className="field-label">Élève<select required value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">Choisir un élève</option>{students.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName} · {student.matricule}</option>)}</select></label>
        <label className="field-label">Date de retour prévue<input required type="date" min={new Date().toISOString().slice(0, 10)} value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
        <button className="primary-button" disabled={saving || !availableBooks.length || !students.length}>{saving ? 'Enregistrement…' : 'Confirmer le prêt'}</button>
        {!students.length && <p className="inline-hint">Inscrivez un élève avant d’enregistrer un prêt.</p>}
        {!availableBooks.length && <p className="inline-hint">Aucun exemplaire actif n’est disponible.</p>}
      </form>
      <section className="configured-list"><div className="section-heading"><div><p className="eyebrow">EMPRUNTS ACTIFS</p><h2>{activeLoans.length} prêt(s)</h2></div></div>
        {activeLoans.length ? <div className="records-list">{activeLoans.map((loan) => <LoanRow key={loan.id} loan={loan} onReturn={returnLoan} saving={saving} />)}</div> : <Empty text="Aucun prêt en cours." />}
      </section>
    </div>}
    {!loading && tab === 'history' && <section className="configured-list"><div className="section-heading"><div><p className="eyebrow">PRÊTS CLÔTURÉS</p><h2>Historique ({returnedLoans.length})</h2></div></div>{returnedLoans.length ? <div className="records-list">{returnedLoans.map((loan) => <LoanRow key={loan.id} loan={loan} saving={saving} />)}</div> : <Empty text="Aucun retour enregistré." />}</section>}
  </section>;
}

function LoanRow({ loan, onReturn, saving }: { loan: LibraryLoan; onReturn?: (loan: LibraryLoan) => Promise<void>; saving: boolean }) {
  const overdue = !loan.returnedAt && loan.dueAt.slice(0, 10) < new Date().toISOString().slice(0, 10);
  return <div className="record-row library-loan-row"><span className={`student-status ${loan.returnedAt ? 'archived' : overdue ? 'cancelled' : 'active'}`}>{loan.returnedAt ? 'Rendu' : overdue ? 'En retard' : 'En cours'}</span><div><strong>{loan.book.title}</strong><small>{loan.student.firstName} {loan.student.lastName} · {loan.student.matricule} · retour prévu {dateLabel(loan.dueAt)}{loan.returnedAt ? ` · rendu le ${dateLabel(loan.returnedAt)}` : ''}</small></div>{onReturn && !loan.returnedAt && <button type="button" className="table-action" disabled={saving} onClick={() => void onReturn(loan)}>Enregistrer le retour</button>}</div>;
}

function Empty({ text }: { text: string }) { return <div className="list-empty"><strong>Rien à afficher</strong><span>{text}</span></div>; }
function dateLabel(value: string) { return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`)); }
