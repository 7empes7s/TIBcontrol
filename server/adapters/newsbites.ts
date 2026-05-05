import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const ARTICLES_PATH = "/opt/newsbites/content/articles";
const NEWSBITES_PATH = "/opt/newsbites";
const NEWSBITES_URL = "http://127.0.0.1:3001";

export interface ArticleMeta {
  slug: string;
  title: string;
  status: string;
  date: string;
  vertical: string;
  wordCount: number;
}

function parseField(fm: string, key: string): string {
  const m = fm.match(new RegExp(`^${key}:\\s*['"\\s]?([^'"\\n]+)['"\\s]?$`, "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
}

function parseFrontmatter(content: string): { fm: Record<string, string>; bodyLen: number } {
  const m = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, bodyLen: content.length };
  const fm = m[1];
  const body = m[2] ?? "";
  return {
    fm: {
      title: parseField(fm, "title"),
      status: parseField(fm, "status"),
      date: parseField(fm, "date"),
      vertical: parseField(fm, "vertical"),
    },
    bodyLen: body.length,
  };
}

export function getAllArticles(): ArticleMeta[] {
  let files: string[];
  try {
    files = readdirSync(ARTICLES_PATH).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }

  const articles: ArticleMeta[] = [];
  for (const file of files) {
    try {
      const content = readFileSync(join(ARTICLES_PATH, file), "utf8");
      const { fm, bodyLen } = parseFrontmatter(content);
      articles.push({
        slug: file.replace(/\.md$/, ""),
        title: fm.title,
        status: fm.status,
        date: fm.date,
        vertical: fm.vertical,
        wordCount: Math.round(bodyLen / 5),
      });
    } catch {}
  }
  return articles;
}

export function getArticles(): ArticleMeta[] {
  return getAllArticles().filter((a) => a.status === "published" || a.status === "approved");
}

export interface DeployInfo {
  lastDeployAt: string | null;
  lastCommitHash: string | null;
  siteReachable: boolean;
}

export async function getDeployInfo(): Promise<DeployInfo> {
  let lastDeployAt: string | null = null;
  let lastCommitHash: string | null = null;
  try {
    const out = execSync(`git -C ${NEWSBITES_PATH} log -1 --format="%H|%ci" 2>/dev/null`, {
      encoding: "utf8", timeout: 3000,
    }).trim();
    if (out) {
      const [hash, date] = out.split("|");
      lastCommitHash = hash?.trim() ?? null;
      lastDeployAt = date?.trim() ?? null;
    }
  } catch {}

  const siteReachable = await isSiteReachable();
  return { lastDeployAt, lastCommitHash, siteReachable };
}

export async function isSiteReachable(): Promise<boolean> {
  try {
    const res = await fetch(NEWSBITES_URL, { signal: AbortSignal.timeout(2000) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

export function buildNewsBitesWidget(articles: ArticleMeta[]) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const published = articles.filter((a) => a.status === "published");
  const publishedToday = published.filter((a) => a.date === todayStr).length;

  // articles per day for last 7 days
  const publishedLast7d: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    publishedLast7d.push(published.filter((a) => a.date === ds).length);
  }

  // top verticals (all time)
  const verticalCounts = new Map<string, number>();
  for (const a of published) {
    if (a.vertical) verticalCounts.set(a.vertical, (verticalCounts.get(a.vertical) ?? 0) + 1);
  }
  const topVerticals = [...verticalCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([vertical, count]) => ({ vertical, count }));

  // latest 3 published (sort by date desc)
  const sorted = [...published].sort((a, b) => b.date.localeCompare(a.date));
  const latestArticles = sorted.slice(0, 3).map(({ slug, title, vertical, date }) => ({
    slug, title, vertical, date,
  }));

  return {
    totalPublished: published.length,
    publishedToday,
    publishedLast7d,
    topVerticals,
    latestArticles,
  };
}
