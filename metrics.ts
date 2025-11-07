import type { IssueData, OverallMetrics, WeeklySummary } from './types.ts';
import { calculateStats } from './utils.ts';

/**
 * Calculate overall metrics from issue data
 */
export function calculateOverallMetrics(data: IssueData[]): OverallMetrics {
  const issues = data.filter(d => d.type === 'issue');
  const prs = data.filter(d => d.type === 'pr');

  const issuesResponded = issues.filter(d => d.firstResponseAt !== null).length;
  const prsResponded = prs.filter(d => d.firstResponseAt !== null).length;

  const issuesWithinOneDay = issues.filter(d => d.respondedWithinOneDay).length;
  const prsWithinOneDay = prs.filter(d => d.respondedWithinOneDay).length;

  const issueResponseRate = issues.length > 0 ? (issuesResponded / issues.length) * 100 : 0;
  const prResponseRate = prs.length > 0 ? (prsResponded / prs.length) * 100 : 0;

  const issueOneDayPercentage = issues.length > 0 ? (issuesWithinOneDay / issues.length) * 100 : 0;
  const prOneDayPercentage = prs.length > 0 ? (prsWithinOneDay / prs.length) * 100 : 0;

  // Calculate response time statistics for items that have responses
  const responseTimes = data
    .filter(d => d.responseTimeHours !== null)
    .map(d => d.responseTimeHours as number);

  const stats = calculateStats(responseTimes);

  return {
    totalIssues: issues.length,
    totalPRs: prs.length,
    issuesResponded,
    prsResponded,
    issuesWithinOneDay,
    prsWithinOneDay,
    issueResponseRate,
    prResponseRate,
    issueOneDayPercentage,
    prOneDayPercentage,
    minResponseTimeHours: stats.min,
    maxResponseTimeHours: stats.max,
    meanResponseTimeHours: stats.mean,
    medianResponseTimeHours: stats.median,
  };
}

/**
 * Calculate weekly summary of issues/PRs responded within one business day
 */
export function calculateWeeklySummary(data: IssueData[]): WeeklySummary[] {
  // Group by week
  const weeklyMap = new Map<string, { total: number; withinOneDay: number }>();

  for (const item of data) {
    const weekKey = item.weekStarting.toISOString();
    
    if (!weeklyMap.has(weekKey)) {
      weeklyMap.set(weekKey, { total: 0, withinOneDay: 0 });
    }

    const weekData = weeklyMap.get(weekKey)!;
    weekData.total++;
    if (item.respondedWithinOneDay) {
      weekData.withinOneDay++;
    }
  }

  // Convert to array and sort by week
  const summaries: WeeklySummary[] = Array.from(weeklyMap.entries())
    .map(([weekKey, data]) => ({
      weekStarting: new Date(weekKey),
      totalIssues: data.total,
      respondedWithinOneDay: data.withinOneDay,
      percentage: data.total > 0 ? (data.withinOneDay / data.total) * 100 : 0,
    }))
    .sort((a, b) => a.weekStarting.getTime() - b.weekStarting.getTime());

  return summaries;
}

