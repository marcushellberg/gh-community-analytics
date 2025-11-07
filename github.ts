import { Octokit } from '@octokit/rest';
import type { Config, IssueData } from './types.ts';
import { calculateWorkingHours, isWithinOneWorkingDay, getWeekStart } from './utils.ts';

export class GitHubAnalytics {
  private octokit: Octokit;
  private organization: string;
  private orgMembers: Set<string>;

  constructor(config: Config) {
    this.octokit = new Octokit({ auth: config.githubToken });
    this.organization = config.organization;
    this.orgMembers = new Set();
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
      // Use search API for efficient date-range filtering
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

        // Skip issues created by org members
        if (this.isOrgMember(issue.user?.login || '')) continue;

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
          respondedWithinOneDay,
          weekStarting: getWeekStart(createdAt),
          url: issue.html_url,
          type: 'issue',
        });
      }

      console.log(`✓ Processed ${issues.length} issues`);
      return issues;
    } catch (error: any) {
      throw new Error(`Failed to fetch issues for ${repo}: ${error.message}`);
    }
  }

  /**
   * Fetch pull requests for a repository within a date range
   */
  async fetchPullRequests(
    repo: string,
    startDate: Date,
    endDate: Date
  ): Promise<IssueData[]> {
    console.log(`Fetching pull requests for ${this.organization}/${repo}...`);
    
    const prs: IssueData[] = [];

    try {
      // Use search API for efficient date-range filtering
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

      for (const pr of searchResults) {
        // Only process pull requests
        if (!pr.pull_request) continue;

        const createdAt = new Date(pr.created_at);

        // Skip PRs created by org members
        if (this.isOrgMember(pr.user?.login || '')) continue;

        // Get full PR details to check merge status
        const prDetails = await this.octokit.pulls.get({
          owner: this.organization,
          repo: repo,
          pull_number: pr.number,
        });

        const firstResponse = await this.findFirstOrgResponse(
          repo,
          pr.number,
          'pr',
          prDetails.data
        );

        const responseTimeHours = firstResponse
          ? calculateWorkingHours(createdAt, firstResponse.respondedAt)
          : null;

        const respondedWithinOneDay = firstResponse
          ? isWithinOneWorkingDay(createdAt, firstResponse.respondedAt)
          : false;

        prs.push({
          repository: repo,
          number: pr.number,
          title: pr.title,
          createdAt,
          firstResponseAt: firstResponse?.respondedAt || null,
          responseTimeHours,
          respondedBy: firstResponse?.respondedBy || null,
          respondedWithinOneDay,
          weekStarting: getWeekStart(createdAt),
          url: pr.html_url,
          type: 'pr',
        });
      }

      console.log(`✓ Processed ${prs.length} pull requests`);
      return prs;
    } catch (error: any) {
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
   */
  async fetchAllData(
    repositories: string[],
    startDate: Date,
    endDate: Date
  ): Promise<IssueData[]> {
    const allData: IssueData[] = [];

    for (const repo of repositories) {
      const issues = await this.fetchIssues(repo, startDate, endDate);
      const prs = await this.fetchPullRequests(repo, startDate, endDate);
      allData.push(...issues, ...prs);
    }

    return allData;
  }
}

