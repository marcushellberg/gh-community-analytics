#!/usr/bin/env bun
import { parseArgs } from './utils.ts';
import type { Config } from './types.ts';
import { GitHubAnalytics } from './github.ts';
import { calculateOverallMetrics, calculateWeeklySummary } from './metrics.ts';
import { displayConsoleOutput, saveCSV, displaySummary } from './output.ts';

async function main() {
  try {
    // Parse command line arguments
    const { startDate, endDate, configPath } = parseArgs();

    console.log('🚀 GitHub Response Time Tracker\n');
    
    // Load configuration
    console.log(`Loading configuration from ${configPath}...`);
    const configFile = Bun.file(configPath);
    
    if (!(await configFile.exists())) {
      console.error(`❌ Error: Configuration file not found at ${configPath}`);
      console.error('Please create a config.json file based on config.example.json');
      process.exit(1);
    }

    const config: Config = await configFile.json();

    // Validate configuration
    if (!config.githubToken || !config.organization || !config.repositories || config.repositories.length === 0) {
      console.error('❌ Error: Invalid configuration. Please ensure githubToken, organization, and repositories are set.');
      process.exit(1);
    }

    // Set default values
    const excludeTeams = config.excludeTeams || [];
    const excludeBots = config.excludeBots || [];

    console.log(`✓ Configuration loaded`);
    console.log(`  Organization: ${config.organization}`);
    console.log(`  Repositories: ${config.repositories.join(', ')}`);
    console.log(`  Exclude Teams: ${excludeTeams.length > 0 ? excludeTeams.join(', ') : 'none'}`);
    console.log(`  Exclude Bots: ${excludeBots.length > 0 ? excludeBots.join(', ') : 'none'}`);
    console.log(`  Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    // Initialize GitHub Analytics
    const analytics = new GitHubAnalytics(config);

    // Check rate limit before starting
    await analytics.checkRateLimit();
    console.log('');

    // Fetch organization members (cached for entire run)
    await analytics.fetchOrgMembers();
    console.log('');

    // Build exclude list from teams and bots
    await analytics.buildExcludeList(excludeTeams, excludeBots);

    // Fetch all data
    console.log('Fetching issues and pull requests...\n');
    const data = await analytics.fetchAllData(
      config.repositories,
      startDate,
      endDate
    );

    if (data.length === 0) {
      console.log('⚠️  No issues or pull requests found in the specified date range.');
      process.exit(0);
    }

    console.log(`\n✓ Total items analyzed: ${data.length}`);

    // Calculate metrics
    const metrics = calculateOverallMetrics(data);
    const weeklySummary = calculateWeeklySummary(data);

    // Display console output
    displayConsoleOutput(metrics, weeklySummary, startDate, endDate);

    // Save CSV
    const csvPath = await saveCSV(data);
    displaySummary(csvPath);

    // Check rate limit after completion
    await analytics.checkRateLimit();

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    
    // Check if it's a rate limit error
    if (error.message.includes('rate limit')) {
      console.log('\n⚠️  Hit API rate limit. Wait for the reset time and try again.');
      console.log('   Use a shorter date range or fewer repositories to reduce API calls.');
    }
    
    if (error.stack && !error.message.includes('rate limit')) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Show help message
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
GitHub Response Time Tracker

Usage:
  bun run index.ts [options]

Options:
  --start-date YYYY-MM-DD    Start date for analysis (default: 4 full weeks + current week)
  --end-date YYYY-MM-DD      End date for analysis (default: today)
  --config PATH              Path to config file (default: ./config.json)
  --help, -h                 Show this help message

Examples:
  bun run index.ts
  bun run index.ts --start-date 2024-01-01 --end-date 2024-03-31
  bun run index.ts --config ./my-config.json

Configuration:
  Create a config.json file with:
  {
    "githubToken": "your_github_token",
    "organization": "your-org-name",
    "repositories": ["repo1", "repo2"],
    "excludeTeams": ["team1", "team2"],
    "excludeBots": ["bot-user-1", "bot-user-2"]
  }

  Get a GitHub token from: https://github.com/settings/tokens
  Token needs 'repo' and 'read:org' permissions.
`);
  process.exit(0);
}

main();

