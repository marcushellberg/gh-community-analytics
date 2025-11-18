import type { OverallMetrics, WeeklySummary } from './types.ts';
import { formatDate } from './utils.ts';

/**
 * Format the weekly summary as a text block for Slack
 */
export function formatWeeklySummaryForSlack(
  weeklySummary: WeeklySummary[],
  startDate: Date,
  endDate: Date
): string {
  let text = '```\n';
  text += '📅 WEEKLY SUMMARY - Issues/PRs Responded Within 1 Business Day\n\n';
  text += 'Week Starting       | Total | Within 1 Day | Percentage\n';
  text += '-'.repeat(60) + '\n';
  
  for (const week of weeklySummary) {
    const weekStr = formatDate(week.weekStarting).padEnd(18);
    const totalStr = week.totalIssues.toString().padStart(5);
    const respondedStr = week.respondedWithinOneDay.toString().padStart(12);
    const percentageStr = `${week.percentage.toFixed(1)}%`.padStart(10);
    
    text += `${weekStr} | ${totalStr} | ${respondedStr} | ${percentageStr}\n`;
  }
  
  text += '='.repeat(60) + '\n';
  text += '```';
  
  return text;
}

/**
 * Format overall metrics for Slack
 */
export function formatOverallMetricsForSlack(metrics: OverallMetrics): string {
  let text = '```\n';
  text += '📊 OVERALL METRICS\n\n';
  
  text += 'Issues:\n';
  text += `  Total: ${metrics.totalIssues}\n`;
  text += `  Responded: ${metrics.issuesResponded} (${metrics.issueResponseRate.toFixed(1)}%)\n`;
  text += `  Within 1 Day: ${metrics.issuesWithinOneDay} (${metrics.issueOneDayPercentage.toFixed(1)}%)\n\n`;
  
  text += 'Pull Requests:\n';
  text += `  Total: ${metrics.totalPRs}\n`;
  text += `  Responded: ${metrics.prsResponded} (${metrics.prResponseRate.toFixed(1)}%)\n`;
  text += `  Within 1 Day: ${metrics.prsWithinOneDay} (${metrics.prOneDayPercentage.toFixed(1)}%)\n`;
  
  if (metrics.meanResponseTimeHours !== null) {
    text += '\n⏱️  RESPONSE TIME STATISTICS (in hours)\n\n';
    text += `  Minimum: ${metrics.minResponseTimeHours?.toFixed(2)} hours\n`;
    text += `  Maximum: ${metrics.maxResponseTimeHours?.toFixed(2)} hours\n`;
    text += `  Mean: ${metrics.meanResponseTimeHours?.toFixed(2)} hours\n`;
    text += `  Median: ${metrics.medianResponseTimeHours?.toFixed(2)} hours\n`;
  }
  
  text += '```';
  
  return text;
}

/**
 * Post message to Slack webhook
 */
export async function postToSlack(webhookUrl: string, message: string): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: message,
      mrkdwn: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to post to Slack: ${response.status} ${response.statusText}`);
  }
}

/**
 * Post weekly summary to Slack
 */
export async function postWeeklySummaryToSlack(
  webhookUrl: string,
  weeklySummary: WeeklySummary[],
  startDate: Date,
  endDate: Date
): Promise<void> {
  const message = formatWeeklySummaryForSlack(weeklySummary, startDate, endDate);
  await postToSlack(webhookUrl, message);
}

/**
 * Post full report to Slack (both metrics and weekly summary)
 */
export async function postFullReportToSlack(
  webhookUrl: string,
  metrics: OverallMetrics,
  weeklySummary: WeeklySummary[],
  startDate: Date,
  endDate: Date
): Promise<void> {
  const dateRange = `*GitHub Response Time Analysis*\n_${formatDate(startDate)} to ${formatDate(endDate)}_\n\n`;
  const metricsText = formatOverallMetricsForSlack(metrics);
  const summaryText = formatWeeklySummaryForSlack(weeklySummary, startDate, endDate);
  
  const fullMessage = dateRange + metricsText + '\n\n' + summaryText;
  await postToSlack(webhookUrl, fullMessage);
}

