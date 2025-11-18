export interface Config {
  githubToken?: string;  // Optional - can be provided via GH_TOKEN env var
  organization: string;
  repositories: string[];
  excludeTeams: string[];
  excludeBots?: string[];
}

export interface IssueData {
  repository: string;
  number: number;
  title: string;
  createdAt: Date;
  firstResponseAt: Date | null;
  responseTimeHours: number | null;
  respondedBy: string | null;
  reportedBy: string | null;
  respondedWithinOneDay: boolean;
  weekStarting: Date;
  url: string;
  type: 'issue' | 'pr';
}

export interface WeeklySummary {
  weekStarting: Date;
  totalIssues: number;
  respondedWithinOneDay: number;
  percentage: number;
}

export interface OverallMetrics {
  totalIssues: number;
  totalPRs: number;
  issuesResponded: number;
  prsResponded: number;
  issuesWithinOneDay: number;
  prsWithinOneDay: number;
  issueResponseRate: number;
  prResponseRate: number;
  issueOneDayPercentage: number;
  prOneDayPercentage: number;
  minResponseTimeHours: number | null;
  maxResponseTimeHours: number | null;
  meanResponseTimeHours: number | null;
  medianResponseTimeHours: number | null;
}

