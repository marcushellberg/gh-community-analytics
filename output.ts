import type { IssueData, OverallMetrics, WeeklySummary } from './types.ts';
import { formatDate } from './utils.ts';

/**
 * Generate CSV content from issue data
 */
export function generateCSV(data: IssueData[]): string {
  const headers = [
    'Repository',
    'Type',
    'Number',
    'Title',
    'Created At',
    'First Response At',
    'Response Time (hours)',
    'Responded By',
    'Responded Within 1 Day',
    'Week Starting',
    'URL',
  ];

  const rows = data.map(item => [
    item.repository,
    item.type.toUpperCase(),
    item.number.toString(),
    `"${item.title.replace(/"/g, '""')}"`, // Escape quotes in title
    item.createdAt.toISOString(),
    item.firstResponseAt ? item.firstResponseAt.toISOString() : 'N/A',
    item.responseTimeHours !== null ? item.responseTimeHours.toFixed(2) : 'N/A',
    item.respondedBy || 'N/A',
    item.respondedWithinOneDay ? 'Yes' : 'No',
    formatDate(item.weekStarting),
    item.url,
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

/**
 * Save CSV to file
 */
export async function saveCSV(data: IssueData[], filename?: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const filepath = filename || `response-times-${timestamp}.csv`;
  
  const csvContent = generateCSV(data);
  await Bun.write(filepath, csvContent);
  
  return filepath;
}

/**
 * Display metrics in console with formatted tables
 */
export function displayConsoleOutput(
  metrics: OverallMetrics,
  weeklySummary: WeeklySummary[],
  startDate: Date,
  endDate: Date
): void {
  console.log('\n' + '='.repeat(80));
  console.log('GitHub Issue Response Time Analysis');
  console.log('='.repeat(80));
  console.log(`Date Range: ${formatDate(startDate)} to ${formatDate(endDate)}`);
  console.log('='.repeat(80));

  // Overall Metrics
  console.log('\n📊 OVERALL METRICS\n');
  
  console.log('Issues:');
  console.log(`  Total: ${metrics.totalIssues}`);
  console.log(`  Responded: ${metrics.issuesResponded} (${metrics.issueResponseRate.toFixed(1)}%)`);
  console.log(`  Within 1 Day: ${metrics.issuesWithinOneDay} (${metrics.issueOneDayPercentage.toFixed(1)}%)`);
  
  console.log('\nPull Requests:');
  console.log(`  Total: ${metrics.totalPRs}`);
  console.log(`  Responded: ${metrics.prsResponded} (${metrics.prResponseRate.toFixed(1)}%)`);
  console.log(`  Within 1 Day: ${metrics.prsWithinOneDay} (${metrics.prOneDayPercentage.toFixed(1)}%)`);

  // Response Time Statistics
  if (metrics.meanResponseTimeHours !== null) {
    console.log('\n⏱️  RESPONSE TIME STATISTICS (in hours)\n');
    console.log(`  Minimum: ${metrics.minResponseTimeHours?.toFixed(2)} hours`);
    console.log(`  Maximum: ${metrics.maxResponseTimeHours?.toFixed(2)} hours`);
    console.log(`  Mean: ${metrics.meanResponseTimeHours?.toFixed(2)} hours`);
    console.log(`  Median: ${metrics.medianResponseTimeHours?.toFixed(2)} hours`);
  }

  // Weekly Summary
  if (weeklySummary.length > 0) {
    console.log('\n📅 WEEKLY SUMMARY - Issues/PRs Responded Within 1 Business Day\n');
    console.log('Week Starting       | Total | Within 1 Day | Percentage');
    console.log('-'.repeat(60));
    
    for (const week of weeklySummary) {
      const weekStr = formatDate(week.weekStarting).padEnd(18);
      const totalStr = week.totalIssues.toString().padStart(5);
      const respondedStr = week.respondedWithinOneDay.toString().padStart(12);
      const percentageStr = `${week.percentage.toFixed(1)}%`.padStart(10);
      
      console.log(`${weekStr} | ${totalStr} | ${respondedStr} | ${percentageStr}`);
    }
  }

  console.log('\n' + '='.repeat(80));
}

/**
 * Display summary footer
 */
export function displaySummary(csvPath: string): void {
  console.log(`\n✅ Analysis complete!`);
  console.log(`📄 CSV report saved to: ${csvPath}\n`);
}

