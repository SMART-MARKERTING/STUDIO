export type ViewName = "Overview" | "Calendar" | "Content" | "Approvals" | "Assets" | "Analytics" | "Settings";
export type Platform = "facebook" | "instagram" | "linkedin" | "twitter";
export type Risk = "Green" | "Yellow" | "Red";
export type PostStatus = "Draft" | "Needs review" | "Approved" | "Scheduled" | "Published" | "Failed";

export type StudioPost = {
  id: string;
  title: string;
  pillar: string;
  platforms: Platform[];
  risk: Risk;
  status: PostStatus;
  assetId: string;
  scheduledAt: string;
  captions: Record<Platform, string>;
  source: string;
  disclosure: string;
  campaignId: string;
  landingPage: string;
  notes: string;
  metrics: { impressions: number; clicks: number; leads: number; applications: number };
  providerPostIds: string[];
  lastError: string;
  createdAt: string;
  updatedAt: string;
};

export type StudioAsset = {
  id: string;
  src: string;
  title: string;
  category: "HELOC" | "DSCR" | "Brand" | "Headshot" | "Other";
  approval: "Approved" | "Review required" | "Expired";
  source: "bundled" | "upload" | "url";
  createdAt: string;
};

export type Channel = { id: Platform; name: string; mark: string; color: string; connected: boolean; handle: string; lastChecked: string };
export type AuditEvent = { id: string; at: string; action: string; detail: string };
export type StudioState = { version: 2; paused: boolean; posts: StudioPost[]; assets: StudioAsset[]; channels: Channel[]; audit: AuditEvent[] };

export const platformLabels: Record<Platform, string> = { facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", twitter: "X" };
export const platformMarks: Record<Platform, string> = { facebook: "f", instagram: "◎", linkedin: "in", twitter: "𝕏" };
export const platformColors: Record<Platform, string> = { facebook: "#2477f2", instagram: "#d94a8c", linkedin: "#1976b9", twitter: "#111827" };

const bundledAssets: StudioAsset[] = [
  ["asset-heloc-tap", "/assets/just-tap-in.png", "HELOC — Just tap in", "HELOC", "Approved"],
  ["asset-heloc-personal", "/assets/personal-loan.png", "Home-secured alternative", "HELOC", "Approved"],
  ["asset-apply-home", "/assets/apply-home.jpg", "Apply from home", "HELOC", "Approved"],
  ["asset-dscr-cashout", "/assets/dscr-cashout.png", "DSCR cash-out — dated rate example", "DSCR", "Expired"],
  ["asset-headshot", "/assets/headshot.jpeg", "Mykoal DeShazo headshot", "Headshot", "Approved"],
  ["asset-smart-marketing-logo", "/assets/smart-marketing-logo.jpg", "Smart Marketing logo", "Brand", "Approved"],
].map(([id, src, title, category, approval], index) => ({
  id, src, title, category, approval, source: "bundled", createdAt: `2026-07-01T16:${String(index * 5).padStart(2, "0")}:00.000Z`,
})) as StudioAsset[];

const topics = [
  ["Keep your low first rate while exploring equity", "HELOC education", "Green", "asset-heloc-tap", ["facebook", "instagram"], "A home equity line may let qualified homeowners access available equity without replacing their existing first mortgage. Learn how the structure works, compare the terms, and choose only what fits your goals."],
  ["How DSCR loans evaluate rental cash flow", "Investor loans", "Yellow", "asset-dscr-cashout", ["linkedin", "twitter"], "A DSCR loan evaluates an investment property's rental income in relation to its housing expense. Guidelines, documentation, pricing, and property eligibility vary by lender and scenario."],
  ["Five documents buyers can prepare early", "First-time buyers", "Green", "asset-apply-home", ["facebook", "instagram", "linkedin"], "Getting organized early can make a mortgage conversation easier. Start with identification, income documents, recent asset statements, housing history, and permission to review credit when you are ready."],
  ["Home equity versus an unsecured personal loan", "Homeowner education", "Yellow", "asset-heloc-personal", ["facebook", "instagram"], "Home-secured and unsecured borrowing solve different needs. Compare the collateral, rate structure, repayment terms, closing costs, and risk to your home before choosing an option."],
  ["Mortgage myth: perfect credit is always required", "Mortgage myths", "Green", "asset-headshot", ["linkedin", "twitter"], "There is no single credit score that fits every mortgage program. Eligibility depends on the full loan profile, product guidelines, property, documentation, and current lender requirements."],
  ["Questions real estate partners can ask investor clients", "Realtor education", "Green", "asset-headshot", ["linkedin", "facebook"], "Investor financing conversations move faster when the property type, estimated rent, experience, entity structure, reserves, timeline, and exit strategy are clear from the beginning."],
  ["Before using equity, define the purpose and timeline", "Financial education", "Yellow", "asset-heloc-tap", ["facebook", "instagram", "linkedin"], "Before borrowing against home equity, define the amount, purpose, repayment plan, and expected timeline. A clear plan makes it easier to compare a line of credit, fixed second mortgage, or refinance."],
] as [string, string, Risk, string, Platform[], string][];

function nextMonday(from = new Date()) {
  const date = new Date(from);
  date.setHours(9, 0, 0, 0);
  date.setDate(date.getDate() + (date.getDay() === 0 ? 1 : 8 - date.getDay()));
  return date;
}

function captions(base: string): Record<Platform, string> {
  return {
    facebook: `${base}\n\nWant to review the options for your situation? Start with a no-pressure conversation.`,
    instagram: `${base}\n\nSave this for later. #MortgageEducation #HomeFinance`,
    linkedin: `${base}\n\nThe right structure depends on the complete borrower and property profile.`,
    twitter: base.length > 270 ? `${base.slice(0, 266)}…` : base,
  };
}

export function createFallbackBatch(existingCount = 0, from = new Date()): StudioPost[] {
  const monday = nextMonday(from);
  const now = new Date().toISOString();
  return topics.map(([title, pillar, risk, assetId, platforms, base], index) => {
    const scheduled = new Date(monday);
    scheduled.setDate(scheduled.getDate() + index);
    scheduled.setHours(9 + index % 3, index % 2 ? 30 : 0, 0, 0);
    return {
      id: `cs-${Date.now()}-${existingCount + index + 1}`, title, pillar, platforms, risk, status: "Needs review", assetId,
      scheduledAt: scheduled.toISOString(), captions: captions(base),
      source: pillar === "Investor loans" ? "DSCR audited campaign playbook" : "Adaxa approved evergreen education library",
      disclosure: risk === "Green" ? "ADAXA-EVG-2026.07" : "ADAXA-MORTGAGE-REVIEW-2026.07",
      campaignId: `weekly-${monday.toISOString().slice(0, 10)}-${index + 1}`, landingPage: "https://smartr8.com/",
      notes: "Generated as part of the weekly review batch.", metrics: { impressions: 0, clicks: 0, leads: 0, applications: 0 },
      providerPostIds: [], lastError: "", createdAt: now, updatedAt: now,
    };
  });
}

function seedPosts() {
  const states: PostStatus[] = ["Approved", "Needs review", "Approved", "Needs review", "Draft"];
  return createFallbackBatch(0, new Date("2026-07-05T12:00:00-07:00")).slice(0, 5).map((post, index) => ({
    ...post, id: `cs-seed-${index + 1}`, status: states[index], metrics: { impressions: 0, clicks: 0, leads: 0, applications: 0 },
  }));
}

export function createInitialState(): StudioState {
  return {
    version: 2, paused: false, posts: seedPosts(), assets: bundledAssets,
    channels: (Object.keys(platformLabels) as Platform[]).map((id) => ({ id, name: platformLabels[id], mark: platformMarks[id], color: platformColors[id], connected: false, handle: "", lastChecked: "" })),
    audit: [{ id: "audit-seed", at: new Date().toISOString(), action: "Workspace initialized", detail: "Functional local workspace created from approved campaign assets." }],
  };
}

export function normalizeGeneratedPosts(generated: Array<Partial<StudioPost> & { caption?: string }>, assets: StudioAsset[], existingCount: number) {
  const fallback = createFallbackBatch(existingCount);
  return generated.slice(0, 7).map((item, index) => {
    const base = fallback[index] ?? fallback[0];
    const platforms = Array.isArray(item.platforms) ? item.platforms.filter((p): p is Platform => p in platformLabels) : base.platforms;
    const caption = typeof item.caption === "string" ? item.caption : base.captions.facebook;
    return {
      ...base, id: `cs-ai-${Date.now()}-${existingCount + index + 1}`, title: String(item.title || base.title), pillar: String(item.pillar || base.pillar),
      platforms: platforms.length ? platforms : base.platforms, risk: (["Green", "Yellow", "Red"] as unknown[]).includes(item.risk) ? item.risk as Risk : base.risk,
      assetId: assets.some((asset) => asset.id === item.assetId) ? String(item.assetId) : base.assetId,
      captions: item.captions ? { ...base.captions, ...item.captions } : captions(caption),
      source: String(item.source || "OpenAI-assisted draft using the approved content library"), disclosure: String(item.disclosure || base.disclosure),
      notes: "AI-generated draft. Human review is required before publishing.", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
  });
}

export function newBlankPost(assets: StudioAsset[]): StudioPost {
  const scheduled = new Date(); scheduled.setHours(scheduled.getHours() + 1, 0, 0, 0); const now = new Date().toISOString();
  return { id: `cs-manual-${Date.now()}`, title: "", pillar: "Homeowner education", platforms: ["facebook", "instagram"], risk: "Green", status: "Draft", assetId: assets.find((a) => a.approval === "Approved")?.id ?? "", scheduledAt: scheduled.toISOString(), captions: { facebook: "", instagram: "", linkedin: "", twitter: "" }, source: "", disclosure: "ADAXA-EVG-2026.07", campaignId: `manual-${scheduled.toISOString().slice(0,10)}`, landingPage: "https://smartr8.com/", notes: "", metrics: { impressions: 0, clicks: 0, leads: 0, applications: 0 }, providerPostIds: [], lastError: "", createdAt: now, updatedAt: now };
}

export function addAudit(action: string, detail: string): AuditEvent { return { id: `audit-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, at: new Date().toISOString(), action, detail }; }
export function formatSchedule(iso: string) { const d = new Date(iso); return Number.isNaN(d.getTime()) ? { day: "TBD", date: "—", time: "Unscheduled" } : { day: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(), date: d.toLocaleDateString("en-US", { day: "2-digit" }), time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) }; }
export function localDateTimeValue(iso: string) { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16); }
export function riskRequiresSource(post: StudioPost) { return post.risk !== "Green" && (!post.source.trim() || !post.disclosure.trim()); }
export function isPlaceholderText(value: string) { return /write the core message|lorem ipsum|untitled content|replace this|your caption here/i.test(value); }
export function postHasPlaceholder(post: StudioPost) { return isPlaceholderText(post.title) || post.platforms.some((platform) => isPlaceholderText(post.captions[platform])); }
