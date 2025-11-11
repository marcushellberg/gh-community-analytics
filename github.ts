import { Octokit } from '@octokit/rest';
import type { Config, IssueData, RepositoryConfig } from './types.ts';
import { calculateWorkingHours, isWithinOneWorkingDay, getWeekStart } from './utils.ts';

export class GitHubAnalytics {
  private octokit: Octokit;
  private organization: string;
  private orgMembers: Set<string>;
  private teamMembersCache: Map<string, Set<string>>;
  private repoTeamMembers: Map<string, Set<string>>;

  constructor(config: Config) {
    this.octokit = new Octokit({ auth: config.githubToken });
    this.organization = config.organization;
    this.orgMembers = new Set();
    this.teamMembersCache = new Map();
    this.repoTeamMembers = new Map();
  }

  /**
   * Check and display API rate limit status
   */
  async checkRateLimit(): Promise<void> {
    try {
      const { data } = await this.octokit.rateLimit.get();
      const core = data.resources.core;
      const search = data.resources.search;
      
      const resetTime = new Date(core.reset * 1000);
      const searchResetTime = new Date(search.reset * 1000);
      const now = new Date();
      const minutesUntilReset = Math.ceil((resetTime.getTime() - now.getTime()) / 60000);
      const searchMinutesUntilReset = Math.ceil((searchResetTime.getTime() - now.getTime()) / 60000);
      
      console.log('\n⚡ GitHub API Rate Limit Status:');
      console.log(`  Core API: ${core.remaining}/${core.limit} requests remaining`);
      if (core.remaining === 0) {
        console.log(`    ❌ DEPLETED! Resets in ${minutesUntilReset} minutes at ${resetTime.toLocaleTimeString()}`);
      } else if (core.remaining < 100) {
        console.log(`    ⚠️  Low! Resets in ${minutesUntilReset} minutes at ${resetTime.toLocaleTimeString()}`);
      } else {
        console.log(`    ✓ Resets at ${resetTime.toLocaleTimeString()}`);
      }
      
      console.log(`  Search API: ${search.remaining}/${search.limit} requests remaining`);
      if (search.remaining === 0) {
        console.log(`    ❌ DEPLETED! Resets in ${searchMinutesUntilReset} minutes at ${searchResetTime.toLocaleTimeString()}`);
      } else if (search.remaining < 5) {
        console.log(`    ⚠️  Low! Resets in ${searchMinutesUntilReset} minutes at ${searchResetTime.toLocaleTimeString()}`);
      } else {
        console.log(`    ✓ Resets at ${searchResetTime.toLocaleTimeString()}`);
      }
    } catch (error: any) {
      console.log(`  ⚠️  Could not fetch rate limit: ${error.message}`);
    }
  }

  /**
   * Log detailed rate limit error information
   */
  private async logRateLimitError(error: any, context: string): Promise<void> {
    console.error(`\n❌ Rate Limit Error in ${context}`);
    
    try {
      const { data } = await this.octokit.rateLimit.get();
      const core = data.resources.core;
      const search = data.resources.search;
      
      // Determine which limit was hit
      if (core.remaining === 0) {
        const resetTime = new Date(core.reset * 1000);
        const minutesUntilReset = Math.ceil((resetTime.getTime() - Date.now()) / 60000);
        console.error(`   Limit Hit: CORE API (${core.limit} requests/hour)`);
        console.error(`   Resets in: ${minutesUntilReset} minutes at ${resetTime.toLocaleTimeString()}`);
      }
      
      if (search.remaining === 0) {
        const resetTime = new Date(search.reset * 1000);
        const minutesUntilReset = Math.ceil((resetTime.getTime() - Date.now()) / 60000);
        console.error(`   Limit Hit: SEARCH API (${search.limit} requests/hour)`);
        console.error(`   Resets in: ${minutesUntilReset} minutes at ${resetTime.toLocaleTimeString()}`);
      }
      
      console.error(`\n   Current Status:`);
      console.error(`   - Core API: ${core.remaining}/${core.limit}`);
      console.error(`   - Search API: ${search.remaining}/${search.limit}`);
    } catch (e) {
      console.error(`   Could not fetch rate limit details: ${error.message}`);
    }
  }

  /**
   * Fetch all organization members once and cache them
   */
  async fetchOrgMembers(): Promise<void> {
    console.log(`Fetching organization members for ${this.organization}...`);
    
    try {
      const members = await this.octokit.paginate(
        this.octokit.orgs.listMembers,
        {
          org: this.organization,
          per_page: 100,
        }
      );

      this.orgMembers = new Set(members.map(member => member.login));
      console.log(`✓ Cached ${this.orgMembers.size} organization members`);
    } catch (error: any) {
      throw new Error(`Failed to fetch org members: ${error.message}`);
    }
  }

  /**
   * Check if a user is an organization member (using cached data)
   */
  isOrgMember(username: string): boolean {
    return this.orgMembers.has(username);
  }

  /**
   * Fetch members of a specific team (cached globally)
   */
  private async fetchTeamMembers(teamSlug: string): Promise<Set<string>> {
    // Return cached if already fetched
    if (this.teamMembersCache.has(teamSlug)) {
      return this.teamMembersCache.get(teamSlug)!;
    }

    try {
      const members = await this.octokit.paginate(
        this.octokit.teams.listMembersInOrg,
        {
          org: this.organization,
          team_slug: teamSlug,
          per_page: 100,
        }
      );

      const memberSet = new Set(members.map(member => member.login));
      this.teamMembersCache.set(teamSlug, memberSet);
      console.log(`  ✓ Fetched ${memberSet.size} members from ${teamSlug}`);
      return memberSet;
    } catch (error: any) {
      console.warn(`  ⚠️  Failed to fetch team members for ${teamSlug}: ${error.message}`);
      const emptySet = new Set<string>();
      this.teamMembersCache.set(teamSlug, emptySet);
      return emptySet;
    }
  }

  /**
   * Build team member cache for all repositories
   */
  async buildRepoTeamCache(repositories: RepositoryConfig[]): Promise<void> {
    console.log('Fetching team members...\n');

    // Collect all unique team slugs
    const allTeams = new Set<string>();
    repositories.forEach(repo => {
      repo.teams.forEach(team => allTeams.add(team));
    });

    console.log(`Found ${allTeams.size} unique team(s) across all repositories`);

    // Fetch each unique team once
    for (const teamSlug of allTeams) {
      await this.fetchTeamMembers(teamSlug);
    }

    console.log('');

    // Build per-repo team member sets
    for (const repo of repositories) {
      const allMembers = new Set<string>();
      
      for (const teamSlug of repo.teams) {
        const teamMembers = this.teamMembersCache.get(teamSlug);
        if (teamMembers) {
          teamMembers.forEach(member => allMembers.add(member));
        }
      }

      this.repoTeamMembers.set(repo.name, allMembers);
      console.log(`✓ ${repo.name}: ${allMembers.size} team member(s) from ${repo.teams.length} team(s)`);
    }
  }

  /**
   * Check if a user is a member of a specific repository's team
   */
  isRepoTeamMember(repo: string, username: string): boolean {
    const teamMembers = this.repoTeamMembers.get(repo);
    return teamMembers ? teamMembers.has(username) : false;
  }

  /**
   * Fetch issues for a repository within a date range
   */
  async fetchIssues(
    repo: string,
    startDate: Date,
    endDate: Date
  ): Promise<IssueData[]> {
    console.log(`Fetching issues for ${this.organization}/${repo}...`);
    
    const issues: IssueData[] = [];

    try {
      // Use Search API for accurate date-range filtering
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      const query = `repo:${this.organization}/${repo} is:issue created:${startDateStr}..${endDateStr}`;

      const searchResults = await this.octokit.paginate(
        this.octokit.search.issuesAndPullRequests,
        {
          q: query,
          per_page: 100,
        }
      );

      for (const issue of searchResults) {
        // Skip pull requests (they have a pull_request property)
        if (issue.pull_request) continue;

        const createdAt = new Date(issue.created_at);
        const author = issue.user?.login || '';

        // Skip issues created by repo team members
        if (this.isRepoTeamMember(repo, author)) continue;

        // Skip issues created by bots
        if (author === 'vaadin-bot' || author === 'dependabot[bot]') continue;

        const firstResponse = await this.findFirstOrgResponse(
          repo,
          issue.number,
          'issue'
        );

        const responseTimeHours = firstResponse
          ? calculateWorkingHours(createdAt, firstResponse.respondedAt)
          : null;

        const respondedWithinOneDay = firstResponse
          ? isWithinOneWorkingDay(createdAt, firstResponse.respondedAt)
          : false;

        issues.push({
          repository: repo,
          number: issue.number,
          title: issue.title,
          createdAt,
          firstResponseAt: firstResponse?.respondedAt || null,
          responseTimeHours,
          respondedBy: firstResponse?.respondedBy || null,
          reportedBy: issue.user?.login || null,
          respondedWithinOneDay,
          weekStarting: getWeekStart(createdAt),
          url: issue.html_url,
          type: 'issue',
        });
      }

      console.log(`✓ Processed ${issues.length} issues`);
      return issues;
    } catch (error: any) {
      if (error.message && error.message.includes('rate limit')) {
        await this.logRateLimitError(error, `Fetching issues for ${repo}`);
      }
      throw new Error(`Failed to fetch issues for ${repo}: ${error.message}`);
    }
  }

  /**
   * Process a single pull request
   */
  private async processPullRequest(
    repo: string,
    pr: any
  ): Promise<IssueData | null> {
    try {
      const createdAt = new Date(pr.created_at);
      const author = pr.user?.login || '';

      // Skip PRs created by repo team members
      if (this.isRepoTeamMember(repo, author)) return null;

      // Skip PRs created by bots
      if (author === 'vaadin-bot' || author === 'dependabot[bot]') return null;

      // Only fetch full PR details if the PR is closed (potentially merged)
      let prDetails = null;
      if (pr.state === 'closed') {
        prDetails = await this.octokit.pulls.get({
          owner: this.organization,
          repo: repo,
          pull_number: pr.number,
        });
      }

      const firstResponse = await this.findFirstOrgResponse(
        repo,
        pr.number,
        'pr',
        prDetails?.data
      );

      const responseTimeHours = firstResponse
        ? calculateWorkingHours(createdAt, firstResponse.respondedAt)
        : null;

      const respondedWithinOneDay = firstResponse
        ? isWithinOneWorkingDay(createdAt, firstResponse.respondedAt)
        : false;

      return {
        repository: repo,
        number: pr.number,
        title: pr.title,
        createdAt,
        firstResponseAt: firstResponse?.respondedAt || null,
        responseTimeHours,
        respondedBy: firstResponse?.respondedBy || null,
        reportedBy: pr.user?.login || null,
        respondedWithinOneDay,
        weekStarting: getWeekStart(createdAt),
        url: pr.html_url,
        type: 'pr',
      };
    } catch (error: any) {
      if (error.message && error.message.includes('rate limit')) {
        // Rate limit errors are logged at a higher level
        throw error;
      }
      console.error(`Error processing PR #${pr.number}: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch pull requests for a repository within a date range
   * Optimized with parallel processing in batches
   */
  async fetchPullRequests(
    repo: string,
    startDate: Date,
    endDate: Date
  ): Promise<IssueData[]> {
    console.log(`Fetching pull requests for ${this.organization}/${repo}...`);
    
    try {
      // Use Search API for accurate date-range filtering
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      const query = `repo:${this.organization}/${repo} is:pr created:${startDateStr}..${endDateStr}`;

      const searchResults = await this.octokit.paginate(
        this.octokit.search.issuesAndPullRequests,
        {
          q: query,
          per_page: 100,
        }
      );

      // Filter to only pull requests
      const pullRequests = searchResults.filter(item => item.pull_request);

      // Process PRs in parallel batches
      const BATCH_SIZE = 10;
      const prs: IssueData[] = [];

      for (let i = 0; i < pullRequests.length; i += BATCH_SIZE) {
        const batch = pullRequests.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(pr => this.processPullRequest(repo, pr))
        );
        
        // Filter out nulls (filtered PRs) and add to results
        prs.push(...results.filter((pr): pr is IssueData => pr !== null));
      }

      console.log(`✓ Processed ${prs.length} pull requests`);
      return prs;
    } catch (error: any) {
      if (error.message && error.message.includes('rate limit')) {
        await this.logRateLimitError(error, `Fetching PRs for ${repo}`);
      }
      throw new Error(`Failed to fetch PRs for ${repo}: ${error.message}`);
    }
  }

  /**
   * Find the first response from an organization member
   * Optimized to fetch in chronological order and stop early
   */
  private async findFirstOrgResponse(
    repo: string,
    issueNumber: number,
    type: 'issue' | 'pr',
    prDetails?: any
  ): Promise<{ respondedAt: Date; respondedBy: string } | null> {
    try {
      if (type === 'pr') {
        // For PRs, fetch all three types in parallel
        // Only fetch first 10 of each - team usually responds early
        const [comments, reviewComments, reviews] = await Promise.all([
          this.octokit.issues.listComments({
            owner: this.organization,
            repo: repo,
            issue_number: issueNumber,
            per_page: 10,
            direction: 'asc', // Oldest first
          }),
          this.octokit.pulls.listReviewComments({
            owner: this.organization,
            repo: repo,
            pull_number: issueNumber,
            per_page: 10,
            direction: 'asc', // Oldest first
          }),
          this.octokit.pulls.listReviews({
            owner: this.organization,
            repo: repo,
            pull_number: issueNumber,
            per_page: 10,
          }),
        ]);

        // Combine all responses with timestamps
        const allResponses: Array<{ date: Date; author: string }> = [];

        // Process comments
        for (const comment of comments.data) {
          const author = comment.user?.login;
          if (author && this.isOrgMember(author)) {
            allResponses.push({
              date: new Date(comment.created_at),
              author,
            });
          }
        }

        // Process review comments
        for (const comment of reviewComments.data) {
          const author = comment.user?.login;
          if (author && this.isOrgMember(author)) {
            allResponses.push({
              date: new Date(comment.created_at),
              author,
            });
          }
        }

        // Process reviews
        for (const review of reviews.data) {
          const author = review.user?.login;
          if (author && this.isOrgMember(author) && review.submitted_at) {
            allResponses.push({
              date: new Date(review.submitted_at),
              author,
            });
          }
        }

        // Check if PR was merged by org member
        if (prDetails?.merged_at && prDetails?.merged_by?.login) {
          const mergedBy = prDetails.merged_by.login;
          if (this.isOrgMember(mergedBy)) {
            allResponses.push({
              date: new Date(prDetails.merged_at),
              author: mergedBy,
            });
          }
        }

        // Find the earliest response
        if (allResponses.length === 0) return null;

        const earliest = allResponses.reduce((min, curr) =>
          curr.date < min.date ? curr : min
        );

        return {
          respondedAt: earliest.date,
          respondedBy: earliest.author,
        };
      } else {
        // For issues, just fetch first 10 comments - team usually responds early
        const response = await this.octokit.issues.listComments({
          owner: this.organization,
          repo: repo,
          issue_number: issueNumber,
          per_page: 10,
          direction: 'asc', // Oldest first
        });

        // Find first org member comment
        for (const comment of response.data) {
          const author = comment.user?.login;
          if (author && this.isOrgMember(author)) {
            return {
              respondedAt: new Date(comment.created_at),
              respondedBy: author,
            };
          }
        }

        return null;
      }
    } catch (error: any) {
      console.error(`Error finding first response for #${issueNumber}: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch all data for configured repositories
   * Processes repositories sequentially to avoid Search API rate limits
   */
  async fetchAllData(
    repositories: RepositoryConfig[],
    startDate: Date,
    endDate: Date
  ): Promise<IssueData[]> {
    const allData: IssueData[] = [];

    // Process repositories sequentially to avoid overwhelming Search API
    for (const repoConfig of repositories) {
      const issues = await this.fetchIssues(repoConfig.name, startDate, endDate);
      const prs = await this.fetchPullRequests(repoConfig.name, startDate, endDate);
      allData.push(...issues, ...prs);
    }

    return allData;
  }
}

