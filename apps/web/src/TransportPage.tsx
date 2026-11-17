import { FormEvent, useEffect, useState } from 'react';
import { apiRequest, TransportEligibleStudent, TransportRoute } from './api';
import { useAccess } from './AccessContext';

const directionLabels = {
  TO_SCHOOL: 'Domicile → école',
  FROM_SCHOOL: 'École → domicile',
} as const;

export function TransportPage({ onBack }: { onBack: () => void }) {
  const { can } = useAccess();
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [students, setStudents] = useState<TransportEligibleStudent[]>([]);
  const [name, setName] = useState('');
  const [direction, setDirection] = useState<TransportRoute['direction']>('TO_SCHOOL');
  const [vehicle, setVehicle] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [driverName, setDriverName] = useState('');
  const [capacity, setCapacity] = useState('20');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [nextRoutes, nextStudents] = await Promise.all([
        apiRequest<TransportRoute[]>('/transport/routes'),
        apiRequest<TransportEligibleStudent[]>('/transport/students'),
      ]);
      setRoutes(nextRoutes);
      setStudents(nextStudents);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de charger le transport scolaire.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  async function perform(task: () => Promise<unknown>, message: string) {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await task();
      setSuccess(message);
      await loadData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de terminer cette opération.');
    } finally {
      setSaving(false);
    }
  }

  async function createRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await perform(() => apiRequest('/transport/routes', {
      method: 'POST',
      body: {
        name, direction, capacity: Number(capacity),
        ...(vehicle.trim() ? { vehicle: vehicle.trim() } : {}),
        ...(vehiclePlate.trim() ? { vehiclePlate: vehiclePlate.trim() } : {}),
        ...(driverName.trim() ? { driverName: driverName.trim() } : {}),
      },
    }), 'Ligne de transport créée.');
    setName('');
    setVehicle('');
    setVehiclePlate('');
    setDriverName('');
  }

  const activeRoutes = routes.filter((route) => route.isActive);
  const activeSeats = activeRoutes.reduce((sum, route) => sum + route.students.length, 0);
  const activeCapacity = activeRoutes.reduce((sum, route) => sum + route.capacity, 0);

  return <section className="workspace-page">
    <button className="back-link" onClick={onBack}>← Retour à la vue générale</button>
    <div className="workspace-title-row">
      <div><p className="eyebrow">SERVICES AUX ÉLÈVES</p><h1>Transport scolaire</h1><p>Créez les lignes, définissez les arrêts et affectez les élèves.</p></div>
    </div>
    <section className="portal-summary-grid" aria-label="Résumé du transport scolaire">
      <article className="portal-summary-card"><span>Lignes actives</span><strong>{activeRoutes.length}</strong><small>aller et retour distincts</small></article>
      <article className="portal-summary-card"><span>Élèves transportés</span><strong>{activeSeats}</strong><small>places occupées sur les lignes</small></article>
      <article className="portal-summary-card"><span>Places disponibles</span><strong>{Math.max(0, activeCapacity - activeSeats)}</strong><small>capacité totale des lignes actives</small></article>
      <article className="portal-summary-card"><span>Élèves inscrits</span><strong>{students.length}</strong><small>avec une inscription active</small></article>
    </section>
    {error && <div className="feedback-message error-message" role="alert">{error}</div>}
    {success && <div className="feedback-message success-message" role="status">{success}</div>}
    {can('transport', 'canCreate') && <form className="form-card transport-route-form" onSubmit={(event) => void createRoute(event)}>
      <div className="form-card-heading"><span className="module-number">+</span><div><strong>Créer une ligne</strong><small>Une même ligne ne peut pas dépasser sa capacité déclarée.</small></div></div>
      <label className="field-label">Nom de la ligne<input required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. Route Nord" /></label>
      <label className="field-label">Trajet<select value={direction} onChange={(event) => setDirection(event.target.value as TransportRoute['direction'])}><option value="TO_SCHOOL">Domicile vers école</option><option value="FROM_SCHOOL">École vers domicile</option></select></label>
      <label className="field-label">Véhicule<input maxLength={80} value={vehicle} onChange={(event) => setVehicle(event.target.value)} placeholder="Ex. Minibus" /></label>
      <label className="field-label">Immatriculation<input maxLength={30} value={vehiclePlate} onChange={(event) => setVehiclePlate(event.target.value)} /></label>
      <label className="field-label">Conducteur<input maxLength={120} value={driverName} onChange={(event) => setDriverName(event.target.value)} /></label>
      <label className="field-label">Capacité<input required type="number" min={1} max={200} value={capacity} onChange={(event) => setCapacity(event.target.value)} /></label>
      <button className="primary-button" disabled={saving}>{saving ? 'Enregistrement…' : 'Créer la ligne'}</button>
    </form>}
    <section className="transport-routes-section">
      <div className="section-heading"><div><p className="eyebrow">LIGNES ET AFFECTATIONS</p><h2>Réseau de transport</h2></div><button className="refresh-button" type="button" onClick={() => void loadData()} disabled={loading}>{loading ? 'Chargement…' : 'Actualiser'}</button></div>
      {loading ? <p className="list-empty">Chargement du réseau de transport…</p> : routes.length ? <div className="transport-route-list">{routes.map((route) => (
        <TransportRouteCard
          key={route.id}
          route={route}
          students={students}
          saving={saving}
          canCreate={can('transport', 'canCreate')}
          canUpdate={can('transport', 'canUpdate')}
          canDelete={can('transport', 'canDelete')}
          onPerform={perform}
        />
      ))}</div> : <p className="list-empty">Aucune ligne configurée. Créez une ligne pour commencer.</p>}
    </section>
  </section>;
}

function TransportRouteCard({ route, students, saving, canCreate, canUpdate, canDelete, onPerform }: {
  route: TransportRoute;
  students: TransportEligibleStudent[];
  saving: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onPerform: (task: () => Promise<unknown>, message: string) => Promise<void>;
}) {
  const [stopName, setStopName] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [studentId, setStudentId] = useState('');
  const [stopId, setStopId] = useState('');
  const availableStudents = students.filter((student) => !route.students.some((assignment) => assignment.student.id === student.id));

  function addStop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onPerform(() => apiRequest(`/transport/routes/${route.id}/stops`, {
      method: 'POST',
      body: { name: stopName, ...(arrivalTime ? { arrivalTime } : {}) },
    }), 'Arrêt ajouté à la ligne.');
    setStopName('');
    setArrivalTime('');
  }

  function assignStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onPerform(() => apiRequest(`/transport/routes/${route.id}/students`, {
      method: 'POST',
      body: { studentId, ...(stopId ? { stopId } : {}) },
    }), 'Élève affecté à la ligne.');
    setStudentId('');
    setStopId('');
  }

  return <article className={`transport-route-card ${route.isActive ? '' : 'is-archived'}`}>
    <header className="transport-route-header">
      <div><span className={`transport-direction ${route.direction === 'TO_SCHOOL' ? 'to-school' : 'from-school'}`}>{directionLabels[route.direction]}</span><h3>{route.name}</h3>
        <p>{[route.vehicle, route.vehiclePlate, route.driverName ? `Conducteur : ${route.driverName}` : null].filter(Boolean).join(' · ') || 'Véhicule et conducteur non renseignés'}</p>
      </div>
      <div className="transport-route-capacity"><strong>{route.students.length} / {route.capacity}</strong><span>élèves</span></div>
    </header>
    {route.stops.length ? <ol className="transport-stop-list">{route.stops.map((stop) => <li key={stop.id}><span>{stop.name}</span><small>{stop.arrivalTime ?? 'Horaire à préciser'}</small></li>)}</ol> : <p className="inline-hint">Aucun arrêt défini pour cette ligne.</p>}
    {route.students.length ? <div className="transport-passengers">{route.students.map((assignment) => <div className="transport-passenger" key={assignment.id}>
      <div><strong>{assignment.student.firstName} {assignment.student.lastName}</strong><small>{assignment.student.matricule}{assignment.stop ? ` · ${assignment.stop.name}` : ' · Arrêt non précisé'}</small></div>
      {canDelete && <button className="table-action danger-action" type="button" disabled={saving} onClick={() => void onPerform(() => apiRequest(`/transport/routes/${route.id}/students/${assignment.student.id}`, { method: 'DELETE' }), 'Affectation de transport retirée.')}>Retirer</button>}
    </div>)}</div> : <p className="inline-hint">Aucun élève affecté à cette ligne.</p>}
    {route.isActive && canCreate && <div className="transport-route-forms">
      <form className="transport-inline-form" onSubmit={addStop}>
        <strong>Ajouter un arrêt</strong>
        <label className="field-label">Nom de l’arrêt<input required minLength={2} maxLength={120} value={stopName} onChange={(event) => setStopName(event.target.value)} /></label>
        <label className="field-label">Heure<input type="time" value={arrivalTime} onChange={(event) => setArrivalTime(event.target.value)} /></label>
        <button className="secondary-button" disabled={saving}>Ajouter</button>
      </form>
      <form className="transport-inline-form" onSubmit={assignStudent}>
        <strong>Affecter un élève</strong>
        <label className="field-label">Élève<select required value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">Choisir un élève</option>{availableStudents.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName} · {student.matricule}{student.enrollment ? ` · ${student.enrollment.level.name} ${student.enrollment.name}` : ''}</option>)}</select></label>
        <label className="field-label">Arrêt<select value={stopId} onChange={(event) => setStopId(event.target.value)}><option value="">Non précisé</option>{route.stops.map((stop) => <option key={stop.id} value={stop.id}>{stop.name}</option>)}</select></label>
        <button className="secondary-button" disabled={saving || !availableStudents.length || route.students.length >= route.capacity}>Affecter</button>
      </form>
    </div>}
    {!availableStudents.length && route.isActive && canCreate && <p className="inline-hint">Aucun autre élève actif disponible pour cette ligne.</p>}
    {canUpdate && <div className="transport-route-footer"><button className="table-action" type="button" disabled={saving} onClick={() => void onPerform(() => apiRequest(`/transport/routes/${route.id}`, { method: 'PATCH', body: { isActive: !route.isActive } }), route.isActive ? 'Ligne archivée.' : 'Ligne réactivée.')}>{route.isActive ? 'Archiver la ligne' : 'Réactiver la ligne'}</button></div>}
  </article>;
}
