"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  addAudit,
  createFallbackBatch,
  createInitialState,
  formatSchedule,
  localDateTimeValue,
  newBlankPost,
  normalizeGeneratedPosts,
  platformLabels,
  platformMarks,
  riskRequiresSource,
  type Channel,
  type Platform,
  type PostStatus,
  type StudioAsset,
  type StudioPost,
  type StudioState,
  type ViewName,
} from "./studio-data";

const STORAGE_KEY = "smart-marketing-content-studio-v2";
const nav: ViewName[] = ["Overview", "Calendar", "Content", "Approvals", "Assets", "Analytics", "Settings"];
const platforms = Object.keys(platformLabels) as Platform[];

type Notice = { message: string; tone: "success" | "error" | "info" };

export default function ContentStudio() {
  const [active, setActive] = useState<ViewName>("Overview");
  const [studio, setStudio] = useState<StudioState>(createInitialState);
  const [hydrated, setHydrated] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    let savedState: StudioState | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StudioState;
        if (parsed.version === 2 && Array.isArray(parsed.posts) && Array.isArray(parsed.assets)) savedState = parsed;
      }
    } catch { /* A damaged local copy should never stop the app. */ }
    const timer = window.setTimeout(() => {
      if (savedState) setStudio(savedState);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(studio)); }
    catch { console.warn("Content Studio local storage is full; export a backup and remove large uploaded assets."); }
  }, [hydrated, studio]);

  const selected = studio.posts.find((post) => post.id === selectedId) ?? null;
  const counts = useMemo(() => ({
    approved: studio.posts.filter((p) => p.status === "Approved").length,
    review: studio.posts.filter((p) => p.status === "Needs review").length,
    scheduled: studio.posts.filter((p) => p.status === "Scheduled").length,
    draft: studio.posts.filter((p) => p.status === "Draft").length,
  }), [studio.posts]);

  function notify(message: string, tone: Notice["tone"] = "success") {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setNotice({ message, tone });
    toastTimer.current = window.setTimeout(() => setNotice(null), 4300);
  }

  function updatePost(next: StudioPost, action = "Content updated") {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    setStudio((current) => ({
      ...current,
      posts: current.posts.map((post) => post.id === stamped.id ? stamped : post),
      audit: [addAudit(action, stamped.title), ...current.audit].slice(0, 100),
    }));
  }

  function createPost() {
    const post = newBlankPost(studio.assets);
    setStudio((current) => ({ ...current, posts: [post, ...current.posts], audit: [addAudit("Draft created", post.title), ...current.audit] }));
    setSelectedId(post.id);
    notify("New draft created. Add the message and review details before approval.", "info");
  }

  function deletePost(id: string) {
    const target = studio.posts.find((post) => post.id === id);
    if (!target || !window.confirm(`Delete “${target.title}”? This cannot be undone.`)) return;
    setStudio((current) => ({ ...current, posts: current.posts.filter((post) => post.id !== id), audit: [addAudit("Content deleted", target.title), ...current.audit] }));
    setSelectedId(null);
    notify("Content deleted.", "info");
  }

  function duplicatePost(post: StudioPost) {
    const copy = { ...post, id: `cs-copy-${Date.now()}`, title: `${post.title} — copy`, status: "Draft" as PostStatus, providerPostIds: [], lastError: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setStudio((current) => ({ ...current, posts: [copy, ...current.posts], audit: [addAudit("Content duplicated", post.title), ...current.audit] }));
    setSelectedId(copy.id);
    notify("Draft copy created.");
  }

  function approvePost(post: StudioPost) {
    if (!post.title.trim() || !post.platforms.length) return notify("Add a title and at least one platform before approval.", "error");
    if (post.platforms.some((p) => !post.captions[p].trim())) return notify("Every selected platform needs a caption.", "error");
    if (riskRequiresSource(post)) return notify("Yellow and red content requires both a verified source and a disclosure record.", "error");
    updatePost({ ...post, status: "Approved", lastError: "" }, "Content approved");
    notify("Approved. It is now eligible for publishing or scheduling.");
  }

  async function publishPost(post: StudioPost) {
    if (studio.paused) return notify("Publishing is paused. Resume the workspace first.", "error");
    if (post.status !== "Approved" && post.status !== "Scheduled") return notify("Approve this content before publishing.", "error");
    const asset = studio.assets.find((item) => item.id === post.assetId);
    if (asset && asset.approval !== "Approved") return notify("This creative is not approved. Choose or approve another asset.", "error");
    setPublishingId(post.id);
    try {
      if (asset?.source === "upload") return notify("This uploaded creative is stored only in your browser. Choose a bundled asset or no creative before sending it live.", "error");
      const assetUrl = asset ? new URL(asset.src, window.location.origin).toString() : undefined;
      const response = await fetch("/api/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ post, assetUrl }) });
      const result = await response.json() as { status?: "published" | "scheduled"; providerPostIds?: string[]; warnings?: string[]; error?: string };
      if (!response.ok) throw new Error(result.error || "The publishing provider rejected the request.");
      const status: PostStatus = result.status === "scheduled" ? "Scheduled" : "Published";
      updatePost({ ...post, status, providerPostIds: result.providerPostIds ?? [], lastError: result.warnings?.join(" ") ?? "" }, status === "Scheduled" ? "Content scheduled" : "Content published");
      notify(result.warnings?.length ? `${status}. Some channels need attention: ${result.warnings.join(" ")}` : status === "Scheduled" ? "Scheduled with the connected social provider." : "Published to the connected channels.", result.warnings?.length ? "info" : "success");
      setSelectedId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Publishing failed.";
      updatePost({ ...post, lastError: message }, "Publishing blocked");
      notify(message, "error");
    } finally { setPublishingId(null); }
  }

  async function generateBatch() {
    if (generating) return;
    setGenerating(true);
    try {
      const response = await fetch("/api/generate-batch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ existingCount: studio.posts.length, assets: studio.assets.map(({ id, title, category, approval }) => ({ id, title, category, approval })) }) });
      const result = await response.json() as { posts?: Array<Partial<StudioPost> & { caption?: string }>; error?: string; source?: string };
      if (!response.ok || !result.posts?.length) throw new Error(result.error || "AI generation is not configured.");
      const batch = normalizeGeneratedPosts(result.posts, studio.assets, studio.posts.length);
      setStudio((current) => ({ ...current, posts: [...batch, ...current.posts], audit: [addAudit("Weekly batch generated", `${batch.length} OpenAI-assisted drafts created`), ...current.audit] }));
      setActive("Approvals");
      notify(`${batch.length} AI-assisted drafts created and routed to review.`);
    } catch {
      const batch = createFallbackBatch(studio.posts.length);
      setStudio((current) => ({ ...current, posts: [...batch, ...current.posts], audit: [addAudit("Weekly batch generated", `${batch.length} approved-library drafts created without external AI`), ...current.audit] }));
      setActive("Approvals");
      notify("7 compliant library-based drafts created. Add OPENAI_API_KEY to enable live AI generation.", "info");
    } finally { setGenerating(false); }
  }

  function togglePause() {
    const paused = !studio.paused;
    setStudio((current) => ({ ...current, paused, audit: [addAudit(paused ? "Publishing paused" : "Publishing resumed", "Workspace-wide control changed by administrator"), ...current.audit] }));
    notify(paused ? "All outbound publishing is paused." : "Publishing resumed.", paused ? "info" : "success");
  }

  function updateChannels(channels: Channel[]) {
    setStudio((current) => ({ ...current, channels, audit: [addAudit("Connections refreshed", `${channels.filter((c) => c.connected).length} channels connected`), ...current.audit] }));
  }

  return (
    <main className="studio-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><img src="/assets/smart-marketing-logo.jpg" alt="Smart Marketing"/><div><strong>CONTENT</strong><span>STUDIO</span></div></div>
        <nav aria-label="Content Studio">
          {nav.map((item) => <button key={item} className={active === item ? "active" : ""} onClick={() => setActive(item)}><span>{navIcon(item)}</span>{item}{item === "Approvals" && counts.review > 0 ? <b>{counts.review}</b> : null}</button>)}
        </nav>
        <div className="sidebar-bottom"><div className="mini-profile"><img src="/assets/headshot.jpeg" alt="Mykoal DeShazo"/><div><strong>Mykoal DeShazo</strong><span>Administrator</span></div></div><p>Smart Marketing Co.<br/>Adaxa Home workspace</p></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p>SMART MARKETING / CONTENT STUDIO</p><h1>{active}</h1></div>
          <div className="top-actions"><button className={studio.paused ? "pause on" : "pause"} onClick={togglePause}><i/>{studio.paused ? "Publishing paused" : "Pause all"}</button><button className="primary" onClick={generateBatch} disabled={generating}>{generating ? "Building batch…" : "+ Generate weekly batch"}</button></div>
        </header>
        {active === "Assets" ? <AssetsView studio={studio} setStudio={setStudio} notify={notify}/>
          : active === "Approvals" ? <ApprovalsView posts={studio.posts} open={setSelectedId} approve={approvePost} notify={notify}/>
          : active === "Calendar" || active === "Content" ? <ContentView posts={studio.posts} assets={studio.assets} open={setSelectedId} title={active} create={createPost}/>
          : active === "Analytics" ? <AnalyticsView posts={studio.posts} setStudio={setStudio} notify={notify}/>
          : active === "Settings" ? <SettingsView studio={studio} updateChannels={updateChannels} setStudio={setStudio} notify={notify}/>
          : <Overview studio={studio} counts={counts} open={setSelectedId} navigate={setActive} generate={generateBatch}/>
        }
      </section>
      {selected ? <PostDrawer key={selected.id} post={selected} assets={studio.assets} paused={studio.paused} publishing={publishingId === selected.id} close={() => setSelectedId(null)} save={updatePost} approve={approvePost} publish={publishPost} duplicate={duplicatePost} remove={deletePost}/> : null}
      {notice ? <div className={`toast ${notice.tone}`}>{notice.tone === "error" ? "!" : notice.tone === "info" ? "i" : "✓"} {notice.message}</div> : null}
    </main>
  );
}

function navIcon(item: ViewName) { return ({ Overview: "⌂", Calendar: "□", Content: "✎", Approvals: "✓", Assets: "◈", Analytics: "↗", Settings: "⚙" } as Record<ViewName, string>)[item]; }

function Overview({ studio, counts, open, navigate, generate }: { studio: StudioState; counts: { approved: number; review: number; scheduled: number; draft: number }; open: (id: string) => void; navigate: (v: ViewName) => void; generate: () => void }) {
  const impressions = studio.posts.reduce((sum, post) => sum + post.metrics.impressions, 0);
  const leads = studio.posts.reduce((sum, post) => sum + post.metrics.leads, 0);
  const green = studio.posts.filter((p) => p.risk === "Green").length;
  const health = Math.max(65, Math.min(99, 78 + counts.approved + counts.scheduled - counts.review * 2));
  return <div className="page-content">
    <section className="welcome"><div><span>LIVE WORKSPACE</span><h2>Your content engine is ready.</h2><p>{studio.paused ? "Outbound publishing is paused. Drafting, review, and approvals remain available." : `${counts.review} item${counts.review === 1 ? "" : "s"} need review. Approved content can be sent to connected channels when provider credentials are configured.`}</p><div className="welcome-actions"><button onClick={generate}>Generate next batch</button><button className="ghost" onClick={() => navigate("Calendar")}>View full calendar →</button></div></div><div className="score-ring"><strong>{health}</strong><span>Workflow health</span></div></section>
    <div className="metrics"><Metric label="Scheduled" value={String(counts.scheduled)} note={`${studio.posts.length} total content items`} accent="cyan"/><Metric label="Awaiting approval" value={String(counts.review)} note={`${counts.draft} drafts in progress`} accent="lime"/><Metric label="Recorded impressions" value={compact(impressions)} note="Synced + local metrics" accent="blue"/><Metric label="Attributed leads" value={String(leads)} note="Across active content" accent="gold"/></div>
    <div className="dashboard-grid">
      <section className="panel schedule-panel"><div className="panel-head"><div><span>UPCOMING</span><h3>Publishing queue</h3></div><button onClick={() => navigate("Calendar")}>Open calendar</button></div>{studio.posts.slice().sort((a,b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt)).slice(0,5).map((post) => <PostRow key={post.id} post={post} asset={studio.assets.find((a) => a.id === post.assetId)} open={open}/>)}</section>
      <aside className="right-stack"><section className="panel"><div className="panel-head"><div><span>CHANNELS</span><h3>Publishing network</h3></div><button onClick={() => navigate("Settings")}>Manage</button></div><div className="channel-list">{studio.channels.map((channel) => <div key={channel.id}><i style={{background: channel.color}}>{channel.mark}</i><span><strong>{channel.name}</strong><small>{channel.connected ? channel.handle || "Connected" : "Setup needed"}</small></span><b className={channel.connected ? "dot ok" : "dot"}/></div>)}</div></section><section className="panel compliance"><div className="panel-head"><div><span>COMPLIANCE</span><h3>Risk monitor</h3></div></div><div className="risk-bars"><div><span><i className="green"/>Green</span><b>{green}</b></div><div><span><i className="yellow"/>Yellow</span><b>{studio.posts.filter((p)=>p.risk === "Yellow").length}</b></div><div><span><i className="red"/>Red</span><b>{studio.posts.filter((p)=>p.risk === "Red").length}</b></div></div><p>Rate, payment, savings, qualification, and expiring claims require verified source data and accountable approval.</p></section></aside>
    </div>
  </div>;
}

function Metric({ label, value, note, accent }: { label: string; value: string; note: string; accent: string }) { return <article className={`metric ${accent}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }

function PostRow({ post, asset, open }: { post: StudioPost; asset?: StudioAsset; open: (id: string) => void }) {
  const schedule = formatSchedule(post.scheduledAt);
  return <button className="post-row" onClick={() => open(post.id)}><div className="date-tile"><span>{schedule.day}</span><b>{schedule.date}</b></div><img src={asset?.src || "/assets/smart-marketing-logo.jpg"} alt=""/><div className="post-copy"><strong>{post.title}</strong><span>{schedule.time} · {post.pillar}</span>{post.lastError ? <em>{post.lastError}</em> : null}</div><div className="platforms">{post.platforms.map((p) => <i key={p} title={platformLabels[p]}>{platformMarks[p]}</i>)}</div><span className={`badge ${post.risk.toLowerCase()}`}>{post.risk}</span><span className={`status ${post.status.replaceAll(" ", "-").toLowerCase()}`}>{post.status}</span><b className="arrow">›</b></button>;
}

function ContentView({ posts, assets, open, title, create }: { posts: StudioPost[]; assets: StudioAsset[]; open: (id: string) => void; title: "Calendar" | "Content"; create: () => void }) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<"all" | Platform>("all");
  const [status, setStatus] = useState<"all" | PostStatus>("all");
  const filtered = posts.filter((post) => (!query || `${post.title} ${post.pillar}`.toLowerCase().includes(query.toLowerCase())) && (platform === "all" || post.platforms.includes(platform)) && (status === "all" || post.status === status)).sort((a,b) => title === "Calendar" ? +new Date(a.scheduledAt) - +new Date(b.scheduledAt) : +new Date(b.updatedAt) - +new Date(a.updatedAt));
  return <div className="page-content"><section className="section-heading"><div><span>{title === "Calendar" ? "PUBLISHING PLAN" : "CONTENT LIBRARY"}</span><h2>{title === "Content" ? "All content" : "Content calendar"}</h2><p>Search, filter, edit, and schedule each platform-ready version.</p></div><button className="primary" onClick={create}>+ New post</button></section><div className="filter-bar"><input aria-label="Search content" placeholder="Search title or pillar…" value={query} onChange={(e)=>setQuery(e.target.value)}/><select aria-label="Filter by platform" value={platform} onChange={(e)=>setPlatform(e.target.value as "all"|Platform)}><option value="all">All platforms</option>{platforms.map((p)=><option key={p} value={p}>{platformLabels[p]}</option>)}</select><select aria-label="Filter by status" value={status} onChange={(e)=>setStatus(e.target.value as "all"|PostStatus)}><option value="all">All statuses</option>{(["Draft","Needs review","Approved","Scheduled","Published","Failed"] as PostStatus[]).map((s)=><option key={s}>{s}</option>)}</select><span>{filtered.length} shown</span></div><section className="panel list-panel">{filtered.length ? filtered.map((post) => <PostRow key={post.id} post={post} asset={assets.find((a)=>a.id === post.assetId)} open={open}/>) : <div className="empty">No content matches these filters.</div>}</section></div>;
}

function ApprovalsView({ posts, open, approve, notify }: { posts: StudioPost[]; open: (id: string) => void; approve: (post: StudioPost) => void; notify: (m: string, t?: Notice["tone"]) => void }) {
  const review = posts.filter((p) => p.status === "Needs review");
  function bulkApprove() {
    const green = review.filter((p) => p.risk === "Green" && p.title.trim() && p.platforms.every((platform) => p.captions[platform].trim()));
    if (!green.length) return notify("No eligible Green items are waiting for approval.", "info");
    green.forEach(approve);
    notify(`${green.length} Green item${green.length === 1 ? "" : "s"} approved. Yellow and red items still require individual review.`);
  }
  return <div className="page-content"><section className="section-heading"><div><span>HUMAN REVIEW</span><h2>Approval queue</h2><p>Open each item to review platform copy, sources, disclosures, creative, and timing.</p></div><button onClick={bulkApprove}>Approve eligible Green</button></section><section className="panel approval-list">{review.length ? review.map((post)=><article className="approval-card" key={post.id}><div><span className={`badge ${post.risk.toLowerCase()}`}>{post.risk}</span><h3>{post.title}</h3><p>{post.pillar} · {post.platforms.map((p)=>platformLabels[p]).join(", ")}</p></div><div className="approval-actions"><button onClick={()=>open(post.id)}>Review details</button>{post.risk === "Green" ? <button className="primary" onClick={()=>approve(post)}>Approve</button> : null}</div></article>) : <div className="empty">Everything in the review queue has a decision.</div>}</section></div>;
}

function AssetsView({ studio, setStudio, notify }: { studio: StudioState; setStudio: React.Dispatch<React.SetStateAction<StudioState>>; notify: (m:string,t?:Notice["tone"])=>void }) {
  const input = useRef<HTMLInputElement>(null);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return notify("Choose a PNG, JPG, or WebP image.", "error");
    try {
      const src = await compressImage(file);
      const asset: StudioAsset = { id: `asset-upload-${Date.now()}`, src, title: file.name.replace(/\.[^.]+$/, ""), category: "Other", approval: "Review required", source: "upload", createdAt: new Date().toISOString() };
      setStudio((current)=>({ ...current, assets: [asset, ...current.assets], audit: [addAudit("Asset uploaded", asset.title), ...current.audit] }));
      notify("Asset uploaded locally and routed for approval.");
    } catch (error) { notify(error instanceof Error ? error.message : "Upload failed.", "error"); }
  }
  function change(asset: StudioAsset, values: Partial<StudioAsset>) { setStudio((current)=>({ ...current, assets: current.assets.map((a)=>a.id === asset.id ? {...a,...values}:a), audit: values.approval ? [addAudit("Asset approval changed",`${asset.title}: ${values.approval}`),...current.audit] : current.audit })); }
  function remove(asset: StudioAsset) {
    if (asset.source === "bundled") return notify("Bundled compliance assets are locked. Change their approval state instead.", "info");
    if (!window.confirm(`Delete “${asset.title}”?`)) return;
    setStudio((current)=>({ ...current, assets: current.assets.filter((a)=>a.id !== asset.id), posts: current.posts.map((p)=>p.assetId === asset.id ? {...p,assetId:""}:p), audit:[addAudit("Asset deleted",asset.title),...current.audit] }));
    notify("Asset deleted.", "info");
  }
  function download(asset: StudioAsset) { const a=document.createElement("a"); a.href=asset.src; a.download=`${asset.title.replace(/[^a-z0-9]+/gi,"-").toLowerCase()}.jpg`; a.click(); }
  return <div className="page-content"><section className="section-heading"><div><span>CREATIVE LIBRARY</span><h2>Brand assets</h2><p>Uploaded files remain in this browser until a shared media provider is configured.</p></div><button className="primary" onClick={()=>input.current?.click()}>+ Upload asset</button><input ref={input} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={upload}/></section><div className="asset-grid">{studio.assets.map((asset)=><article className="asset-card" key={asset.id}><img src={asset.src} alt={asset.title}/><div><input value={asset.title} aria-label="Asset title" onChange={(e)=>change(asset,{title:e.target.value})}/><div className="asset-controls"><select aria-label="Asset category" value={asset.category} onChange={(e)=>change(asset,{category:e.target.value as StudioAsset["category"]})}>{["HELOC","DSCR","Brand","Headshot","Other"].map((c)=><option key={c}>{c}</option>)}</select><select aria-label="Asset approval" value={asset.approval} onChange={(e)=>change(asset,{approval:e.target.value as StudioAsset["approval"]})}><option>Approved</option><option>Review required</option><option>Expired</option></select></div><small>{asset.source === "bundled" ? "Locked campaign asset" : "Saved in this browser"}</small><div className="card-actions"><button onClick={()=>download(asset)}>Download</button><button onClick={()=>remove(asset)}>Delete</button></div></div></article>)}</div></div>;
}

function AnalyticsView({ posts, setStudio, notify }: { posts: StudioPost[]; setStudio:React.Dispatch<React.SetStateAction<StudioState>>; notify:(m:string,t?:Notice["tone"])=>void }) {
  const [platform, setPlatform] = useState<"all"|Platform>("all");
  const [syncing,setSyncing]=useState(false);
  const filtered = posts.filter((p)=>platform === "all" || p.platforms.includes(platform));
  const totals = filtered.reduce((a,p)=>({ impressions:a.impressions+p.metrics.impressions,clicks:a.clicks+p.metrics.clicks,leads:a.leads+p.metrics.leads,applications:a.applications+p.metrics.applications }),{impressions:0,clicks:0,leads:0,applications:0});
  const top = [...filtered].sort((a,b)=>b.metrics.leads-a.metrics.leads || b.metrics.clicks-a.metrics.clicks).slice(0,8);
  function exportCsv(){ const rows=[["content_id","title","status","platforms","impressions","clicks","leads","applications"],...filtered.map((p)=>[p.id,p.title,p.status,p.platforms.join("|"),p.metrics.impressions,p.metrics.clicks,p.metrics.leads,p.metrics.applications])]; const csv=rows.map((r)=>r.map((v)=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n"); const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="content-studio-analytics.csv";a.click();URL.revokeObjectURL(a.href);notify("Analytics CSV exported."); }
  async function sync(){setSyncing(true);try{const response=await fetch(`/api/analytics${platform === "all"?"":`?platform=${platform}`}`);const result=await response.json() as {error?:string;message?:string;results?:Array<{data?:unknown}>};if(!response.ok)throw new Error(result.error||"Analytics sync failed.");const records=(result.results||[]).flatMap((entry)=>Array.isArray(entry.data)?entry.data:[]).filter((entry):entry is Record<string,unknown>=>Boolean(entry)&&typeof entry==="object");const updates=new Map<string,StudioPost["metrics"]>();for(const post of posts){const related=records.filter((record)=>post.providerPostIds.includes(providerRecordId(record)));if(!related.length)continue;updates.set(post.id,related.reduce<StudioPost["metrics"]>((total,record)=>{const metrics=providerMetrics(record);return {impressions:total.impressions+metrics.impressions,clicks:total.clicks+metrics.clicks,leads:total.leads+metrics.leads,applications:total.applications+metrics.applications};},{impressions:0,clicks:0,leads:0,applications:0}));}setStudio((current)=>({...current,posts:current.posts.map((post)=>updates.has(post.id)?{...post,metrics:updates.get(post.id)!,updatedAt:new Date().toISOString()}:post),audit:[addAudit("Analytics synchronized",`${records.length} provider records retrieved`),...current.audit]}));const matched=updates.size;notify(matched?`${result.message||"Provider analytics received"} ${matched} local content item${matched===1?"":"s"} updated.`:`${result.message||"Provider analytics received"} No returned post IDs matched this browser's published content.`,matched?"success":"info");}catch(error){notify(error instanceof Error?error.message:"Analytics sync failed.","error");}finally{setSyncing(false);}}
  const max=Math.max(1,...top.map((p)=>p.metrics.clicks));
  return <div className="page-content"><section className="section-heading"><div><span>ATTRIBUTION</span><h2>Content performance</h2><p>Local content IDs, campaign IDs, platform versions, and recorded outcomes.</p></div><div className="button-row"><select value={platform} onChange={(e)=>setPlatform(e.target.value as "all"|Platform)}><option value="all">All platforms</option>{platforms.map((p)=><option key={p} value={p}>{platformLabels[p]}</option>)}</select><button onClick={sync} disabled={syncing}>{syncing?"Syncing…":"Sync provider"}</button><button className="primary" onClick={exportCsv}>Export CSV</button></div></section><div className="metrics"><Metric label="Impressions" value={compact(totals.impressions)} note={`${filtered.length} content items`} accent="cyan"/><Metric label="Link clicks" value={compact(totals.clicks)} note={`${totals.impressions?((totals.clicks/totals.impressions)*100).toFixed(1):"0.0"}% recorded CTR`} accent="lime"/><Metric label="Leads" value={String(totals.leads)} note={`${totals.clicks?((totals.leads/totals.clicks)*100).toFixed(1):"0.0"}% click-to-lead`} accent="blue"/><Metric label="Applications" value={String(totals.applications)} note={`${totals.leads?Math.round(totals.applications/totals.leads*100):0}% of leads`} accent="gold"/></div><section className="panel chart"><div className="panel-head"><div><span>CONTENT COMPARISON</span><h3>Recorded clicks by post</h3></div></div><div className="bars">{top.length?top.map((p)=><i key={p.id} style={{height:`${Math.max(6,Math.round(p.metrics.clicks/max*150))}px`}} title={`${p.title}: ${p.metrics.clicks} clicks`}><span>{p.title.slice(0,8)}</span></i>):<div className="empty">No performance data yet.</div>}</div></section></div>;
}

function SettingsView({ studio, updateChannels, setStudio, notify }: { studio: StudioState; updateChannels:(c:Channel[])=>void; setStudio:React.Dispatch<React.SetStateAction<StudioState>>; notify:(m:string,t?:Notice["tone"])=>void }) {
  const [checking,setChecking]=useState(false);
  const [provider,setProvider]=useState({configured:false,ai:false,restricted:false});
  async function refresh(){setChecking(true);try{const response=await fetch("/api/integrations");const result=await response.json() as {configured?:boolean;modelConfigured?:boolean;adminRestricted?:boolean;channels?:Partial<Record<Platform,{connected:boolean;handle?:string}>>;error?:string};if(!response.ok)throw new Error(result.error||"Unable to check integrations.");const now=new Date().toISOString();updateChannels(studio.channels.map((channel)=>({...channel,connected:Boolean(result.channels?.[channel.id]?.connected),handle:result.channels?.[channel.id]?.handle||"",lastChecked:now})));setProvider({configured:Boolean(result.configured),ai:Boolean(result.modelConfigured),restricted:Boolean(result.adminRestricted)});notify(result.configured?"Connection status refreshed from Ayrshare.":"Ayrshare is not configured yet; no channels were marked connected.",result.configured?"success":"info");}catch(error){notify(error instanceof Error?error.message:"Connection check failed.","error");}finally{setChecking(false);}}
  function openProvider(){window.open("https://app.ayrshare.com/social-accounts","_blank","noopener,noreferrer");notify("Ayrshare social account setup opened in a new tab.","info");}
  function exportWorkspace(){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(studio,null,2)],{type:"application/json"}));a.download=`content-studio-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);notify("Workspace backup exported.");}
  function reset(){if(!window.confirm("Reset posts, assets, approvals, and local connection status to the starter workspace?"))return;window.localStorage.removeItem(STORAGE_KEY);setStudio(createInitialState());notify("Workspace reset to the starter data.","info");}
  return <div className="page-content"><section className="section-heading"><div><span>WORKSPACE</span><h2>Connections & controls</h2><p>Secrets remain server-side. Connection badges only turn green after provider verification.</p></div><button onClick={refresh} disabled={checking}>{checking?"Checking…":"Refresh status"}</button></section><section className="panel settings-list">{studio.channels.map((c)=><div key={c.id}><i style={{background:c.color}}>{c.mark}</i><span><strong>{c.name}</strong><small>{c.connected?`${c.handle||"Professional account"} · verified ${c.lastChecked?new Date(c.lastChecked).toLocaleString():"now"}`:"Not connected"}</small></span><b className={c.connected?"connection-state connected":"connection-state"}>{c.connected?"Connected":"Setup needed"}</b><button onClick={openProvider}>{c.connected?"Manage":"Connect"}</button></div>)}</section><div className="settings-grid"><section className="panel settings-card"><span>SERVER CAPABILITIES</span><h3>Live services</h3><p><b>Social publishing:</b> {provider.configured?"Configured":"Check status or add AYRSHARE_API_KEY"}</p><p><b>AI generation:</b> {provider.ai?"Configured":"Uses compliant local fallback until OPENAI_API_KEY is added"}</p><p><b>Admin restriction:</b> {provider.restricted?"Enabled":"Optional STUDIO_ADMIN_EMAIL is not set"}</p><button onClick={refresh}>Test services</button></section><section className="panel settings-card"><span>PORTABILITY</span><h3>Workspace data</h3><p>Posts, approvals, uploads, and audit events persist in this browser. Export a portable JSON backup at any time.</p><div className="button-row"><button onClick={exportWorkspace}>Export backup</button><button className="danger" onClick={reset}>Reset workspace</button></div></section></div><section className="panel audit-log"><div className="panel-head"><div><span>AUDIT TRAIL</span><h3>Recent workspace actions</h3></div></div>{studio.audit.slice(0,12).map((event)=><div key={event.id}><time>{new Date(event.at).toLocaleString()}</time><strong>{event.action}</strong><span>{event.detail}</span></div>)}</section></div>;
}

function PostDrawer({ post, assets, paused, publishing, close, save, approve, publish, duplicate, remove }: { post:StudioPost;assets:StudioAsset[];paused:boolean;publishing:boolean;close:()=>void;save:(p:StudioPost,a?:string)=>void;approve:(p:StudioPost)=>void;publish:(p:StudioPost)=>void;duplicate:(p:StudioPost)=>void;remove:(id:string)=>void }) {
  const [draft,setDraft]=useState(post);
  const selectedAsset=assets.find((a)=>a.id===draft.assetId);
  function change<K extends keyof StudioPost>(key:K,value:StudioPost[K]){setDraft((current)=>({...current,[key]:value}));}
  function togglePlatform(platform:Platform){const enabled=draft.platforms.includes(platform);change("platforms",enabled?draft.platforms.filter((p)=>p!==platform):[...draft.platforms,platform]);}
  function store(){save(draft,"Draft saved");}
  function approveDraft(){approve(draft);if(draft.title.trim()&&draft.platforms.length&&draft.platforms.every((platform)=>draft.captions[platform].trim())&&!riskRequiresSource(draft))setDraft((current)=>({...current,status:"Approved",lastError:""}));}
  return <div className="drawer-backdrop" onMouseDown={close}><aside className="drawer" onMouseDown={(e)=>e.stopPropagation()}><header><div><span>CONTENT {draft.id}</span><h2>{draft.title||"Untitled content"}</h2></div><button onClick={close} aria-label="Close">×</button></header><img className="drawer-art" src={selectedAsset?.src||"/assets/smart-marketing-logo.jpg"} alt="Selected creative"/><div className="drawer-meta"><span className={`badge ${draft.risk.toLowerCase()}`}>{draft.risk} compliance</span><span>{draft.status} · {formatSchedule(draft.scheduledAt).time}</span></div><section className="form-section"><h3>Plan</h3><label>Title<input value={draft.title} onChange={(e)=>change("title",e.target.value)}/></label><div className="form-grid"><label>Pillar<input value={draft.pillar} onChange={(e)=>change("pillar",e.target.value)}/></label><label>Risk<select value={draft.risk} onChange={(e)=>change("risk",e.target.value as StudioPost["risk"])}><option>Green</option><option>Yellow</option><option>Red</option></select></label><label>Schedule<input type="datetime-local" value={localDateTimeValue(draft.scheduledAt)} onChange={(e)=>change("scheduledAt",new Date(e.target.value).toISOString())}/></label><label>Creative<select value={draft.assetId} onChange={(e)=>change("assetId",e.target.value)}><option value="">No creative</option>{assets.map((asset)=><option key={asset.id} value={asset.id}>{asset.title} · {asset.approval}</option>)}</select></label></div><div className="platform-toggles">{platforms.map((platform)=><label key={platform} className={draft.platforms.includes(platform)?"selected":""}><input type="checkbox" checked={draft.platforms.includes(platform)} onChange={()=>togglePlatform(platform)}/>{platformMarks[platform]} {platformLabels[platform]}</label>)}</div></section><section className="form-section"><h3>Platform versions</h3>{draft.platforms.map((platform)=><label key={platform}>{platformLabels[platform]} caption<textarea rows={4} value={draft.captions[platform]} onChange={(e)=>change("captions",{...draft.captions,[platform]:e.target.value})}/><small>{draft.captions[platform].length} characters</small></label>)}</section><section className="form-section"><h3>Compliance & tracking</h3>{riskRequiresSource(draft)?<p className="validation">Source and disclosure are required before this {draft.risk} item can be approved.</p>:null}<label>Verified source<input placeholder="Article, guideline, or campaign source" value={draft.source} onChange={(e)=>change("source",e.target.value)}/></label><label>Disclosure record<input value={draft.disclosure} onChange={(e)=>change("disclosure",e.target.value)}/></label><label>Landing page<input type="url" value={draft.landingPage} onChange={(e)=>change("landingPage",e.target.value)}/></label><label>Campaign ID<input value={draft.campaignId} onChange={(e)=>change("campaignId",e.target.value)}/></label><label>Reviewer notes<textarea rows={3} value={draft.notes} onChange={(e)=>change("notes",e.target.value)}/></label>{draft.lastError?<p className="validation"><b>Last publishing attempt:</b> {draft.lastError}</p>:null}</section><footer className="drawer-footer"><div><button className="danger-link" onClick={()=>remove(draft.id)}>Delete</button><button onClick={()=>duplicate(draft)}>Duplicate</button></div><div><button onClick={()=>{change("status","Draft");save({...draft,status:"Draft"},"Returned to draft");}}>Return to draft</button><button onClick={store}>Save</button><button className="approve-button" onClick={approveDraft}>Approve</button><button className="primary" disabled={publishing||paused||!(["Approved","Scheduled"] as PostStatus[]).includes(draft.status)} onClick={()=>publish(draft)}>{publishing?"Sending…":new Date(draft.scheduledAt)>new Date()?"Schedule":"Publish now"}</button></div></footer></aside></div>;
}

function compact(value:number){return new Intl.NumberFormat("en-US",{notation:value>=1000?"compact":"standard",maximumFractionDigits:1}).format(value);}

function providerRecordId(record:Record<string,unknown>){return String(record.id||record.postId||record.refId||"");}
function providerMetrics(record:Record<string,unknown>){const nested=(record.analytics&&typeof record.analytics==="object"?record.analytics:record.metrics&&typeof record.metrics==="object"?record.metrics:{}) as Record<string,unknown>;const number=(...values:unknown[])=>{const found=values.find((value)=>Number.isFinite(Number(value)));return found===undefined?0:Number(found);};return {impressions:number(record.impressions,record.views,record.viewCount,nested.impressions,nested.views,nested.viewCount),clicks:number(record.clicks,record.linkClicks,nested.clicks,nested.linkClicks),leads:number(record.leads,nested.leads),applications:number(record.applications,nested.applications)};}

function compressImage(file:File):Promise<string>{
  if(file.size>12*1024*1024)return Promise.reject(new Error("Images must be smaller than 12 MB."));
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error("The image could not be read."));reader.onload=()=>{const image=new Image();image.onerror=()=>reject(new Error("The image format is not supported."));image.onload=()=>{const scale=Math.min(1,1200/Math.max(image.width,image.height));const canvas=document.createElement("canvas");canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);const context=canvas.getContext("2d");if(!context)return reject(new Error("Image processing is unavailable."));context.drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL("image/jpeg",.78));};image.src=String(reader.result);};reader.readAsDataURL(file);});
}
