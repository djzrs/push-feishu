/**
 * GitHub 事件 → 人类可读文本
 * 只覆盖常见事件，其他事件可自行扩展
 */

function repoName(payload) {
  return payload?.repository?.full_name || 'unknown repo';
}

function pusherName(payload) {
  return payload?.pusher?.name || payload?.sender?.login || 'unknown';
}

export function githubEventToText(event, payload, env) {
  switch (event) {
    case 'ping': {
      return `✅ GitHub Webhook 已连通 (${repoName(payload)})`;
    }

    case 'push': {
      const repo = repoName(payload);
      const pusher = pusherName(payload);
      const branch = (payload?.ref || '').replace('refs/heads/', '');
      const commits = payload?.commits || [];
      const lines = commits
        .slice(0, 5)
        .map((c) => `  - ${(c.message || '').split('\n')[0]} (${c.author?.name || ''})`);
      const more = commits.length > 5 ? `\n  ... 等 ${commits.length} 个提交` : '';
      return `[GitHub] ${pusher} 推送 ${commits.length} 个提交到 ${repo}:${branch}\n${lines.join('\n')}${more}`;
    }

    case 'pull_request': {
      const pr = payload?.pull_request;
      const action = payload?.action || 'updated';
      const repo = repoName(payload);
      if (!pr) return null;
      const title = pr.title || '';
      const url = pr.html_url || '';
      const author = pr.user?.login || '';
      return `[GitHub] PR ${action}: ${repo} #${pr.number} ${title} by ${author}\n${url}`;
    }

    case 'issues': {
      const issue = payload?.issue;
      const action = payload?.action || 'updated';
      const repo = repoName(payload);
      if (!issue) return null;
      const title = issue.title || '';
      const url = issue.html_url || '';
      return `[GitHub] Issue ${action}: ${repo} #${issue.number} ${title}\n${url}`;
    }

    case 'issue_comment': {
      const issue = payload?.issue;
      const action = payload?.action || 'commented';
      const repo = repoName(payload);
      if (!issue) return null;
      const body = (payload?.comment?.body || '').slice(0, 100);
      const user = payload?.comment?.user?.login || '';
      return `[GitHub] ${user} ${action} on ${repo} #${issue.number}:\n${body}`;
    }

    case 'star': {
      const repo = repoName(payload);
      const sender = payload?.sender?.login || '';
      const action = payload?.action === 'created' ? 'starred' : 'unstarred';
      const stars = payload?.repository?.stargazers_count ?? '?';
      return `[GitHub] ${sender} ${action} ${repo} (★ ${stars})`;
    }

    case 'fork': {
      const repo = repoName(payload);
      const sender = payload?.sender?.login || '';
      return `[GitHub] ${sender} forked ${repo}`;
    }

    case 'release': {
      const release = payload?.release;
      const action = payload?.action || 'published';
      const repo = repoName(payload);
      if (!release) return null;
      return `[GitHub] Release ${action}: ${repo} ${release.tag_name || ''}\n${release.html_url || ''}`;
    }

    case 'watch': {
      const repo = repoName(payload);
      const sender = payload?.sender?.login || '';
      return `[GitHub] ${sender} starred ${repo}`;
    }

    default:
      return null;
  }
}