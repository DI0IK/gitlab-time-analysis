import { matchLabelToCategory } from '../utils/categoryUtils';
import { IssueLog } from '../types'; // assume IssueLog type definition exists

// Compute issues without time estimate
export function computeIssuesNoEstimate(timelogs: IssueLog[]) {
  const issuesNoEstimate: Record<
    string,
    {
      used: number;
      category: string;
      issueTitle: string;
      issueLabels?: string[];
    }
  > = {};

  timelogs.forEach((log) => {
    if (!log.issueUrl) return;
    if (!log.issueTimeEstimate) {
      // Determine category
      let category = 'Other';
      for (const label of log.issueLabels) {
        const catDef = matchLabelToCategory(label);
        if (catDef) {
          category = catDef.label;
          break;
        }
      }
      if (!issuesNoEstimate[log.issueUrl]) {
        issuesNoEstimate[log.issueUrl] = {
          used: 0,
          category,
          issueTitle: log.issueTitle,
          issueLabels: log.issueLabels,
        };
      }
      issuesNoEstimate[log.issueUrl].used += log.timeSpent;
    }
  });
  return issuesNoEstimate;
}

// Compute issues with time estimate (including category)
export function computeIssuesWithEstimate(timelogs: IssueLog[]) {
  const issuesWithEstimate: Record<
    string,
    {
      used: number;
      estimated: number;
      category: string;
      issueTitle: string;
      issueLabels: string[];
    }
  > = {};

  timelogs.forEach((log) => {
    if (!log.issueUrl) return;
    if (log.issueTimeEstimate) {
      let category = 'Other';
      for (const label of log.issueLabels) {
        const catDef = matchLabelToCategory(label);
        if (catDef) {
          category = catDef.label;
          break;
        }
      }
      if (!issuesWithEstimate[log.issueUrl]) {
        issuesWithEstimate[log.issueUrl] = {
          used: 0,
          estimated: log.issueTimeEstimate,
          category,
          issueTitle: log.issueTitle,
          issueLabels: log.issueLabels,
        };
      }
      issuesWithEstimate[log.issueUrl].used += log.timeSpent;
    }
  });
  return issuesWithEstimate;
}
