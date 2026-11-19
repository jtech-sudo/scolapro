export { API_BASE_URL, apiRequest, clearAuthToken, clearParentAuthToken, clearPlatformToken, getAuthToken, getParentAuthToken, getPlatformToken, setAuthToken, setParentAuthToken, setPlatformToken } from './api/client';

export type AuthSession = {
  accessToken: string;
  user: { id: string; fullName: string; email: string | null; role: UserRole };
  school: { id: string; name: string; slug: string };
};

export type CurrentTenant = {
  user: AuthSession['user'];
  school: AuthSession['school'];
  platformAccess?: boolean;
};

export type TenantChoice = AuthSession['school'] & { role: UserRole };

export type ParentPortalSession = {
  user: { id: string; fullName: string; email: string | null };
  school: { id: string; name: string; slug: string };
  guardian: { id: string; firstName: string; lastName: string; childCount: number };
  portalEnabled: boolean;
};

export type ParentPortalLoginSession = ParentPortalSession & { accessToken: string };

export type SchoolClass = {
  id: string;
  name: string;
  levelId: string;
  schoolYearId: string;
  level: { id: string; name: string; type: 'PRIMARY' | 'MIDDLE' | 'HIGH' };
  schoolYear: { id: string; name: string; isCurrent: boolean };
  _count?: { enrollments: number };
  isActive: boolean;
};

export type TimetableEntry = {
  id: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  room: string | null;
  assignment: TeachingAssignment;
};

export type TransportStudent = {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
};

export type TransportStop = {
  id: string;
  name: string;
  order: number;
  arrivalTime: string | null;
};

export type TransportRoute = {
  id: string;
  name: string;
  direction: 'TO_SCHOOL' | 'FROM_SCHOOL';
  vehicle: string | null;
  vehiclePlate: string | null;
  driverName: string | null;
  capacity: number;
  isActive: boolean;
  stops: TransportStop[];
  students: Array<{
    id: string;
    student: TransportStudent;
    stop: TransportStop | null;
  }>;
};

export type TransportEligibleStudent = TransportStudent & {
  enrollment: {
    name: string;
    level: { name: string };
    schoolYear: { name: string; isCurrent: boolean };
  } | null;
};

export type StaffLeave = {
  id: string;
  startsOn: string;
  endsOn: string;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedAt: string | null;
  createdAt: string;
};

export type StaffMember = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  position: string;
  phone: string | null;
  email: string | null;
  contractType: string | null;
  hiredAt: string | null;
  isActive: boolean;
  leaves: StaffLeave[];
};

export type OnlineEnrollmentClass = {
  id: string;
  name: string;
  level: { name: string };
};

export type OnlineEnrollmentPublicForm = {
  school: {
    slug: string;
    name: string;
    shortName: string;
    city: string | null;
    phone: string | null;
    email: string | null;
    logoDataUrl: string | null;
  };
  schoolYears: Array<{ id: string; name: string; classes: OnlineEnrollmentClass[] }>;
};

export type OnlineEnrollmentRequest = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  sex: string | null;
  requestedClassId: string;
  guardianFirstName: string;
  guardianLastName: string;
  guardianPhone: string;
  guardianEmail: string | null;
  guardianAddress: string | null;
  relationship: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'ENROLLED';
  reviewNote: string | null;
  reviewedAt: string | null;
  convertedStudent: { id: string; matricule: string } | null;
  requestedClass: OnlineEnrollmentClass & { schoolYear: { id: string; name: string } };
  createdAt: string;
};

export type Student = {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  sex: string | null;
  isActive: boolean;
  createdAt: string;
  enrollments: Array<{
    schoolClass: {
      id: string;
      name: string;
      level: { name: string };
      schoolYear: { id: string; name: string; isCurrent: boolean };
    };
  }>;
  guardians?: Array<{ relationship: string; isPrimary: boolean; guardian: Guardian }>;
};

export type StudentDetails = Omit<Student, 'enrollments'> & {
  updatedAt: string;
  enrollments: Array<{
    id: string;
    status: string;
    enrolledAt: string;
    schoolClass: {
      id: string;
      name: string;
      level: { name: string };
      schoolYear: { id: string; name: string };
    };
    schoolYear: { name: string };
  }>;
  grades: Array<{
    id: string;
    score: number | string;
    comment: string | null;
    assessment: {
      name: string;
      assessmentType: string;
      maximumScore: number | string;
      assessmentDate: string;
      subject: { name: string };
      class: { name: string };
      term: { name: string; schoolYear: { name: string } };
    };
  }>;
  reportCards: Array<{
    id: string;
    status: string;
    overallAverage: number | string | null;
    rank: number | null;
    classSize: number | null;
    generalComment: string | null;
    validatedAt: string | null;
    schoolClass: { name: string };
    schoolYear: { name: string };
    term: { name: string };
  }>;
  attendance: Array<{
    id: string;
    status: string;
    arrivalTime: string | null;
    reason: string | null;
    isJustified: boolean;
    session: { date: string; slot: string; class: { name: string } };
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    amountDue: number | string;
    dueDate: string | null;
    createdAt: string;
    feeType: { name: string };
    schoolYear: { name: string };
    installments: Array<{ label: string; amount: number | string; dueDate: string }>;
    allocations: Array<{
      amount: number | string;
      payment: { receiptNumber: string; amount: number | string; method: string; status: string; receivedAt: string };
    }>;
  }>;
  libraryLoans: Array<{
    id: string;
    issuedAt: string;
    dueAt: string;
    returnedAt: string | null;
    note: string | null;
    book: { title: string; author: string | null };
  }>;
};

export type SchoolYear = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
  _count?: { classes: number; terms: number };
  terms?: Term[];
};

export type LibraryBook = {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  category: string | null;
  totalCopies: number;
  availableCopies: number;
  isActive: boolean;
};

export type LibraryLoan = {
  id: string;
  issuedAt: string;
  dueAt: string;
  returnedAt: string | null;
  note: string | null;
  book: Pick<LibraryBook, 'id' | 'title' | 'author' | 'isbn'>;
  student: Pick<Student, 'id' | 'firstName' | 'lastName' | 'matricule'>;
};

export type Term = {
  id: string;
  name: string;
  order: number;
  startsOn: string;
  endsOn: string;
  schoolYearId: string;
};

export type Level = {
  id: string;
  name: string;
  type: 'PRIMARY' | 'MIDDLE' | 'HIGH';
  sortOrder: number;
  isActive: boolean;
  _count?: { classes: number };
};

export type Guardian = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  occupation: string | null;
  isActive: boolean;
  students?: Array<{ studentId: string; relationship: string; isPrimary: boolean; student: Student }>;
};

export type Teacher = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  specialty: string | null;
  isActive: boolean;
  _count?: { assignments: number };
};

export type Subject = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  _count?: { assignments: number };
};

export type TeachingAssignment = {
  id: string;
  class: SchoolClass;
  subject: Subject;
  teacher: Teacher;
};

export const USER_ROLES = ['ADMIN', 'DIRECTOR', 'SECRETARIAT', 'PEDAGOGICAL_MANAGER', 'TEACHER', 'ACCOUNTANT', 'CASHIER', 'PARENT'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export type SubscriptionPlanKey = 'STARTER' | 'PRO' | 'PREMIUM' | 'ENTERPRISE' | 'CUSTOM';
export type PlatformPlanSetting = { plan: SubscriptionPlanKey; monthlyFee: number };
export type SchoolSubscription = {
  subscriptionPlan: SubscriptionPlanKey;
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED';
  monthlyFee: number;
  request: null | {
    id: string;
    plan: SubscriptionPlanKey;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    requestedAt: string;
  };
};

export const ADMIN_MODULES = [
  'administration', 'school-year', 'people', 'grades', 'timetable', 'teaching-documents', 'report-cards',
  'attendance', 'library', 'billing', 'finance', 'statistics', 'parent-portal', 'security',
  'communication', 'transport', 'personnel', 'documents', 'online-enrollment',
] as const;
export type AdminModuleKey = (typeof ADMIN_MODULES)[number];

export type SchoolProfile = {
  id: string;
  name: string;
  shortName: string;
  address: string | null;
  city: string;
  country: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  registrationId: string | null;
  logoDataUrl: string | null;
  currency: string;
  language: string;
  updatedAt: string;
};

export type RolePermission = {
  id: string | null;
  role: UserRole;
  module: AdminModuleKey;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  isDefault?: boolean;
};

export type ModulePermission = {
  module: AdminModuleKey;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export type CurrentRolePermissions = { role: UserRole; permissions: ModulePermission[] };

export type AdminUser = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FeeType = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  _count?: { invoices: number };
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  amountDue: string;
  amountPaid: string;
  balance: string;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  dueDate: string | null;
  createdAt: string;
  student: Student;
  feeType: FeeType;
  schoolYear: SchoolYear;
  installments: InvoiceInstallment[];
};

export type InvoiceInstallment = {
  id: string;
  label: string;
  amount: string;
  dueDate: string;
};

export type Payment = {
  id: string;
  receiptNumber: string;
  amount: string;
  method: string;
  providerReference?: string | null;
  status: 'RECORDED' | 'CANCELLED' | 'REFUNDED';
  receivedAt: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  allocations: Array<{
    id: string;
    amount: string;
    invoice: { invoiceNumber: string; student: Student; feeType: FeeType; schoolYear: SchoolYear };
  }>;
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  BANK_TRANSFER: 'Virement bancaire',
  CHEQUE: 'Chèque',
  AIRTEL_MONEY: 'Airtel Money',
  MOOV_MONEY: 'Moov Money',
  ZAMANI_CASH: 'Zamani Cash',
  WESTERN_UNION: 'Western Union',
  MONEYGRAM: 'MoneyGram',
  OTHER: 'Autre',
};

export type BillingSummary = {
  invoiceCount: number;
  totalInvoiced: string;
  totalPaid: string;
  totalBalance: string;
  unpaidInvoiceCount: number;
  currency: string;
};

export type Receipt = {
  receiptNumber: string;
  receivedAt: string;
  amount: string;
  method: string;
  providerReference?: string | null;
  status: Payment['status'];
  cancellationReason: string | null;
  allocations: Array<{
    amount: string;
    invoiceNumber: string;
    studentName: string;
    matricule: string;
    feeName: string;
    schoolYear: string;
  }>;
};

export type ExpenseCategory = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  _count?: { expenses: number };
};

export type Expense = {
  id: string;
  reference: string;
  description: string;
  amount: string;
  spentAt: string;
  paymentMethod: string;
  payee: string | null;
  status: 'RECORDED' | 'CANCELLED';
  cancelledAt: string | null;
  cancellationReason: string | null;
  category: ExpenseCategory;
  schoolYear: SchoolYear;
};

export type FinanceReport = {
  schoolYear: { id: string; name: string } | null;
  period: { from: string | null; to: string | null };
  revenue: string;
  expenses: string;
  balance: string;
  expenseCount: number;
  revenueByFee: Array<{ name: string; amount: string }>;
  expensesByCategory: Array<{ name: string; amount: string }>;
  monthly: Array<{ month: string; revenue: string; expenses: string; balance: string }>;
};

export type GeneralAccountingSnapshot = {
  schoolYear: { id: string; name: string } | null;
  period: { from: string | null; to: string | null };
  summary: {
    revenue: string;
    expenses: string;
    balance: string;
  };
  balanceSheet: {
    totalAssets: string;
    totalLiabilities: string;
    totalEquity: string;
  };
  incomeStatement: {
    revenue: string;
    charges: string;
    result: string;
  };
  accounts: Array<{
    code: string;
    label: string;
    type: 'Actif' | 'Passif' | 'Produit' | 'Charge';
    balance: string;
    detail: string;
  }>;
  entries: Array<{
    id: string;
    date: string;
    reference: string;
    accountCode: string;
    accountLabel: string;
    direction: 'Débit' | 'Crédit';
    amount: string;
    label: string;
  }>;
};

export type ParentPortalSettings = {
  id: string;
  schoolId: string | null;
  enabled: boolean;
  showGrades: boolean;
  showReportCards: boolean;
  showBilling: boolean;
  showAttendance: boolean;
  allowGuardianMessages: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  updatedAt: string;
};

export type PortalNotice = {
  id: string;
  title: string;
  body: string;
  status: 'DRAFT' | 'READY' | 'ARCHIVED';
  guardianId: string | null;
  approvedAt: string | null;
  createdAt: string;
  guardian: Pick<Guardian, 'id' | 'firstName' | 'lastName' | 'email' | 'phone'> | null;
};

export type CommunicationRecipient = {
  id: string;
  firstName: string;
  lastName: string;
  studentCount: number;
  students: Array<Pick<Student, 'id' | 'firstName' | 'lastName'>>;
};

export type ParentPortalAccountData = {
  guardians: Array<Guardian & {
    students: Array<{ relationship: string; student: Student }>;
    portalAccount: { user: Pick<AdminUser, 'id' | 'fullName' | 'email' | 'role' | 'isActive'> } | null;
  }>;
  parentUsers: Array<Pick<AdminUser, 'id' | 'fullName' | 'email' | 'phone' | 'isActive'>>;
};

export type AcademicTeachingAssignment = {
  id: string;
  class: SchoolClass & { schoolYear: SchoolYear & { terms: Term[] } };
  subject: Subject;
  teacher: Teacher;
};

export type AcademicGrade = {
  id: string;
  score: string;
  comment: string | null;
  student: Student;
};

export type Assessment = {
  id: string;
  name: string;
  assessmentType: string;
  classId: string;
  subjectId: string;
  termId: string;
  assessmentDate: string;
  maximumScore: string;
  coefficient: string;
  status: 'OPEN' | 'LOCKED';
  onlineEnabled: boolean;
  onlineStartsAt: string | null;
  onlineEndsAt: string | null;
  class: SchoolClass;
  subject: Subject;
  term: Term;
  grades: AcademicGrade[];
};

export type ExamQuestion = {
  id: string;
  assessmentId: string;
  order: number;
  type: 'MULTIPLE_CHOICE' | 'WRITTEN';
  prompt: string;
  points: string;
  choices: Array<{ id: string; order: number; text: string; isCorrect: boolean }>;
};

export type ClassRoster = {
  schoolClass: SchoolClass;
  students: Student[];
};

export type TermGradeSummary = {
  classId: string;
  subjectId: string;
  termId: string;
  assessmentCount: number;
  students: Array<{ student: Student; assessmentCount: number; averagePercent: string | null }>;
};

export type ReportCardRule = {
  id: string;
  name: string;
  scope: 'LEVEL' | 'CLASS';
  levelId: string;
  classId: string | null;
  schoolYearId: string;
  termId: string;
  maximumScore: string;
  calculationConfig: { formula: 'WEIGHTED_SUBJECT_PERCENT' | 'WEIGHTED_RAW_SCORE'; rankByAverage: boolean };
  mentionConfig: { thresholds: Array<{ minimum: number; label: string }> };
  effective: boolean;
  level: Level;
  schoolClass: SchoolClass | null;
  schoolYear: SchoolYear;
  term: Term;
};

export type ReportCardPreview = {
  rule: ReportCardRule;
  class: SchoolClass;
  term: Term;
  students: Array<{
    student: Student;
    subjects: Array<{ subjectId?: string; name: string; code: string; assessmentCount: number; average: string | null; coefficientTotal: string; grades: Array<{ assessmentId: string; name: string; type: string; score: string; maximumScore: string; coefficient: string; comment: string | null }> }>;
    overallAverage: string | null;
    mention: string | null;
    rank: number | null;
    classSize: number;
    ruleId: string;
    formula: string;
    maximumScore: string;
  }>;
};

export type ReportCardRecord = {
  id: string;
  studentId: string;
  classId: string;
  schoolYearId: string;
  termId: string;
  status: 'DRAFT' | 'VALIDATED';
  calculation: ReportCardPreview['students'][number];
  overallAverage: string | null;
  rank: number | null;
  classSize: number | null;
  generalComment: string | null;
  validatedAt: string | null;
  student: Student;
  schoolClass: SchoolClass & { level: Level };
  schoolYear: SchoolYear;
  term: Term;
};

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
export type AttendanceSlot = 'MORNING' | 'AFTERNOON';

export type AttendanceRecord = {
  id: string;
  studentId: string;
  status: AttendanceStatus;
  arrivalTime: string | null;
  reason: string | null;
  isJustified: boolean;
  student: Student;
};

export type AttendanceSession = {
  id: string;
  classId: string;
  date: string;
  slot: AttendanceSlot;
  note: string | null;
  class: SchoolClass;
  records: AttendanceRecord[];
};

export type AttendanceReport = {
  schoolClass: SchoolClass;
  period: { from: string; to: string; slot: AttendanceSlot | null };
  sessionCount: number;
  totals: { present: number; absent: number; late: number; excused: number };
  students: Array<{ student: Student; present: number; absent: number; late: number; excused: number; sessions: number; attendanceRate: string }>;
};
