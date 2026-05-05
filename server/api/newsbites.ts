import { getAllArticles, getDeployInfo } from "../adapters/newsbites.ts";
import { ok, type ApiEnvelope, type NewsBitesDetail } from "./types.ts";

export async function newsBitesHandler(): Promise<Response> {
  const articles = getAllArticles();
  const deploy = await getDeployInfo();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const totalPublished = articles.filter((a) => a.status === "published").length;
  const totalApproved = articles.filter((a) => a.status === "approved").length;
  const totalDraft = articles.filter((a) => a.status !== "published" && a.status !== "approved").length;
  const publishedToday = articles.filter((a) => a.status === "published" && a.date === todayStr).length;

  // Last 30 days publish rate
  const publishedLast30d: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    publishedLast30d.push({
      date: ds,
      count: articles.filter((a) => a.status === "published" && a.date === ds).length,
    });
  }

  // Vertical mix (published only)
  const vertMap = new Map<string, number>();
  for (const a of articles.filter((a) => a.status === "published")) {
    if (a.vertical) vertMap.set(a.vertical, (vertMap.get(a.vertical) ?? 0) + 1);
  }
  const verticalMix = [...vertMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([vertical, count]) => ({ vertical, count }));

  const data: NewsBitesDetail = {
    articles: articles.sort((a, b) => b.date.localeCompare(a.date)),
    stats: { totalPublished, totalApproved, totalDraft, publishedToday, publishedLast30d, verticalMix },
    deploy,
  };

  const envelope: ApiEnvelope<NewsBitesDetail> = ok(data, { newsbites: "ok" });
  return new Response(JSON.stringify(envelope), { headers: { "Content-Type": "application/json" } });
}
