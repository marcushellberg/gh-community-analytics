# GitHub Actions Setup Guide

This directory contains the GitHub Action workflow for automated Slack reporting.

## Quick Setup

### 1. Commit Your Configuration

The GitHub Action uses your regular `config.json` file:

```bash
git add config.json
git commit -m "Add analytics configuration"
git push
```

The workflow will replace the `githubToken` value from secrets at runtime.

### 2. Configure GitHub Secrets

Go to your repository Settings → Secrets and variables → Actions, and add:

#### Required:
- `SLACK_WEBHOOK_URL` - Your Slack webhook URL
- `GH_TOKEN` - GitHub PAT with `repo` and `read:org` scopes

### 3. Test the Workflow

1. Go to your repository on GitHub
2. Click the "Actions" tab
3. Select "Weekly Slack Report"
4. Click "Run workflow"
5. Fill in test dates (e.g., start: 2024-01-01, end: 2024-01-31)
6. Click "Run workflow" button

### 3. Verify in Slack

Check your configured Slack channel for the report message.

## Workflow Schedule

The workflow runs automatically:
- **Every Monday at 9 AM UTC**

To change the schedule, edit the `cron` value in `slack-report.yml`:

```yaml
schedule:
  - cron: '0 9 * * 1'  # Monday 9 AM UTC
```

## Troubleshooting

### Workflow fails with "Configuration file not found"
- Ensure `config.json` is committed to your repository
- Check that the file is in the repository root, not in a subdirectory
- Verify the file is not in `.gitignore`

### No message in Slack
- Verify `SLACK_WEBHOOK_URL` is correct
- Check the workflow logs in the Actions tab
- Test the webhook manually: `curl -X POST -H 'Content-Type: application/json' -d '{"text":"Test"}' YOUR_WEBHOOK_URL`

### GitHub API rate limit errors
- Ensure `GH_TOKEN` secret has proper permissions (`repo` and `read:org`)
- Reduce the date range or number of repositories
- Consider running the workflow less frequently

## Manual Workflow Inputs

When running the workflow manually, you can specify:

- **start_date**: Start date in YYYY-MM-DD format (optional)
- **end_date**: End date in YYYY-MM-DD format (optional)
- **full_report**: Toggle to include overall metrics (default: false, only weekly summary)

If no dates are provided, the workflow uses the default: 4 full weeks + current week.


