import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AttendancePage } from './AttendancePage';
import { BillingPage } from './BillingPage';
import { CommunicationPage } from './CommunicationPage';
import { AdministrationPage } from './AdministrationPage';
import { FinancePage } from './FinancePage';
import { GradesPage } from './GradesPage';
import { apiRequest, AuthSession, clearAuthToken, CurrentRolePermissions, CurrentTenant, ModulePermission, SchoolClass, SchoolYear, setAuthToken, Student, Teacher, TenantChoice } from './api';
import { OrganizationPage } from './OrganizationPage';
import { ParentPortalPage } from './ParentPortalPage';
import { ParentPortalAccessPage } from './ParentPortalAccessPage';
import { ReportCardsPage } from './ReportCardsPage';
import { StudentsPage } from './StudentsPage';
import { SecurityPage } from './SecurityPage';
import { DailyReportPage } from './DailyReportPage';
import { LibraryPage } from './LibraryPage';
import { AuthPage } from './AuthPage';
import { PlatformPage } from './PlatformPage';
import { PresentationPage } from './PresentationPage';
import { TeachingDocumentsPage } from './TeachingDocumentsPage';
import { TimetablePage } from './TimetablePage';
import { TransportPage } from './TransportPage';
import { PersonnelPage } from './PersonnelPage';
import { OnlineEnrollmentPage, PublicEnrollmentPage } from './OnlineEnrollmentPage';
import { AccessProvider } from './AccessContext';
import { moduleCategories, modules } from './schoolModules';
import { ModuleIcon } from './ModuleIcon';
import './style.css';

function App() {
  if (window.location.pathname === '/presentation') return <PresentationPage />;
  const publicEnrollmentMatch = window.location.pathname.match(/^\/inscription\/([^/]+)\/?$/);
  if (publicEnrollmentMatch) return <PublicEnrollmentPage schoolSlug={decodeURIComponent(publicEnrollmentMatch[1])} />;
  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const [activeModule, setActiveModule] = useState('overview');
  const [subscriptionPlanOpenCount, setSubscriptionPlanOpenCount] = useState(0);
  const [search, setSearch] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState<Student[]>([]);
  const [studentSearchLoading, setStudentSearchLoading] = useState(false);
  const [studentSearchError, setStudentSearchError] = useState('');
  const [focusedStudentId, setFocusedStudentId] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'checking' | 'ready' | 'database-unavailable' | 'offline'>('checking');
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState('');
  const [overviewStats, setOverviewStats] = useState({ students: 0, girls: 0, boys: 0, teachers: 0, classes: 0, enrollments: 0 });
  const [tenant, setTenant] = useState<CurrentTenant | null>(null);
  const [rolePermissions, setRolePermissions] = useState<ModulePermission[]>([]);
  const [tenantChoices, setTenantChoices] = useState<TenantChoice[]>([]);
  const [tenantError, setTenantError] = useState('');
  const [switchingSchoolId, setSwitchingSchoolId] = useState('');
  const [schoolMenuOpen, setSchoolMenuOpen] = useState(false);
  const [schoolMenuSearch, setSchoolMenuSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const schoolMenuRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const notificationCloseButtonRef = useRef<HTMLButtonElement>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [startupLoading, setStartupLoading] = useState(true);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setStartupLoading(false), 1100);
    return () => window.clearTimeout(timer);
  }, []);
  React.useEffect(() => {
    void apiRequest<{ status: string }>('/health')
      .then(() => apiRequest<{ status: string }>('/health/ready')
        .then(() => setApiStatus('ready'))
        .catch(() => setApiStatus('database-unavailable')))
      .catch(() => setApiStatus('offline'));
    if (new URLSearchParams(window.location.search).has('school')) clearAuthToken();
    if (!sessionStorage.getItem('csp-saas-access-token')) {
      setAuthLoading(false);
      return;
    }
    void apiRequest<CurrentTenant>('/auth/me')
      .then(setTenant)
      .catch(() => { clearAuthToken(); setTenant(null); })
      .finally(() => setAuthLoading(false));
  }, []);
  React.useEffect(() => {
    if (!tenant) {
      setSchoolYears([]);
      setTenantChoices([]);
      setRolePermissions([]);
      setSelectedSchoolYearId('');
      setOverviewStats({ students: 0, girls: 0, boys: 0, teachers: 0, classes: 0, enrollments: 0 });
      return;
    }
    let cancelled = false;
    void apiRequest<CurrentRolePermissions>('/auth/permissions').then((access) => {
      if (cancelled) return;
      setRolePermissions(access.permissions);
      setTenant((current) => current && current.user.role !== access.role
        ? { ...current, user: { ...current.user, role: access.role } }
        : current);
    }).catch((requestError) => {
      if (!cancelled) {
        setRolePermissions([]);
        setTenantError(requestError instanceof Error ? requestError.message : 'Impossible de charger vos droits d’accès.');
      }
    });
    void apiRequest<SchoolYear[]>('/school-years').then((years) => {
      if (cancelled) return;
      setSchoolYears(years);
      setSelectedSchoolYearId(years.find((year) => year.isCurrent)?.id ?? years[0]?.id ?? '');
    }).catch(() => { if (!cancelled) setSchoolYears([]); });
    void apiRequest<TenantChoice[]>('/auth/schools').then((schools) => {
      if (!cancelled) setTenantChoices(schools);
    }).catch(() => { if (!cancelled) setTenantChoices([]); });
    void apiRequest<{ data: Student[]; pagination: { total: number } }>('/students?page=1&pageSize=100').then(({ data, pagination }) => {
      if (!cancelled) {
        const girls = data.filter((student) => student.sex === 'F').length;
        const boys = data.filter((student) => student.sex === 'M').length;
        setOverviewStats((current) => ({ ...current, students: pagination.total, girls, boys }));
      }
    }).catch(() => { if (!cancelled) setOverviewStats((current) => ({ ...current, students: 0, girls: 0, boys: 0 })); });
    void apiRequest<Teacher[]>('/teachers').then((teachers) => {
      if (!cancelled) setOverviewStats((current) => ({ ...current, teachers: teachers.filter((teacher) => teacher.isActive).length }));
    }).catch(() => { if (!cancelled) setOverviewStats((current) => ({ ...current, teachers: 0 })); });
    void apiRequest<SchoolClass[]>('/classes').then((classes) => {
      if (!cancelled) setOverviewStats((current) => ({
        ...current,
        classes: classes.filter((schoolClass) => schoolClass.isActive).length,
        enrollments: classes.reduce((total, schoolClass) => total + (schoolClass._count?.enrollments ?? 0), 0),
      }));
    }).catch(() => { if (!cancelled) setOverviewStats((current) => ({ ...current, classes: 0, enrollments: 0 })); });
    return () => { cancelled = true; };
  }, [tenant]);
  function hasModulePermission(moduleId: string, action: 'canView' | 'canCreate' | 'canUpdate' | 'canDelete' = 'canView') {
    if (tenant?.user.role === 'ADMIN') return true;
    return rolePermissions.some((permission) => permission.module === moduleId && permission[action]);
  }
  React.useEffect(() => {
    if (!schoolMenuOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (!schoolMenuRef.current?.contains(event.target as Node)) setSchoolMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSchoolMenuOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [schoolMenuOpen]);
  React.useEffect(() => {
    if (!drawerOpen && !notificationDrawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        setNotificationDrawerOpen(false);
      }
      if (notificationDrawerOpen && event.key === 'Tab') {
        event.preventDefault();
        notificationCloseButtonRef.current?.focus();
      }
    }
    function handleResize() {
      if (window.innerWidth > 760) setDrawerOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [drawerOpen, notificationDrawerOpen]);
  React.useEffect(() => {
    if (!notificationDrawerOpen) return;
    notificationCloseButtonRef.current?.focus();
    return () => notificationButtonRef.current?.focus();
  }, [notificationDrawerOpen]);
  const filteredModules = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr');
    return modules.filter((module) => {
      if (!hasModulePermission(module.id)) return false;
      const category = moduleCategories.find((item) => item.id === module.category);
      return `${module.title} ${module.description} ${module.options.join(' ')} ${category?.title ?? ''} ${category?.description ?? ''}`
        .toLocaleLowerCase('fr')
        .includes(query);
    });
  }, [search, rolePermissions, tenant?.user.role]);
  const groupedModules = useMemo(() => moduleCategories
    .map((category) => ({ ...category, modules: filteredModules.filter((module) => module.category === category.id) }))
    .filter((category) => category.modules.length > 0), [filteredModules]);
  React.useEffect(() => {
    const query = search.trim();
    if (query.length < 2 || !hasModulePermission('people')) {
      setStudentSearchResults([]);
      setStudentSearchLoading(false);
      setStudentSearchError('');
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setStudentSearchLoading(true);
      setStudentSearchError('');
      const params = new URLSearchParams({ search: query, page: '1', pageSize: '8' });
      void apiRequest<{ data: Student[] }>(`/students?${params.toString()}`)
        .then((response) => { if (!cancelled) setStudentSearchResults(response.data); })
        .catch((requestError) => {
          if (!cancelled) {
            setStudentSearchResults([]);
            setStudentSearchError(requestError instanceof Error ? requestError.message : 'Impossible de rechercher les élèves.');
          }
        })
        .finally(() => { if (!cancelled) setStudentSearchLoading(false); });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [search, rolePermissions, tenant?.user.role, tenant?.school.id]);
  const selectedModule = modules.find((module) => module.id === activeModule);
  const mobileNavigationItems = [
    { id: 'people', label: 'Scolarité' },
    { id: 'timetable', label: 'Planning' },
    { id: 'library', label: 'Bibliothèque' },
    { id: 'billing', label: 'Facture' },
    { id: 'administration', label: 'Paramètres' },
  ].filter((item) => hasModulePermission(item.id));
  React.useEffect(() => {
    if (activeModule !== 'overview' && !hasModulePermission(activeModule)) setActiveModule('overview');
  }, [activeModule, rolePermissions, tenant?.user.role]);
  const selectedSchoolYear = schoolYears.find((year) => year.id === selectedSchoolYearId);
  const availableSchools: TenantChoice[] = tenantChoices.length > 0
    ? tenantChoices
    : tenant ? [{ ...tenant.school, role: tenant.user.role }] : [];
  const filteredAvailableSchools = availableSchools
    .filter((school) => `${school.name} ${school.slug}`.toLocaleLowerCase('fr').includes(schoolMenuSearch.trim().toLocaleLowerCase('fr')))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const roleLabels: Record<string, string> = {
    ADMIN: 'Administrateur', DIRECTOR: 'Direction', SECRETARIAT: 'Secrétariat',
    PEDAGOGICAL_MANAGER: 'Responsable pédagogique', TEACHER: 'Enseignant',
    ACCOUNTANT: 'Comptable', CASHIER: 'Caissier', PARENT: 'Parent',
  };
  const isNouvelEspoirDemo = tenant?.school.id === 'demo-school' || Boolean(tenant?.school.slug.includes('nouvel-espoir'));
  const isSourceDeVie = Boolean(tenant?.school.slug.includes('source-de-vie'));
  const isNazareth = Boolean(tenant && `${tenant.school.name} ${tenant.school.slug}`.toLocaleLowerCase('fr').includes('nazareth'));
  const schoolInitials = isSourceDeVie || isNouvelEspoirDemo ? 'CSP' : tenant?.school.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('fr') ?? '';
  const schoolCircleLabel = isSourceDeVie ? 'CSP\nSource de Vie' : isNouvelEspoirDemo ? 'CSP\nNouvel Espoir' : schoolInitials;
  const apiStatusLabel = apiStatus === 'ready' ? 'API et base connectées' : apiStatus === 'database-unavailable' ? 'Base PostgreSQL indisponible' : apiStatus === 'offline' ? 'API indisponible' : 'Connexion en cours…';
  const dashboardGreeting = tenant?.user.fullName.trim().split(/\s+/)[0] ?? 'équipe';
  const formattedDashboardDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const dashboardDate = formattedDashboardDate.charAt(0).toLocaleUpperCase('fr') + formattedDashboardDate.slice(1);
  const dashboardMetrics = [
    { label: 'ÉLÈVES', value: overviewStats.students.toLocaleString('fr-FR'), detail: 'Effectif total', icon: 'students' },
    { label: 'ENSEIGNANTS', value: overviewStats.teachers.toLocaleString('fr-FR'), detail: 'Enseignants actifs', icon: 'teachers' },
    { label: 'CLASSES', value: overviewStats.classes.toLocaleString('fr-FR'), detail: 'Classes actives', icon: 'classes' },
    { label: 'INSCRIPTIONS', value: overviewStats.enrollments.toLocaleString('fr-FR'), detail: 'Affectations aux classes', icon: 'enrollments' },
  ] as const;
  const quickActions: ReadonlyArray<{
    title: string;
    note: string;
    icon: 'new-student' | 'notes' | 'calendar' | 'report';
  }> = [
    { title: 'Nouvelle inscription', note: 'Dossiers et responsables', icon: 'new-student' },
    { title: 'Saisir des notes', note: 'Évaluations et bulletins', icon: 'notes' },
    { title: 'Emploi du temps', note: 'Plannings et cours', icon: 'calendar' },
    { title: 'Bulletins', note: 'Synthèse trimestrielle', icon: 'report' },
  ];

  function MetricIcon({ type }: { type: (typeof dashboardMetrics)[number]['icon'] | (typeof quickActions)[number]['icon'] }) {
    const props = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
    switch (type) {
      case 'students':
        return <svg {...props}><path d="M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" /><circle cx="10" cy="7" r="3" /><path d="M20 19v-1a4 4 0 0 0-3-3.87" /><path d="M16 4.13a3.6 3.6 0 0 1 0 6.96" /></svg>;
      case 'teachers':
        return <svg {...props}><circle cx="12" cy="7" r="3" /><path d="M5 20v-1a7 7 0 0 1 14 0v1M19 8l2 2-2 2M21 10h-5" /></svg>;
      case 'classes':
        return <svg {...props}><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" /><path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01M15 12v.01M15 15v.01M15 18v.01" /></svg>;
      case 'enrollments':
        return <svg {...props}><path d="M9 6h11M9 12h11M9 18h11" /><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17" /></svg>;
      case 'calendar':
        return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>;
      case 'new-student':
        return <svg {...props}><path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" /><circle cx="9" cy="7" r="3" /><path d="M19 8v6M16 11h6" /><path d="M20 18v1" /></svg>;
      case 'notes':
        return <svg {...props}><path d="M7 3.5h7l5 5V18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" /><path d="M14 3.5V9h5" /><path d="M8 13h8M8 17h6" /></svg>;
      case 'report':
        return <svg {...props}><path d="M7 3.5h9l4 4V18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" /><path d="M16 3.5V8h4" /><path d="M8 12h6M8 16h8" /></svg>;
      default:
        return null;
    }
  }

  async function switchTenant(schoolId: string) {
    if (!schoolId || schoolId === tenant?.school.id || switchingSchoolId) return;
    setTenantError('');
    setSwitchingSchoolId(schoolId);
    try {
      const session = await apiRequest<AuthSession>(`/auth/switch-school/${schoolId}`, { method: 'POST' });
      setAuthToken(session.accessToken);
      setTenant({ user: session.user, school: session.school });
      setActiveModule('overview');
      setSchoolMenuOpen(false);
    } catch (error) {
      setTenantError(error instanceof Error ? error.message : 'Impossible de changer d’établissement.');
    } finally {
      setSwitchingSchoolId('');
    }
  }

  function signOut() {
    clearAuthToken();
    setTenant(null);
    setTenantError('');
    setSchoolMenuOpen(false);
    setDrawerOpen(false);
  }

  function selectModule(moduleId: string) {
    setActiveModule(moduleId);
    setDrawerOpen(false);
    setNotificationDrawerOpen(false);
  }

  function searchModules(value: string) {
    setSearch(value);
    setStudentSearchError('');
    if (value.trim()) setActiveModule('overview');
  }

  function openStudent(studentId: string) {
    setFocusedStudentId(studentId);
    setSearch('');
    setStudentSearchResults([]);
    setActiveModule('people');
    setDrawerOpen(false);
  }

  if (authLoading || startupLoading) return (
    <main className="auth-loading-screen" aria-busy="true">
      <div className="auth-loading-brand" role="status" aria-live="polite">
        <img src="/scolapro-icon.svg" alt="" />
        <strong>ScolaPro</strong>
        <span className="auth-loading-spinner" aria-hidden="true" />
        <span className="visually-hidden">Chargement de ScolaPro…</span>
      </div>
    </main>
  );
  if (!tenant) return <AuthPage onAuthenticated={(session) => setTenant({ user: session.user, school: session.school })} />;

  return (
    <AccessProvider role={tenant.user.role} permissions={rolePermissions}>
    <div className={`app-shell ${isNouvelEspoirDemo ? 'nouvel-espoir-theme' : ''} ${isSourceDeVie ? 'source-de-vie-theme' : ''}`}>
      {drawerOpen && <button type="button" className="drawer-scrim" aria-label="Fermer le menu de navigation" onClick={() => setDrawerOpen(false)} />}
      <aside id="primary-navigation" className={`sidebar ${drawerOpen ? 'is-open' : ''}`} aria-label="Navigation de l’espace école">
        <a className="brand" href="#accueil" onClick={() => setActiveModule('overview')} aria-label={`${tenant.school.name} — accueil`}>
          {isNazareth ? <img className="brand-logo school-custom-logo" src="/nazareth-madaoua.png" alt="Logo de l’école Nazareth Madaoua" /> : isSourceDeVie ? <img className="brand-logo source-de-vie-logo" src="/icons.jpeg" alt="Logo original du Complexe Scolaire Privé Source de Vie" /> : isNouvelEspoirDemo ? <img className="brand-logo" src="/csp.png" alt="Logo de l’école modèle Nouvel Espoir" /> : <span className="brand-school-mark" aria-hidden="true">{schoolInitials}</span>}
          <span className="brand-school-copy">
            <small>ÉTABLISSEMENT SCOLAIRE</small>
            <strong className="brand-school-name">{tenant.school.name}</strong>
          </span>
        </a>
        <p className="nav-heading">ESPACE DE TRAVAIL</p>
        <label className="drawer-search-box">
          <span aria-hidden="true">⌕</span>
          <input type="search" value={search} onChange={(event) => searchModules(event.target.value)} placeholder="Rechercher dans tous les modules" aria-label="Rechercher dans tous les modules et leurs options" />
        </label>
        <nav className="module-nav" aria-label="Navigation principale">
          <button className={`nav-item ${activeModule === 'overview' ? 'is-active' : ''}`} onClick={() => selectModule('overview')} aria-current={activeModule === 'overview' ? 'page' : undefined}>
            <span className="nav-icon dashboard-nav-icon">⌂</span><span>Vue générale</span>
          </button>
          {groupedModules.map((group) => (
            <div key={group.id} className="module-nav-group">
              <span className="module-nav-group-title">{group.title}</span>
              {group.modules.map((module) => (
                <button key={module.id} className={`nav-item ${activeModule === module.id ? 'is-active' : ''}`} onClick={() => selectModule(module.id)} aria-current={activeModule === module.id ? 'page' : undefined}>
                  <span className="nav-icon nav-module-icon" aria-hidden="true"><ModuleIcon moduleId={module.id} /></span><span>{module.title}</span>
                </button>
              ))}
            </div>
          ))}
          {search && filteredModules.length === 0 && <p className="empty-search">Aucun module correspondant.</p>}
        </nav>

        <div className="sidebar-bottom">
          {tenant.user.role === 'ADMIN' && <button type="button" className="sidebar-premium-button" onClick={() => { selectModule('billing'); setSubscriptionPlanOpenCount((count) => count + 1); }}>
            <span aria-hidden="true">✦</span> Go Premium
          </button>}
          <div className="drawer-account">
            <span className="drawer-account-avatar" aria-hidden="true">{tenant.user.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('fr')}</span>
            <span className="drawer-account-copy"><strong>{tenant.user.fullName}</strong><small>{roleLabels[tenant.user.role] ?? tenant.user.role}</small></span>
            <button type="button" className="drawer-signout" onClick={signOut} aria-label="Se déconnecter">↗</button>
          </div>
          <span className={`setup-indicator api-status-${apiStatus}`}><i /> {apiStatusLabel}</span>
          <p>Limitez les accès aux personnes autorisées et vérifiez régulièrement vos sauvegardes.</p>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button type="button" className="mobile-menu-button" aria-label={drawerOpen ? 'Fermer le menu de navigation' : 'Ouvrir le menu de navigation'} aria-controls="primary-navigation" aria-expanded={drawerOpen} onClick={() => setDrawerOpen((open) => !open)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <strong className="mobile-appbar-title">{activeModule === 'administration' ? 'Paramètres' : selectedModule?.title ?? 'Vue générale'}</strong>
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input type="search" value={search} onChange={(event) => searchModules(event.target.value)} placeholder="Rechercher dans tous les modules" aria-label="Rechercher dans tous les modules et leurs options" />
            <kbd>⌘ K</kbd>
          </label>
          <div className="topbar-actions">
            <button
              ref={notificationButtonRef}
              type="button"
              className="notification-trigger"
              aria-label="Ouvrir les notifications"
              aria-controls="notification-drawer"
              aria-expanded={notificationDrawerOpen}
              onClick={() => {
                setDrawerOpen(false);
                setNotificationDrawerOpen((open) => !open);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
            </button>
            <div className="topbar-active-school"><span><small>ÉTABLISSEMENT</small><strong>{isNouvelEspoirDemo ? 'CSP NOUVEL ESPOIR DE GALMI' : tenant.school.name}</strong></span></div>
            <label className="year-select"><span>Année scolaire</span><select aria-label="Année scolaire" value={selectedSchoolYearId} onChange={(event) => setSelectedSchoolYearId(event.target.value)}><option value="">À configurer</option>{schoolYears.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isCurrent ? ' · En cours' : ''}</option>)}</select></label>
            <div className="sidebar-school-switcher topbar-school-switcher" ref={schoolMenuRef}>
              <button type="button" className="sidebar-school-current" aria-expanded={schoolMenuOpen} aria-haspopup="menu" onClick={() => { setSchoolMenuOpen((open) => !open); setTenantError(''); }}>
                <span className={`sidebar-school-avatar ${isNouvelEspoirDemo ? 'nouvel-espoir-school-avatar' : ''}`}>{isNazareth ? <img src="/nazareth-madaoua.png" alt="" /> : schoolInitials}</span>
                <span className="sidebar-school-copy"><small>CHANGER D’ÉCOLE</small><strong>{isNouvelEspoirDemo ? 'NOUVEL ESPOIR' : tenant.school.name}</strong></span>
                <span className={`school-switch-chevron ${schoolMenuOpen ? 'open' : ''}`} aria-hidden="true">⌄</span>
              </button>
              {schoolMenuOpen && <div className="school-switch-menu" role="menu" aria-label="Vos espaces école">
                <div className="school-menu-heading"><strong>Vos espaces école</strong><small>{availableSchools.length} {availableSchools.length === 1 ? 'établissement' : 'établissements'}</small></div>
                {availableSchools.length > 5 && <label className="school-menu-search"><span aria-hidden="true">⌕</span><input type="search" value={schoolMenuSearch} onChange={(event) => setSchoolMenuSearch(event.target.value)} placeholder="Rechercher une école…" aria-label="Rechercher dans vos écoles" /></label>}
                <div className="school-menu-list">{filteredAvailableSchools.map((school) => <button type="button" role="menuitemradio" aria-checked={school.id === tenant.school.id} key={school.id} disabled={Boolean(switchingSchoolId)} className={`school-menu-option ${school.id === tenant.school.id ? 'is-current' : ''}`} onClick={() => void switchTenant(school.id)}><span className="school-menu-avatar">{school.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('fr')}</span><span><strong>{school.name}</strong><small>{roleLabels[school.role] ?? school.role}{school.id === tenant.school.id ? ' · Actif' : ''}</small></span>{switchingSchoolId === school.id ? <i className="school-option-spinner" /> : school.id === tenant.school.id ? <b aria-hidden="true">✓</b> : <span className="school-option-arrow" aria-hidden="true">↗</span>}</button>)}</div>
                <div className="school-menu-account"><span className="account-avatar">{tenant.user.fullName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('fr')}</span><span><strong>{tenant.user.fullName}</strong><small>{roleLabels[tenant.user.role] ?? tenant.user.role}</small></span><button type="button" onClick={signOut}>Quitter</button></div>
              </div>}
            </div>
          </div>
        </header>
        {notificationDrawerOpen && (
          <>
            <button
              type="button"
              className="notification-scrim"
              aria-label="Fermer les notifications"
              onClick={() => setNotificationDrawerOpen(false)}
            />
            <aside
              id="notification-drawer"
              className="notification-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="notification-drawer-title"
            >
              <div className="notification-drawer-header">
                <div>
                  <p className="eyebrow">CENTRE DE NOTIFICATIONS</p>
                  <h2 id="notification-drawer-title">Notifications</h2>
                </div>
                <button
                  ref={notificationCloseButtonRef}
                  type="button"
                  className="notification-close"
                  aria-label="Fermer les notifications"
                  onClick={() => setNotificationDrawerOpen(false)}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                </button>
              </div>
              <div className="notification-empty-state">
                <span className="notification-empty-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
                </span>
                <h3>Aucune notification</h3>
                <p>Les alertes et les mises à jour de votre établissement apparaîtront ici.</p>
                <small>Le service de notifications n’est pas encore connecté.</small>
              </div>
            </aside>
          </>
        )}

        <div className="content">
          {tenantError && <div className="tenant-feedback" role="alert"><span>{tenantError}</span><button type="button" aria-label="Fermer" onClick={() => setTenantError('')}>×</button></div>}
          {activeModule === 'administration' ? <AdministrationPage onBack={() => setActiveModule('overview')} canResetPasswords={hasModulePermission('administration', 'canUpdate')} /> : activeModule === 'attendance' ? <AttendancePage onBack={() => setActiveModule('overview')} /> : activeModule === 'timetable' ? <TimetablePage onBack={() => setActiveModule('overview')} /> : activeModule === 'communication' ? <CommunicationPage onBack={() => setActiveModule('overview')} /> : activeModule === 'transport' ? <TransportPage onBack={() => setActiveModule('overview')} /> : activeModule === 'personnel' ? <PersonnelPage onBack={() => setActiveModule('overview')} /> : activeModule === 'online-enrollment' ? <OnlineEnrollmentPage onBack={() => setActiveModule('overview')} schoolSlug={tenant.school.slug} /> : activeModule === 'report-cards' ? <ReportCardsPage onBack={() => setActiveModule('overview')} /> : activeModule === 'parent-portal' ? <ParentPortalPage onBack={() => setActiveModule('overview')} /> : activeModule === 'grades' ? <GradesPage onBack={() => setActiveModule('overview')} /> : activeModule === 'finance' ? <FinancePage onBack={() => setActiveModule('overview')} /> : activeModule === 'accounting' ? <FinancePage onBack={() => setActiveModule('overview')} initialTab="accounting" /> : activeModule === 'statistics' ? <DailyReportPage onBack={() => setActiveModule('overview')} /> : activeModule === 'library' ? <LibraryPage onBack={() => setActiveModule('overview')} /> : activeModule === 'billing' ? <BillingPage onBack={() => setActiveModule('overview')} isSchoolAdmin={tenant.user.role === 'ADMIN'} openSubscriptionCount={subscriptionPlanOpenCount} /> : activeModule === 'security' ? <SecurityPage onBack={() => setActiveModule('overview')} /> : activeModule === 'people' ? <StudentsPage onBack={() => setActiveModule('overview')} initialStudentId={focusedStudentId} /> : activeModule === 'teaching-documents' ? <TeachingDocumentsPage onBack={() => setActiveModule('overview')} /> : activeModule === 'school-year' ? <OrganizationPage onBack={() => setActiveModule('overview')} /> : activeModule === 'overview' ? (
            <>
              <section className="dashboard-panel">
                <div className="dashboard-header">
                  <h1>Bonjour, {dashboardGreeting}</h1>
                  <p>{dashboardDate}</p>
                </div>

                <div className="dashboard-metrics" aria-label="Résumé du tableau de bord">
                  {dashboardMetrics.map((metric) => (
                    <article className="dashboard-metric-card" key={metric.label}>
                      <div className="dashboard-metric-top">
                        <span className="dashboard-metric-label">{metric.label}</span>
                        <span className="dashboard-metric-icon" aria-hidden="true"><MetricIcon type={metric.icon} /></span>
                      </div>
                      <div className="dashboard-metric-value">{metric.value}</div>
                      <div className="dashboard-metric-detail">{metric.detail}</div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="section-block">
                <div className="section-heading"><div><p className="eyebrow">POUR COMMENCER</p><h2>Accès rapides</h2></div><span className="section-note">Raccourcis de votre espace</span></div>
                <div className="quick-grid">
                  {quickActions.filter((action) => {
                    const moduleId = { 'new-student': 'people', notes: 'grades', calendar: 'attendance', report: 'report-cards' }[action.icon];
                    const requiredAction = action.icon === 'report' ? 'canView' : 'canCreate';
                    return hasModulePermission(moduleId, requiredAction);
                  }).map((action) => (
                    <button
                      className="quick-card"
                      key={action.title}
                      type="button"
                      onClick={() => setActiveModule({ 'new-student': 'people', notes: 'grades', calendar: 'attendance', report: 'report-cards' }[action.icon])}
                    >
                      <span className="quick-icon" aria-hidden="true"><MetricIcon type={action.icon} /></span>
                      <span><strong>{action.title}</strong><small>{action.note}</small></span>
                      <span className="quick-card-arrow" aria-hidden="true">↗</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="section-block modules-section">
                <div className="section-heading"><div><p className="eyebrow">{search.trim() ? 'RECHERCHE GLOBALE' : 'ORGANISATION SCOLAIRE'}</p><h2>{search.trim() ? `Résultats pour « ${search.trim()} »` : 'Tous les modules'}</h2></div><span className="module-count">{filteredModules.length} {filteredModules.length === 1 ? 'module' : 'modules'}</span></div>
                {search.trim().length >= 2 && hasModulePermission('people') && <section className="global-student-results" aria-live="polite">
                  <div className="global-student-results-heading"><strong>Élèves</strong><span>{studentSearchLoading ? 'Recherche…' : `${studentSearchResults.length} résultat${studentSearchResults.length === 1 ? '' : 's'}`}</span></div>
                  {studentSearchError ? <p className="global-student-empty error-message" role="alert">{studentSearchError}</p>
                    : studentSearchResults.length > 0 ? <div className="global-student-result-list">{studentSearchResults.map((student) => {
                      const enrollment = student.enrollments[0];
                      return <button type="button" className="global-student-result" key={student.id} onClick={() => openStudent(student.id)}>
                        <span className="global-student-avatar" aria-hidden="true">{student.firstName.charAt(0)}{student.lastName.charAt(0)}</span>
                        <span className="global-student-copy"><strong>{student.firstName} {student.lastName}</strong><small>{student.matricule}{enrollment ? ` · ${enrollment.schoolClass.level.name} ${enrollment.schoolClass.name} · ${enrollment.schoolClass.schoolYear.name}` : ' · Non affecté'}</small></span>
                        <span className="global-student-open">Ouvrir ↗</span>
                      </button>;
                    })}</div>
                    : !studentSearchLoading && <p className="global-student-empty">Aucun élève trouvé pour cette recherche.</p>}
                </section>}
                {groupedModules.length > 0 ? groupedModules.map((group) => (
                  <div className="module-category-group" data-category={group.id} key={group.id}>
                    <div className="module-category-header">
                      <div>
                        <h3 className="module-category-label">{group.title}</h3>
                        <p className="module-category-description">{group.description}</p>
                      </div>
                      <span className="module-category-count">{group.modules.length}</span>
                    </div>
                    <div className="module-grid">
                      {group.modules.map((module) => (
                        <button className="module-card" key={module.id} onClick={() => setActiveModule(module.id)}>
                          <span className="module-card-top"><span className="module-number module-icon-badge" aria-hidden="true"><ModuleIcon moduleId={module.id} /></span><span className="module-arrow" aria-hidden="true">↗</span></span>
                          <strong>{module.title}</strong>
                          <small>{module.description}</small>
                          {search.trim() && module.options.some((option) => option.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr'))) && <span className="module-match-hint">Option : {module.options.filter((option) => option.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr'))).join(' · ')}</span>}
                          <span className="module-state">Ouvrir le module</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )) : <p className="empty-state">Aucun module ne correspond à « {search} ».</p>}
              </section>
            </>
          ) : selectedModule ? (
            <section className="module-detail">
              <button className="back-link" onClick={() => setActiveModule('overview')}>← Retour à la vue générale</button>
              <div className="detail-header"><span className="module-number large-number module-icon-badge" aria-hidden="true"><ModuleIcon moduleId={selectedModule.id} /></span><div><p className="eyebrow">MODULE DE GESTION</p><h1>{selectedModule.title}</h1><p>{selectedModule.description}</p></div></div>
              <div className="notice-card"><span className="notice-icon">i</span><p><strong>Module à configurer</strong><br />Cette interface présente les options prévues. Les formulaires, permissions et données seront activés après connexion à la base et validation des règles de l’établissement.</p></div>
              <div className="section-heading detail-options-heading"><div><p className="eyebrow">FONCTIONNALITÉS PRÉVUES</p><h2>Options du module</h2></div><span className="module-count">{selectedModule.options.length} options</span></div>
              <div className="option-list">
                {selectedModule.options.map((option, index) => (
                  <article className="option-row" key={option}><span className="option-index">{String(index + 1).padStart(2, '0')}</span><strong>{option}</strong><span className="module-state">À développer</span></article>
                ))}
              </div>
            </section>
          ) : null}

          <footer className="app-footer"><span>{tenant.school.name} · Espace sécurisé</span><span>{isNouvelEspoirDemo ? 'École modèle · Données de démonstration' : 'Gestion de votre établissement'}</span></footer>
        </div>
      </main>
      <nav className="mobile-bottom-nav" aria-label="Navigation principale mobile">
        <button type="button" className={`mobile-bottom-nav-item ${activeModule === 'overview' ? 'is-active' : ''}`} aria-current={activeModule === 'overview' ? 'page' : undefined} onClick={() => selectModule('overview')}>
          <span className="mobile-bottom-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m3.5 10 8.5-7 8.5 7v10a1 1 0 0 1-1 1h-5.3v-6.2H9.8V21H4.5a1 1 0 0 1-1-1V10Z" /></svg></span>
          <span>Accueil</span>
        </button>
        {mobileNavigationItems.map((item) => (
          <button key={item.id} type="button" className={`mobile-bottom-nav-item ${activeModule === item.id ? 'is-active' : ''}`} aria-label={item.label} aria-current={activeModule === item.id ? 'page' : undefined} onClick={() => selectModule(item.id)}>
            <span className="mobile-bottom-nav-icon" aria-hidden="true">{item.id === 'administration' ? <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.3a1.8 1.8 0 0 1-3.6 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.8 1.8 0 0 1-2.5-2.5l.1-.1a1.7 1.7 0 0 0-1.2-2.9h-.3a1.8 1.8 0 0 1 0-3.6h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.8 1.8 0 0 1 2.5-2.5l.1.1a1.7 1.7 0 0 0 2.9-1.2v-.3a1.8 1.8 0 0 1 3.6 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.8 1.8 0 0 1 2.5 2.5l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.3a1.8 1.8 0 0 1 0 3.6h-.2a1.7 1.7 0 0 0-1.2 2.9Z" /></svg> : <ModuleIcon moduleId={item.id} />}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
    </AccessProvider>
  );
}

const isPlatformRoute = window.location.pathname === '/platform' || window.location.pathname.startsWith('/platform/');
const isParentRoute = window.location.pathname === '/parents' || window.location.pathname.startsWith('/parents/');
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isPlatformRoute ? <PlatformPage /> : isParentRoute ? <ParentPortalAccessPage /> : <App />}</React.StrictMode>,
);
