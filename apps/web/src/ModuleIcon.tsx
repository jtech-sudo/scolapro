export function ModuleIcon({ moduleId }: { moduleId: string }) {
  const props = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (moduleId) {
    case 'school-year':
      return <svg {...props}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z" /><path d="M8 5v4M16 5v4M4 10h16" /></svg>;
    case 'people':
      return <svg {...props}><path d="M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" /><circle cx="10" cy="7" r="3" /><path d="M20 19v-1a4 4 0 0 0-3-3.87" /><path d="M16 4.13a3.6 3.6 0 0 1 0 6.96" /></svg>;
    case 'grades':
      return <svg {...props}><path d="M7 3.5h7l5 5V18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" /><path d="M14 3.5V9h5" /><path d="M8 13h8M8 17h6" /></svg>;
    case 'teaching-documents':
      return <svg {...props}><path d="M6 3.5h8l4 4V20H6a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" /><path d="M14 3.5V8h4M8 12h8M8 16h6" /></svg>;
    case 'report-cards':
      return <svg {...props}><path d="M6 3.5h9l4 4V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" /><path d="M15 3.5V8h4" /><path d="M8 12h8M8 16h8" /></svg>;
    case 'attendance':
      return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /><path d="M8 14h3v3H8z" /></svg>;
    case 'timetable':
      return <svg {...props}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18M7 13h3M14 13h3M7 17h3" /></svg>;
    case 'communication':
      return <svg {...props}><path d="M4 5h16v11H9l-5 4V5Z" /><path d="M8 9h8M8 12h5" /></svg>;
    case 'transport':
      return <svg {...props}><path d="M3 7h12v10H3zM15 10h4l2 3v4h-6z" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>;
    case 'personnel':
      return <svg {...props}><circle cx="12" cy="7" r="3" /><path d="M5 20v-1a7 7 0 0 1 14 0v1M4 4l1.5 1.5M20 4l-1.5 1.5" /></svg>;
    case 'documents':
      return <svg {...props}><path d="M6 3.5h8l4 4V20H6a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" /><path d="M14 3.5V8h4M8 12h8M8 16h6" /></svg>;
    case 'online-enrollment':
      return <svg {...props}><path d="M4 5h16v14H4zM8 9h8M8 13h5" /><path d="M16 16h4M18 14v4" /></svg>;
    case 'billing':
      return <svg {...props}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z" /><path d="M4 10h16M8 15h3" /></svg>;
    case 'finance':
      return <svg {...props}><path d="M4 18.5V8.5M10 18.5V5.5M16 18.5v-9M22 18.5V3.5" /><path d="M2 18.5h20" /></svg>;
    case 'statistics':
      return <svg {...props}><path d="M4 18.5h16" /><path d="M7 15V9" /><path d="M12 15V5" /><path d="M17 15v-7" /></svg>;
    case 'library':
      return <svg {...props}><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-11Z" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>;
    case 'parent-portal':
      return <svg {...props}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z" /><path d="M8 10h8M8 14h6" /></svg>;
    case 'security':
      return <svg {...props}><path d="M12 3.5 18 5.8v5.1c0 3.5-2.2 7-6 9.1-3.8-2.1-6-5.6-6-9.1V5.8l6-2.3Z" /><path d="M9.5 12.2 11 13.7l3.5-4.1" /></svg>;
    default:
      return <svg {...props}><path d="M12 3.5v17M3.5 12h17" /></svg>;
  }
}