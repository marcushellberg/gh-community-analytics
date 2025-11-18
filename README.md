# GitHub Response Time Tracker

A Bun-powered script to analyze and track response times from your organization's team members to community-created GitHub issues and pull requests.

## Features

- 📊 Track response times for issues and pull requests
- ⏱️  Calculate working hours (excluding weekends)
- 📈 Identify issues/PRs responded within one business day
- 📅 Weekly breakdown of response metrics
- 👥 Exclude specific teams or bot accounts from analysis
- 📄 Export detailed data to CSV
- 📤 Automated Slack reporting via GitHub Actions

## Requirements

- [Bun](https://bun.sh/) installed on your system
- GitHub Personal Access Token with `repo` and `read:org` permissions

## Installation

1. Clone or download this repository
2. Install dependencies:

```bash
bun install
```

3. Create your configuration file `config.json` with your settings:

```json
{
  "organization": "your-organization-name",
  "repositories": ["repo1", "repo2", "repo3"],
  "excludeTeams": ["team1", "team2"],
  "excludeBots": ["bot-user-1", "bot-user-2"]
}
```

The GitHub token should be provided via the `GH_TOKEN` environment variable.

Note: `excludeTeams` and `excludeBots` are optional. Use empty arrays `[]` if you don't need to exclude anyone.

## Getting a GitHub Token

1. Go to [GitHub Settings > Developer Settings > Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token" (classic)
3. Give it a descriptive name
4. Select the following scopes:
   - `repo` (Full control of private repositories)
   - `read:org` (Read org and team membership)
5. Generate and use it as the `GH_TOKEN` environment variable

## Usage

### Basic Usage

Run with default settings (4 full weeks):

```bash
GH_TOKEN="your_github_token_here" bun run index.ts
```

### Custom Date Range

Specify start and end dates:

```bash
GH_TOKEN="your_github_token_here" bun run index.ts --start-date 2024-01-01 --end-date 2024-03-31
```

### Custom Config File

Use a different configuration file:

```bash
GH_TOKEN="your_github_token_here" bun run index.ts --config /path/to/custom-config.json
```

### Combined Options

```bash
GH_TOKEN="your_github_token_here" bun run index.ts --start-date 2024-01-01 --end-date 2024-12-31 --config ./prod-config.json
```

### Help

View all available options:

```bash
bun run index.ts --help
```

## Output

The script generates two types of output:

### 1. Console Output

Displays comprehensive metrics including:
- Total issues and PRs analyzed
- Response rates and percentages
- Issues/PRs responded within 1 business day
- Response time statistics (min, max, mean, median)
- Weekly breakdown of response metrics

### 2. CSV Export

Creates a CSV file named `response-times.csv` with detailed information:
- Repository name
- Issue/PR type and number
- Title
- Creation timestamp
- First response timestamp
- Response time in hours
- Who responded
- Who reported/created the issue/PR
- Whether responded within 1 business day
- Week starting date
- URL to the issue/PR

## How It Works

1. **Organization Member Caching**: The script fetches all organization members once at startup and caches them for efficient lookup.

2. **Team & Bot Exclusion**: Optionally excludes members from specified teams or bot accounts from being counted as responders.

3. **Issue/PR Filtering**: Only analyzes issues and PRs created by non-organization members (community contributions).

4. **Response Detection**: Checks all comments, review comments, and reviews to find the first response from an organization member (excluding any users in the exclude list).

5. **Working Hours Calculation**: Excludes weekends when calculating response times, providing accurate business-day metrics.

6. **Weekly Aggregation**: Groups results by week (Monday-Sunday) for trend analysis.

## Configuration

### Config File Structure

```json
{
  "organization": "your-org",
  "repositories": [
    "repo1",
    "repo2"
  ],
  "excludeTeams": [
    "team-to-exclude"
  ],
  "excludeBots": [
    "bot-username"
  ]
}
```

**Configuration Fields:**
- `organization` (required): The GitHub organization name
- `repositories` (required): Array of repository names to analyze
- `excludeTeams` (optional): Array of team slugs whose members should be excluded from response counting
- `excludeBots` (optional): Array of bot usernames to exclude from response counting

**Note:** The GitHub token is provided via the `GH_TOKEN` environment variable, not in the config file.

### CLI Arguments

| Argument | Description | Default |
|----------|-------------|---------|
| `--start-date` | Start date (YYYY-MM-DD) | 4 full weeks + current week |
| `--end-date` | End date (YYYY-MM-DD) | Today |
| `--config` | Path to config file | `./config.json` |
| `--help` or `-h` | Show help message | - |

## Example Output

```
================================================================================
GitHub Issue Response Time Analysis
================================================================================
Date Range: 2024-01-01 to 2024-03-31
================================================================================

📊 OVERALL METRICS

Issues:
  Total: 45
  Responded: 42 (93.3%)
  Within 1 Day: 35 (77.8%)

Pull Requests:
  Total: 28
  Responded: 27 (96.4%)
  Within 1 Day: 22 (78.6%)

⏱️  RESPONSE TIME STATISTICS (in hours)

  Minimum: 0.50 hours
  Maximum: 168.25 hours
  Mean: 18.75 hours
  Median: 12.50 hours

📅 WEEKLY SUMMARY - Issues/PRs Responded Within 1 Business Day

Week Starting       | Total | Within 1 Day | Percentage
------------------------------------------------------------
2024-01-01          |    12 |           10 |      83.3%
2024-01-08          |    15 |           12 |      80.0%
2024-01-15          |     8 |            6 |      75.0%
...

================================================================================

✅ Analysis complete!
📄 CSV report saved to: response-times.csv
```

## Slack Integration

### Setting Up Slack Webhook

To enable Slack notifications, you'll need to create a Slack webhook:

1. Go to [Slack API](https://api.slack.com/apps)
2. Click "Create New App" and choose "From scratch"
3. Give it a name and select your workspace
4. In the left sidebar, click "Incoming Webhooks"
5. Toggle "Activate Incoming Webhooks" to On
6. Click "Add New Webhook to Workspace"
7. Select the channel where you want reports posted
8. Copy the webhook URL

### Using Slack with CLI

Set the `SLACK_WEBHOOK_URL` and `GH_TOKEN` environment variables to automatically post reports to Slack:

```bash
# Post weekly summary only (default)
GH_TOKEN="your_github_token" \
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL" \
bun run index.ts

# Post full report (includes overall metrics and weekly summary)
GH_TOKEN="your_github_token" \
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL" \
SLACK_POST_FULL_REPORT=true \
bun run index.ts
```

### GitHub Actions Setup

The project includes a GitHub Action that automatically posts reports to Slack.


#### 1. Add GitHub Secrets

Go to your repository Settings → Secrets and variables → Actions, and add:

- `SLACK_WEBHOOK_URL` (required): Your Slack webhook URL
- `GH_TOKEN` (required): GitHub Personal Access Token with `repo` and `read:org` permissions


#### 2. Configure the Workflow

The workflow is located at `.github/workflows/slack-report.yml` and runs:

- **Automatically**: Every Monday at 9 AM UTC
  - Reports data through end of Sunday (23:59:59 the previous day)
  - Covers 4 complete weeks of data
  - No partial Monday data is included
- **Manually**: Through the GitHub Actions UI with custom date ranges

To run manually:
1. Go to your repository on GitHub
2. Click the "Actions" tab
3. Select "Weekly Slack Report" from the workflows list
4. Click "Run workflow"
5. Optionally specify:
   - Start date (YYYY-MM-DD)
   - End date (YYYY-MM-DD)
   - Whether to post the full report

#### 3. Customize Schedule

To change when the report runs, edit the cron schedule in `.github/workflows/slack-report.yml`:

```yaml
schedule:
  # Run every Monday at 9 AM UTC
  - cron: '0 9 * * 1'
```

Common cron patterns:
- `0 9 * * 1` - Every Monday at 9 AM
- `0 9 * * 5` - Every Friday at 9 AM
- `0 9 1 * *` - First day of every month at 9 AM
- `0 9 * * 1-5` - Every weekday at 9 AM

### Slack Output Format

The report posted to Slack matches the console output format:

```
📅 WEEKLY SUMMARY - Issues/PRs Responded Within 1 Business Day

Week Starting       | Total | Within 1 Day | Percentage
------------------------------------------------------------
2025-10-12         |    20 |           13 |      65.0%
2025-10-19         |    23 |           13 |      56.5%
2025-10-26         |    35 |           25 |      71.4%
2025-11-02         |    23 |           15 |      65.2%
2025-11-09         |    17 |           10 |      58.8%
============================================================
```

If `SLACK_POST_FULL_REPORT=true`, it also includes overall metrics and response time statistics.

**Note about timing:** When the action runs on Monday at 9 AM UTC, it reports data through the end of Sunday (the previous day). This means:
- The report covers 4 complete weeks of data
- No partial Monday data is included
- You see clean weekly statistics without incomplete days

### Testing Slack Integration Locally

Before setting up the GitHub Action, test the Slack integration locally:

```bash
# 1. Get your Slack webhook URL (see "Setting Up Slack Webhook" above)

# 2. Test with just the weekly summary
GH_TOKEN="your_github_token" \
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL" \
bun run index.ts --start-date 2024-01-01 --end-date 2024-01-31

# 3. Test with the full report
GH_TOKEN="your_github_token" \
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL" \
SLACK_POST_FULL_REPORT=true \
bun run index.ts --start-date 2024-01-01 --end-date 2024-01-31
```

The script will run normally and display output to the console, then post the report to Slack at the end.

## Troubleshooting

### "Configuration file not found"
Make sure you've created a `config.json` file based on `config.example.json`.

### "Failed to fetch org members"
- Verify your GitHub token has `read:org` permissions
- Ensure the organization name is correct
- Check that the token hasn't expired

### "Failed to fetch issues/PRs"
- Verify your GitHub token has `repo` permissions
- Ensure repository names are correct and exist in the organization
- Check API rate limits: `curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/rate_limit`

### Rate Limiting
GitHub API has rate limits (5000 requests/hour for authenticated requests). For large repositories with many issues/PRs, you might hit these limits. The script will fail with a rate limit error if this happens.

### Slack Integration Issues

**"Failed to post to Slack"**
- Verify your Slack webhook URL is correct
- Ensure the webhook is still active (they can be revoked)
- Check that your Slack app has permission to post to the selected channel
- Try posting a test message manually: `curl -X POST -H 'Content-Type: application/json' -d '{"text":"Test"}' YOUR_WEBHOOK_URL`

**GitHub Action not posting to Slack**
- Verify `SLACK_WEBHOOK_URL` secret is set in your repository
- Check the Actions logs for error messages
- Ensure `config.json` is committed to the repository
- Verify `GH_TOKEN` secret is set and has `repo` and `read:org` permissions
- Verify that jq is installed (it's pre-installed on ubuntu-latest runners)

## Development

### Project Structure

```
.
├── index.ts                           # Main entry point
├── types.ts                           # TypeScript type definitions
├── utils.ts                           # Utility functions (date calc, stats)
├── github.ts                          # GitHub API integration
├── metrics.ts                         # Metrics calculation
├── output.ts                          # Output generation (CSV, console)
├── slack.ts                           # Slack integration
├── package.json                       # Project dependencies
├── .github/
│   └── workflows/
│       ├── slack-report.yml           # GitHub Action for Slack reporting
│       └── README.md                  # GitHub Actions setup guide
└── README.md                          # This file
```

### Running Tests

```bash
# Dry run with example data
GH_TOKEN="your_github_token" bun run index.ts --start-date 2024-01-01 --end-date 2024-01-07
```

## License

MIT

## Contributing

Feel free to open issues or submit pull requests for improvements!

