export type {
  DiagnosticReport,
  ConsoleEntry,
  NetworkEntry,
  BrowserInfo,
  Breadcrumb,
  ErrorInfo,
  UserContext,
} from '../types';

export interface ReportCreateResponse {
  id: string;
  createdAt: string;
}

export interface ReportListResponse {
  reports: {
    id: string;
    description: string;
    createdAt: string;
  }[];
  total: number;
  page: number;
  perPage: number;
}
