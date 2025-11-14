# GitHub Response Time Tracker

A Bun-powered script to analyze and track response times from your organization's team members to community-created GitHub issues and pull requests.

## Features

- 📊 Track response times for issues and pull requests
- ⏱️  Calculate working hours (excluding weekends)
- 📈 Identify issues/PRs responded within one business day
- 📅 Weekly breakdown of response metrics
- 👥 Exclude specific teams or bot accounts from analysis
- 📄 Export detailed data to CSV

## Requirements

- [Bun](https://bun.sh/) installed on your system
- GitHub Personal Access Token with `repo` and `read:org` permissions

## Installation

1. Clone or download this repository
2. Install dependencies:

```bash
bun install
```

3. Create your configuration file:

```bash
cp config.example.json config.json
```

4. Edit `config.json` with your settings:

```json
{
  "githubToken": "your_github_token_here",
  "organization": "your-organization-name",
  "repositories": ["repo1", "repo2", "repo3"],
  "excludeTeams": ["team1", "team2"],
  "excludeBots": ["bot-user-1", "bot-user-2"]
}
```

Note: `excludeTeams` and `excludeBots` are optional. Use empty arrays `[]` if you don't need to exclude anyone.

## Getting a GitHub Token

1. Go to [GitHub Settings > Developer Settings > Personal Access Tokens](https://github.com/settings/tokens)
2. Click "Generate new token" (classic)
3. Give it a descriptive name
4. Select the following scopes:
   - `repo` (Full control of private repositories)
   - `read:org` (Read org and team membership)
5. Generate and copy the token to your `config.json`

## Usage

### Basic Usage

Run with default settings (4 full weeks + current week):

```bash
bun run index.ts
```

### Custom Date Range

Specify start and end dates:

```bash
bun run index.ts --start-date 2024-01-01 --end-date 2024-03-31
```

### Custom Config File

Use a different configuration file:

```bash
bun run index.ts --config /path/to/custom-config.json
```

### Combined Options

```bash
bun run index.ts --start-date 2024-01-01 --end-date 2024-12-31 --config ./prod-config.json
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
  "githubToken": "ghp_xxxxxxxxxxxx",
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
- `githubToken` (required): Your GitHub personal access token
- `organization` (required): The GitHub organization name
- `repositories` (required): Array of repository names to analyze
- `excludeTeams` (optional): Array of team slugs whose members should be excluded from response counting
- `excludeBots` (optional): Array of bot usernames to exclude from response counting

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

## Development

### Project Structure

```
.
├── index.ts           # Main entry point
├── types.ts           # TypeScript type definitions
├── utils.ts           # Utility functions (date calc, stats)
├── github.ts          # GitHub API integration
├── metrics.ts         # Metrics calculation
├── output.ts          # Output generation (CSV, console)
├── config.example.json # Example configuration
├── package.json       # Project dependencies
└── README.md          # This file
```

### Running Tests

```bash
# Dry run with example data
bun run index.ts --start-date 2024-01-01 --end-date 2024-01-07
```

## License

MIT

## Contributing

Feel free to open issues or submit pull requests for improvements!

