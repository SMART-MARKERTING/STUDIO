import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function builtWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

const env = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};

const ctx = { waitUntil() {}, passThroughOnException() {} };

test("renders development preview metadata", async () => {
  const worker = await builtWorker();

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    env,
    ctx,
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, developmentPreviewMeta);
  assert.match(html, /SmartR8/);
  assert.match(html, /Mobile navigation/);
});

test("reports safe integration status when provider secrets are absent", async () => {
  const worker = await builtWorker();
  const response = await worker.fetch(new Request("http://localhost/api/integrations"), env, ctx);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.configured, false);
  assert.equal(body.modelConfigured, false);
  assert.equal(body.channels.facebook.connected, false);
  assert.equal(body.channels.gmb.connected, false);
  assert.equal(body.channels.tiktok.connected, false);
});

test("write endpoints fail safely when live credentials are absent", async () => {
  const worker = await builtWorker();
  const generate = await worker.fetch(new Request("http://localhost/api/generate-batch", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }), env, ctx);
  const publish = await worker.fetch(new Request("http://localhost/api/publish", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }), env, ctx);
  assert.equal(generate.status, 503);
  assert.equal((await generate.json()).code, "OPENAI_NOT_CONFIGURED");
  assert.equal(publish.status, 503);
  assert.equal((await publish.json()).code, "AYRSHARE_NOT_CONFIGURED");
});

test("optional administrator allowlist protects sensitive API routes", async () => {
  const worker = await builtWorker();
  const restrictedEnv = { ...env, STUDIO_ADMIN_EMAIL: "admin@example.com" };
  const denied = await worker.fetch(new Request("http://localhost/api/integrations"), restrictedEnv, ctx);
  const allowed = await worker.fetch(new Request("http://localhost/api/integrations", { headers: { "oai-authenticated-user-email": "Admin@Example.com" } }), restrictedEnv, ctx);
  assert.equal(denied.status, 403);
  assert.equal(allowed.status, 200);
});

test("live AI path accepts a strict seven-post response", { concurrency: false }, async () => {
  const worker = await builtWorker();
  const originalFetch = globalThis.fetch;
  const posts = Array.from({ length: 7 }, (_, index) => ({
    title: `Educational post ${index + 1}`,
    pillar: "Mortgage education",
    platforms: ["facebook"],
    risk: "Green",
    assetId: "asset-headshot",
    caption: "Clear, evergreen educational copy.",
    source: "Approved evergreen library",
    disclosure: "ADAXA-EVG-2026.07",
  }));
  globalThis.fetch = async (input) => {
    assert.equal(String(input), "https://api.openai.com/v1/responses");
    return Response.json({ output: [{ content: [{ text: JSON.stringify({ posts }) }] }] });
  };
  try {
    const response = await worker.fetch(new Request("http://localhost/api/generate-batch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assets: [] }) }), { ...env, OPENAI_API_KEY: "test-key" }, ctx);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).posts.length, 7);
  } finally { globalThis.fetch = originalFetch; }
});

test("live publishing path returns provider post IDs", { concurrency: false }, async () => {
  const worker = await builtWorker();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://api.ayrshare.com/api/post");
    const sent = JSON.parse(String(init?.body));
    assert.deepEqual(sent.platforms, ["facebook"]);
    assert.match(sent.post, /utm_content=cs-test/);
    assert.match(sent.post, /📍 Phoenix, Arizona/);
    assert.match(sent.post, /#ArizonaHomes/);
    assert.equal((sent.post.match(/#MortgageEducation/g) || []).length, 1);
    return Response.json({ postIds: [{ id: "provider-post-1", platform: "facebook" }] });
  };
  try {
    const response = await worker.fetch(new Request("http://localhost/api/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ post: { id: "cs-test", title: "Evergreen mortgage education", status: "Approved", platforms: ["facebook"], captions: { facebook: "Educational caption #MortgageEducation" }, hashtags: "MortgageEducation, #ArizonaHomes #MortgageEducation", location: "Phoenix, Arizona", landingPage: "https://smartr8.com/", campaignId: "test-campaign", scheduledAt: "2026-01-01T00:00:00.000Z" } }) }), { ...env, AYRSHARE_API_KEY: "test-key", AYRSHARE_PAID_PLAN: "true" }, ctx);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, "published");
    assert.deepEqual(body.providerPostIds, ["provider-post-1"]);
  } finally { globalThis.fetch = originalFetch; }
});

test("publishing blocks free-plan branding and placeholder captions", async () => {
  const worker = await builtWorker();
  const freePlan = await worker.fetch(new Request("http://localhost/api/publish", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }), { ...env, AYRSHARE_API_KEY: "test-key" }, ctx);
  assert.equal(freePlan.status, 402);
  assert.equal((await freePlan.json()).code, "FREE_PLAN_BRANDING_BLOCKED");
  const placeholder = await worker.fetch(new Request("http://localhost/api/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ post: { id: "cs-placeholder", title: "HELOC education", status: "Approved", platforms: ["instagram"], captions: { instagram: "Write the core message for this post." } } }) }), { ...env, AYRSHARE_API_KEY: "test-key", AYRSHARE_PAID_PLAN: "true" }, ctx);
  assert.equal(placeholder.status, 400);
  assert.equal((await placeholder.json()).code, "PLACEHOLDER_COPY");
});

test("location caption fallback can be explicitly disabled", { concurrency: false }, async () => {
  const worker = await builtWorker();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    const sent = JSON.parse(String(init?.body));
    assert.doesNotMatch(sent.post, /Phoenix, Arizona/);
    return Response.json({ postIds: [{ id: "provider-post-location", platform: "facebook" }] });
  };
  try {
    const response = await worker.fetch(new Request("http://localhost/api/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ post: { id: "cs-location", title: "Evergreen mortgage education", status: "Approved", platforms: ["facebook"], captions: { facebook: "Educational caption" }, hashtags: "", location: "Phoenix, Arizona", appendLocationToCaption: false, scheduledAt: "2026-01-01T00:00:00.000Z" } }) }), { ...env, AYRSHARE_API_KEY: "test-key", AYRSHARE_PAID_PLAN: "true" }, ctx);
    assert.equal(response.status, 200);
  } finally { globalThis.fetch = originalFetch; }
});
