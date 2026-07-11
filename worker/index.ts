/** Cloudflare Worker entry point plus server-side Content Studio integrations. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  IMAGES?: { input(stream: ReadableStream): { transform(options: Record<string, unknown>): { output(options: { format: string; quality: number }): Promise<{ response(): Response }> } } };
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  AYRSHARE_API_KEY?: string;
  AYRSHARE_PROFILE_KEY?: string;
  AYRSHARE_TWITTER_API_KEY?: string;
  AYRSHARE_TWITTER_API_SECRET?: string;
  STUDIO_ADMIN_EMAIL?: string;
}

interface ExecutionContext { waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void }
type Platform = "facebook" | "instagram" | "linkedin" | "twitter";
const supportedPlatforms: Platform[] = ["facebook", "instagram", "linkedin", "twitter"];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

function authorize(request: Request, env: Env) {
  if (!env.STUDIO_ADMIN_EMAIL) return null;
  const actual = request.headers.get("cf-access-authenticated-user-email") || request.headers.get("oai-authenticated-user-email") || request.headers.get("x-authenticated-user-email") || "";
  if (actual.trim().toLowerCase() === env.STUDIO_ADMIN_EMAIL.trim().toLowerCase()) return null;
  return json({ error: "This workspace is restricted to the configured administrator.", code: "ADMIN_REQUIRED" }, 403);
}

function providerHeaders(env: Env, includeTwitter = false) {
  const headers: Record<string, string> = { Authorization: `Bearer ${env.AYRSHARE_API_KEY || ""}`, "content-type": "application/json" };
  if (env.AYRSHARE_PROFILE_KEY) headers["Profile-Key"] = env.AYRSHARE_PROFILE_KEY;
  if (includeTwitter && env.AYRSHARE_TWITTER_API_KEY) headers["X-Twitter-OAuth1-Api-Key"] = env.AYRSHARE_TWITTER_API_KEY;
  if (includeTwitter && env.AYRSHARE_TWITTER_API_SECRET) headers["X-Twitter-OAuth1-Api-Secret"] = env.AYRSHARE_TWITTER_API_SECRET;
  return headers;
}

async function responseError(response: Response, fallback: string) {
  try {
    const body = await response.json() as { message?: string; error?: string; details?: string };
    return body.message || body.error || body.details || fallback;
  } catch { return fallback; }
}

function parseConnectedAccounts(value: unknown) {
  const connected = new Map<Platform, string>();
  const normalize = (name: string) => name.toLowerCase().replace("x/twitter", "twitter").replace(/^x$/, "twitter") as Platform;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") {
        const name = normalize(item);
        if (supportedPlatforms.includes(name)) connected.set(name, "Connected professional account");
      } else if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const raw = String(record.platform || record.name || record.socialNetwork || "");
        const name = normalize(raw);
        if (supportedPlatforms.includes(name)) connected.set(name, String(record.username || record.handle || record.displayName || "Connected professional account"));
      }
    }
  } else if (value && typeof value === "object") {
    for (const [raw, detail] of Object.entries(value as Record<string, unknown>)) {
      const name = normalize(raw);
      if (!supportedPlatforms.includes(name) || detail === false || detail === null) continue;
      const record = typeof detail === "object" ? detail as Record<string, unknown> : {};
      connected.set(name, String(record.username || record.handle || record.displayName || "Connected professional account"));
    }
  }
  return connected;
}

async function integrationStatus(env: Env) {
  const empty = Object.fromEntries(supportedPlatforms.map((platform) => [platform, { connected: false, handle: "" }]));
  if (!env.AYRSHARE_API_KEY) return { configured: false, channels: empty };
  const response = await fetch("https://api.ayrshare.com/api/user", { headers: providerHeaders(env) });
  if (!response.ok) throw new Error(await responseError(response, "Ayrshare rejected the configured credentials."));
  const body = await response.json() as Record<string, unknown>;
  const accounts = parseConnectedAccounts(body.activeSocialAccounts || body.activeSocialAccountsList || body.socialAccounts);
  return { configured: true, channels: Object.fromEntries(supportedPlatforms.map((platform) => [platform, { connected: accounts.has(platform), handle: accounts.get(platform) || "" }])) };
}

function generatedPostSchema() {
  return {
    type: "object", additionalProperties: false,
    properties: {
      posts: { type: "array", minItems: 7, maxItems: 7, items: {
        type: "object", additionalProperties: false,
        properties: {
          title: { type: "string" }, pillar: { type: "string" }, platforms: { type: "array", minItems: 1, items: { type: "string", enum: supportedPlatforms } },
          risk: { type: "string", enum: ["Green", "Yellow", "Red"] }, assetId: { type: "string" }, caption: { type: "string" }, source: { type: "string" }, disclosure: { type: "string" },
        }, required: ["title", "pillar", "platforms", "risk", "assetId", "caption", "source", "disclosure"],
      } },
    }, required: ["posts"],
  };
}

function extractOutputText(body: Record<string, unknown>) {
  if (typeof body.output_text === "string") return body.output_text;
  const output = Array.isArray(body.output) ? body.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content) ? (item as { content: unknown[] }).content : [];
    for (const part of content) if (part && typeof part === "object" && typeof (part as Record<string, unknown>).text === "string") return String((part as Record<string, unknown>).text);
  }
  return "";
}

async function generateBatch(request: Request, env: Env) {
  if (!env.OPENAI_API_KEY) return json({ error: "Live AI generation is not configured. Add OPENAI_API_KEY; the app can still create its compliant local batch.", code: "OPENAI_NOT_CONFIGURED" }, 503);
  const input = await request.json().catch(() => ({})) as { assets?: Array<{ id?: string; title?: string; category?: string; approval?: string }> };
  const approvedAssets = (input.assets || []).filter((asset) => asset.approval === "Approved").slice(0, 30);
  const prompt = `Create exactly seven distinct mortgage education social posts for Adaxa Home and Smart Marketing. Use only evergreen educational language. Do not invent or imply rates, payments, savings, approval, qualification, speed, availability, testimonials, or deadlines. Mark any DSCR, product comparison, credit, eligibility, or home-equity risk claim Yellow. Red is reserved for a verified current rate/term claim, which should generally be avoided. Yellow/Red items must name a credible review source and disclosure record. Make copy useful, concise, plain-English, and ready for human review. Choose only from these approved assets: ${JSON.stringify(approvedAssets)}.`;
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({
    model: env.OPENAI_MODEL || "gpt-5.6-luna", store: false,
    input: [{ role: "system", content: [{ type: "input_text", text: "You are a compliance-conscious mortgage content strategist. Return only schema-valid content and never fabricate regulated claims." }] }, { role: "user", content: [{ type: "input_text", text: prompt }] }],
    text: { format: { type: "json_schema", name: "weekly_content_batch", strict: true, schema: generatedPostSchema() } },
  }) });
  if (!response.ok) return json({ error: await responseError(response, "OpenAI generation failed."), code: "OPENAI_REQUEST_FAILED" }, 502);
  const body = await response.json() as Record<string, unknown>;
  const text = extractOutputText(body);
  try {
    const parsed = JSON.parse(text) as { posts?: unknown[] };
    if (!Array.isArray(parsed.posts) || parsed.posts.length !== 7) throw new Error("wrong length");
    return json({ posts: parsed.posts, source: "openai", model: env.OPENAI_MODEL || "gpt-5.6-luna" });
  } catch { return json({ error: "OpenAI returned an unusable batch. The app will use the compliant local fallback.", code: "INVALID_MODEL_OUTPUT" }, 502); }
}

function trackedCaption(post: Record<string, unknown>, platform: Platform) {
  let caption = String((post.captions as Record<string, unknown> | undefined)?.[platform] || "").trim();
  const landingPage = String(post.landingPage || "").trim();
  if (landingPage) {
    try {
      const link = new URL(landingPage);
      link.searchParams.set("utm_source", platform === "twitter" ? "x" : platform);
      link.searchParams.set("utm_medium", "organic_social");
      link.searchParams.set("utm_campaign", String(post.campaignId || "content-studio"));
      link.searchParams.set("utm_content", String(post.id || "content"));
      const url = link.toString();
      if (platform === "twitter" && `${caption}\n${url}`.length > 275) caption = `${caption.slice(0, Math.max(1, 272 - url.length)).trim()}…`;
      caption = `${caption}\n\n${url}`;
    } catch { /* Ignore invalid optional landing pages; validation below handles core post fields. */ }
  }
  return caption;
}

function providerPostIds(body: unknown) {
  if (!body || typeof body !== "object") return [] as string[];
  const record = body as Record<string, unknown>;
  const direct = [record.id, record.postId].filter((value): value is string => typeof value === "string");
  const nested = Array.isArray(record.postIds) ? record.postIds.flatMap((item) => typeof item === "string" ? [item] : item && typeof item === "object" ? [String((item as Record<string, unknown>).id || (item as Record<string, unknown>).postId || "")].filter(Boolean) : []) : [];
  return [...direct, ...nested];
}

async function publish(request: Request, env: Env) {
  if (!env.AYRSHARE_API_KEY) return json({ error: "Social publishing is not configured. Add AYRSHARE_API_KEY in Cloudflare before sending live content.", code: "AYRSHARE_NOT_CONFIGURED" }, 503);
  const input = await request.json().catch(() => ({})) as { post?: Record<string, unknown>; assetUrl?: string };
  const post = input.post;
  if (!post || !Array.isArray(post.platforms) || !post.platforms.length || !["Approved", "Scheduled"].includes(String(post.status))) return json({ error: "Only approved content with at least one platform can be published.", code: "INVALID_POST" }, 400);
  const targets = post.platforms.filter((value): value is Platform => supportedPlatforms.includes(value as Platform));
  if (!targets.length) return json({ error: "No supported social platform was selected.", code: "INVALID_PLATFORM" }, 400);
  const scheduleDate = String(post.scheduledAt || "");
  const scheduled = Number.isFinite(Date.parse(scheduleDate)) && Date.parse(scheduleDate) > Date.now() + 120_000;
  const results: Array<{ platform: Platform; ok: boolean; ids: string[]; error?: string }> = [];
  for (const platform of targets) {
    if (platform === "twitter" && (!env.AYRSHARE_TWITTER_API_KEY || !env.AYRSHARE_TWITTER_API_SECRET)) {
      results.push({ platform, ok: false, ids: [], error: "X requires AYRSHARE_TWITTER_API_KEY and AYRSHARE_TWITTER_API_SECRET." });
      continue;
    }
    const caption = trackedCaption(post, platform);
    if (!caption) { results.push({ platform, ok: false, ids: [], error: "Caption is empty." }); continue; }
    const payload: Record<string, unknown> = { post: caption, platforms: [platform] };
    if (input.assetUrl?.startsWith("https://")) payload.mediaUrls = [input.assetUrl];
    if (scheduled) payload.scheduleDate = new Date(scheduleDate).toISOString();
    const response = await fetch("https://api.ayrshare.com/api/post", { method: "POST", headers: providerHeaders(env, platform === "twitter"), body: JSON.stringify(payload) });
    if (!response.ok) { results.push({ platform, ok: false, ids: [], error: await responseError(response, `${platformLabels(platform)} rejected the post.`) }); continue; }
    const body = await response.json().catch(() => ({}));
    results.push({ platform, ok: true, ids: providerPostIds(body) });
  }
  const successful = results.filter((result) => result.ok);
  if (!successful.length) return json({ error: results.map((result) => `${platformLabels(result.platform)}: ${result.error}`).join(" "), code: "PUBLISH_FAILED", results }, 502);
  return json({ status: scheduled ? "scheduled" : "published", providerPostIds: successful.flatMap((result) => result.ids), results, warnings: results.filter((result) => !result.ok).map((result) => `${platformLabels(result.platform)}: ${result.error}`) });
}

function platformLabels(platform: Platform) { return platform === "twitter" ? "X" : platform[0].toUpperCase() + platform.slice(1); }

async function analytics(request: Request, env: Env) {
  if (!env.AYRSHARE_API_KEY) return json({ error: "Provider analytics is not configured. Add AYRSHARE_API_KEY; local recorded metrics and CSV export remain available.", code: "AYRSHARE_NOT_CONFIGURED" }, 503);
  const requested = new URL(request.url).searchParams.get("platform");
  const targets = requested && supportedPlatforms.includes(requested as Platform) ? [requested as Platform] : supportedPlatforms;
  const results: Array<{ platform: Platform; ok: boolean; count: number; data?: unknown; error?: string }> = [];
  for (const platform of targets) {
    if (platform === "twitter" && (!env.AYRSHARE_TWITTER_API_KEY || !env.AYRSHARE_TWITTER_API_SECRET)) { results.push({ platform, ok: false, count: 0, error: "X BYO credentials are missing." }); continue; }
    const response = await fetch(`https://api.ayrshare.com/api/history/${platform}`, { headers: providerHeaders(env, platform === "twitter") });
    if (!response.ok) { results.push({ platform, ok: false, count: 0, error: await responseError(response, "History request failed.") }); continue; }
    const body = await response.json() as Record<string, unknown>;
    const history = Array.isArray(body.history) ? body.history : Array.isArray(body.posts) ? body.posts : Array.isArray(body) ? body : [];
    results.push({ platform, ok: true, count: history.length, data: history });
  }
  const ok = results.filter((result) => result.ok);
  if (!ok.length) return json({ error: results.map((result) => `${platformLabels(result.platform)}: ${result.error}`).join(" "), code: "ANALYTICS_FAILED", results }, 502);
  return json({ message: `Retrieved ${ok.reduce((sum, result) => sum + result.count, 0)} provider history records across ${ok.length} channel${ok.length === 1 ? "" : "s"}.`, results });
}

async function api(request: Request, env: Env) {
  const url = new URL(request.url);
  if (url.pathname === "/api/health" && request.method === "GET") return json({ ok: true, service: "smart-marketing-content-studio", time: new Date().toISOString() });
  const forbidden = authorize(request, env);
  if (forbidden) return forbidden;
  try {
    if (url.pathname === "/api/integrations" && request.method === "GET") {
      const status = await integrationStatus(env);
      return json({ ...status, modelConfigured: Boolean(env.OPENAI_API_KEY), adminRestricted: Boolean(env.STUDIO_ADMIN_EMAIL) });
    }
    if (url.pathname === "/api/generate-batch" && request.method === "POST") return generateBatch(request, env);
    if (url.pathname === "/api/publish" && request.method === "POST") return publish(request, env);
    if (url.pathname === "/api/analytics" && request.method === "GET") return analytics(request, env);
    return json({ error: "API route not found." }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "The integration request failed.", code: "INTEGRATION_ERROR" }, 502);
  }
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return api(request, env);
    if (url.pathname === "/_vinext/image" && env.IMAGES) {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES!.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }
    return handler.fetch(request, env, ctx);
  },
};

export default worker;
