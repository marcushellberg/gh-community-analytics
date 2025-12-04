import type { OverallMetrics, WeeklySummary } from './types.ts';
import { formatDate } from './utils.ts';

interface SlackMessageResponse {
  ok: boolean;
  ts?: string;
  channel?: string;
  error?: string;
}

interface SlackFileResponse {
  ok: boolean;
  file?: { id: string };
  error?: string;
}

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
 * Post message to Slack webhook (legacy method)
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
 * Post message to Slack using Web API (returns thread timestamp for threading)
 */
export async function postMessageToSlack(
  botToken: string,
  channel: string,
  message: string,
  threadTs?: string
): Promise<string> {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel,
      text: message,
      mrkdwn: true,
      ...(threadTs && { thread_ts: threadTs }),
    }),
  });

  const data = await response.json() as SlackMessageResponse;
  
  if (!data.ok) {
    throw new Error(`Failed to post to Slack: ${data.error}`);
  }
  
  return data.ts!;
}

/**
 * Upload a file to Slack as a thread reply
 */
export async function uploadFileToSlack(
  botToken: string,
  channel: string,
  filePath: string,
  threadTs: string,
  initialComment?: string
): Promise<void> {
  const file = Bun.file(filePath);
  const fileContent = await file.text();
  const fileName = filePath.split('/').pop() || 'response-times.csv';
  
  const formData = new FormData();
  formData.append('channels', channel);
  formData.append('thread_ts', threadTs);
  formData.append('filename', fileName);
  formData.append('filetype', 'csv');
  formData.append('content', fileContent);
  if (initialComment) {
    formData.append('initial_comment', initialComment);
  }

  const response = await fetch('https://slack.com/api/files.upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${botToken}`,
    },
    body: formData,
  });

  const data = await response.json() as SlackFileResponse;
  
  if (!data.ok) {
    throw new Error(`Failed to upload file to Slack: ${data.error}`);
  }
}

/**
 * Post weekly summary to Slack (webhook version)
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
 * Post full report to Slack (webhook version)
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

/**
 * Post full report to Slack with CSV file attachment using Web API
 * Requires SLACK_BOT_TOKEN and SLACK_CHANNEL_ID environment variables
 */
export async function postFullReportWithFileToSlack(
  botToken: string,
  channel: string,
  metrics: OverallMetrics,
  weeklySummary: WeeklySummary[],
  startDate: Date,
  endDate: Date,
  csvPath: string
): Promise<void> {
  const dateRange = `*GitHub Response Time Analysis*\n_${formatDate(startDate)} to ${formatDate(endDate)}_\n\n`;
  const metricsText = formatOverallMetricsForSlack(metrics);
  const summaryText = formatWeeklySummaryForSlack(weeklySummary, startDate, endDate);
  
  const fullMessage = dateRange + metricsText + '\n\n' + summaryText;
  
  // Post the main message and get the thread timestamp
  const threadTs = await postMessageToSlack(botToken, channel, fullMessage);
  
  // Upload the CSV file as a thread reply
  await uploadFileToSlack(
    botToken,
    channel,
    csvPath,
    threadTs,
    '📎 Detailed response times data'
  );
}

