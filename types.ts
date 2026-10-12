
export interface MiscItem {
  id: string;
  description: string;
  value: number;
}

export interface DailyTransaction {
  id: string;
  type: 'RECEITA' | 'DESPESA';
  date: string;
  status: 'PAGO' | 'PENDENTE' | 'AGENDADO';
  value: number;
  description: string;
  category: string;
  paymentMethod: 'DINHEIRO' | 'PIX';
  institutionName: string;
  userId: string;
  createdAt: string;
  titherName?: string;
}

export interface FinancialReport {
  id: string;
  date: string;
  institutionName: string;
  reporterName: string;
  userId: string;
  locked: boolean;
  
  // Revenues
  offers: number;
  specialOffers: number;
  tithes: number;
  financialRevenue: number; // Consolidated total
  interestRevenue: number;  // New: Juros/Rendimentos
  rentRevenue: number;      // New: Aluguéis Recebidos
  otherRevenues: MiscItem[];
  
  // Expenses
  energy: number;
  water: number; 
  rent: number;
  internet: number;         // New
  cleaning: number;         // New
  maintenance: number;      // New
  missions: number;         // New
  social: number;           // New
  otherExpenses: MiscItem[];
  
  // Calculated Fields
  totalRevenue: number;
  totalFixedExpenses: number;
  sedeExpense: number; 
  prebendaExpense: number; 
  totalExpenses: number;
  saldoGU: number; 
  currentBalance: number;
  previousBalance: number;
  
  // Balance Breakdown
  cashBalance: number;
  pixBalance: number;
  
  attachments: { name: string; type: string; data: string; driveId?: string; viewLink?: string }[];
  createdAt: string;
  archived?: boolean;
  archiveMonth?: string;
  deletedAt?: string;
  deletedBy?: string;

  // Admin Approval & Email Delivery Fields
  approvalStatus?: 'PENDENTE' | 'APROVADO' | 'REJEITADO';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  emailSentToAdmin?: boolean;
  emailSentAt?: string;
  noDiscount?: boolean;
}

export interface ReceiptRecord {
  id: string;
  number: string;
  type: 'RECEITA' | 'DESPESA' | 'MEMBRO';
  amount: number;
  personName: string;
  docNumber?: string; // CPF or CNPJ
  description: string;
  date: string;
  city: string;
  treasurerName: string;
  treasurerRole?: string;
  pastorName: string;
  pastorRole?: string;
  institutionName: string;
  tithes?: number;
  offerings?: number;
  specialOfferings?: number;
  createdAt: string;
}

export type UserRole = 'ADMIN' | 'USER' | 'DEPT_TREASURER';

export interface UserAccount {
  id: string;
  username: string;
  password: string;
  name: string;
  email?: string;
  phone?: string;
  photo?: string;
  role: UserRole;
  institution: string;
  active: boolean;
  noDiscount?: boolean;
}

export interface UserSession {
  id: string;
  name: string;
  phone?: string;
  photo?: string;
  role: UserRole;
  institution: string;
  noDiscount?: boolean;
}
