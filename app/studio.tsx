"use client";

import { useMemo, useState } from "react";

type Post = {
  id: number;
  day: string;
  date: string;
  time: string;
  title: string;
  pillar: string;
  platform: string[];
  risk: "Green" | "Yellow" | "Red";
  status: "Approved" | "Needs review" | "Draft";
  asset: string;
};

const seedPosts: Post[] = [
  { id: 1, day: "MON", date: "13", time: "9:00 AM", title: "Keep your low first rate", pillar: "HELOC education", platform: ["f", "◎"], risk: "Green", status: "Approved", asset: "/assets/just-tap-in.png" },
  { id: 2, day: "TUE", date: "14", time: "10:30 AM", title: "DSCR: qualify with rental cash flow", pillar: "Investor loans", platform: ["in", "𝕏"], risk: "Yellow", status: "Needs review", asset: "/assets/dscr-cashout.png" },
  { id: 3, day: "WED", date: "15", time: "12:00 PM", title: "Five documents buyers should prepare", pillar: "First-time buyers", platform: ["f", "◎", "in"], risk: "Green", status: "Approved", asset: "/assets/apply-home.jpg" },
  { id: 4, day: "THU", date: "16", time: "8:15 AM", title: "Home-secured vs. personal loan", pillar: "Homeowner education", platform: ["f", "◎"], risk: "Yellow", status: "Needs review", asset: "/assets/personal-loan.png" },
  { id: 5, day: "FRI", date: "17", time: "11:00 AM", title: "Mortgage myth: perfect credit required", pillar: "Mortgage myths", platform: ["in", "𝕏"], risk: "Green", status: "Draft", asset: "/assets/headshot.jpeg" },
];

const channels = [
  { name: "Facebook", mark: "f", state: "Connected", color: "#2477f2" },
  { name: "Instagram", mark: "◎", state: "Connected", color: "#d94a8c" },
  { name: "LinkedIn", mark: "in", state: "Connected", color: "#1976b9" },
  { name: "X", mark: "𝕏", state: "Setup needed", color: "#111827" },
];

const assets = [
  ["/assets/just-tap-in.png", "HELOC — Just tap in", "Approved template"],
  ["/assets/personal-loan.png", "Home-secured alternative", "Approved template"],
  ["/assets/apply-home.jpg", "Apply from home", "Evergreen asset"],
  ["/assets/dscr-cashout.png", "DSCR cash-out", "Red — dated rate"],
];

export default function ContentStudio() {
  const [active, setActive] = useState("Overview");
  const [paused, setPaused] = useState(false);
  const [posts, setPosts] = useState(seedPosts);
  const [selected, setSelected] = useState<Post | null>(null);
  const [generating, setGenerating] = useState(false);
  const [toast, setToast] = useState("");

  const counts = useMemo(() => ({
    approved: posts.filter((p) => p.status === "Approved").length,
    review: posts.filter((p) => p.status === "Needs review").length,
    draft: posts.filter((p) => p.status === "Draft").length,
  }), [posts]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function generateBatch() {
    setGenerating(true);
    window.setTimeout(() => {
      setPosts((current) => current.map((post) => post.status === "Draft" ? { ...post, status: "Needs review" } : post));
      setGenerating(false);
      notify("Weekly batch prepared and routed for review.");
    }, 850);
  }

  function updatePost(id: number, status: Post["status"]) {
    setPosts((current) => current.map((post) => post.id === id ? { ...post, status } : post));
    setSelected((current) => current?.id === id ? { ...current, status } : current);
    notify(status === "Approved" ? "Post approved for scheduling." : "Post returned to drafts.");
  }

  const nav = ["Overview", "Calendar", "Content", "Approvals", "Assets", "Analytics", "Settings"];

  return (
    <main className="studio-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <img src="/assets/smart-marketing-logo.jpg" alt="Smart Marketing" />
          <div><strong>CONTENT</strong><span>STUDIO</span></div>
        </div>
        <nav aria-label="Content Studio">
          {nav.map((item) => <button key={item} className={active === item ? "active" : ""} onClick={() => setActive(item)}><span>{item === "Overview" ? "⌂" : item === "Calendar" ? "□" : item === "Approvals" ? "✓" : item === "Analytics" ? "↗" : "•"}</span>{item}{item === "Approvals" && counts.review > 0 ? <b>{counts.review}</b> : null}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-profile"><img src="/assets/headshot.jpeg" alt="Mykoal DeShazo"/><div><strong>Mykoal DeShazo</strong><span>Administrator</span></div></div>
          <p>Smart Marketing Co.<br/>Adaxa Home workspace</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p>SMART MARKETING / CONTENT STUDIO</p><h1>{active}</h1></div>
          <div className="top-actions">
            <button className={paused ? "pause on" : "pause"} onClick={() => { setPaused(!paused); notify(!paused ? "All publishing paused." : "Publishing resumed."); }}><i />{paused ? "Publishing paused" : "Pause all"}</button>
            <button className="primary" onClick={generateBatch} disabled={generating}>{generating ? "Building batch…" : "+ Generate weekly batch"}</button>
          </div>
        </header>

        {active === "Assets" ? (
          <AssetsView />
        ) : active === "Approvals" ? (
          <ApprovalsView posts={posts} open={setSelected} />
        ) : active === "Calendar" || active === "Content" ? (
          <CalendarView posts={posts} open={setSelected} title={active} />
        ) : active === "Analytics" ? (
          <AnalyticsView />
        ) : active === "Settings" ? (
          <SettingsView channels={channels} notify={notify} />
        ) : (
          <Overview posts={posts} counts={counts} open={setSelected} generate={generateBatch} />
        )}
      </section>

      {selected ? <PostDrawer post={selected} close={() => setSelected(null)} update={updatePost} /> : null}
      {toast ? <div className="toast">✓ {toast}</div> : null}
    </main>
  );
}

function Overview({ posts, counts, open, generate }: { posts: Post[]; counts: { approved: number; review: number; draft: number }; open: (p: Post) => void; generate: () => void }) {
  return <div className="page-content">
    <section className="welcome"><div><span>WEEK OF JULY 13–17</span><h2>Your content engine is ready.</h2><p>Five platform-adapted posts are planned. Review the two compliance-sensitive drafts before they enter the publishing queue.</p><div className="welcome-actions"><button onClick={generate}>Generate next batch</button><button className="ghost">View full calendar →</button></div></div><div className="score-ring"><strong>82</strong><span>Brand health</span></div></section>
    <div className="metrics">
      <Metric label="Scheduled this week" value={String(posts.length)} note="Across 4 channels" accent="cyan" />
      <Metric label="Awaiting approval" value={String(counts.review)} note="Requires your review" accent="lime" />
      <Metric label="Projected reach" value="12.8K" note="↑ 18% vs last week" accent="blue" />
      <Metric label="Attributed leads" value="14" note="6 from HELOC content" accent="gold" />
    </div>
    <div className="dashboard-grid">
      <section className="panel schedule-panel"><div className="panel-head"><div><span>UPCOMING</span><h3>This week’s publishing queue</h3></div><button>Open calendar</button></div>{posts.slice(0,4).map((post) => <PostRow key={post.id} post={post} open={open}/>)}</section>
      <aside className="right-stack">
        <section className="panel"><div className="panel-head"><div><span>CHANNELS</span><h3>Publishing network</h3></div></div><div className="channel-list">{channels.map((channel) => <div key={channel.name}><i style={{background: channel.color}}>{channel.mark}</i><span><strong>{channel.name}</strong><small>{channel.state}</small></span><b className={channel.state === "Connected" ? "dot ok" : "dot"}/></div>)}</div></section>
        <section className="panel compliance"><div className="panel-head"><div><span>COMPLIANCE</span><h3>Risk monitor</h3></div></div><div className="risk-bars"><div><span><i className="green"/>Green</span><b>3</b></div><div><span><i className="yellow"/>Yellow</span><b>2</b></div><div><span><i className="red"/>Red</span><b>0</b></div></div><p>Rate, payment, savings, qualification, and expiring claims always require verified source data and approval.</p></section>
      </aside>
    </div>
  </div>;
}

function Metric({ label, value, note, accent }: { label: string; value: string; note: string; accent: string }) { return <article className={`metric ${accent}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }

function PostRow({ post, open }: { post: Post; open: (p: Post) => void }) { return <button className="post-row" onClick={() => open(post)}><div className="date-tile"><span>{post.day}</span><b>{post.date}</b></div><img src={post.asset} alt=""/><div className="post-copy"><strong>{post.title}</strong><span>{post.time} · {post.pillar}</span></div><div className="platforms">{post.platform.map((p) => <i key={p}>{p}</i>)}</div><span className={`badge ${post.risk.toLowerCase()}`}>{post.risk}</span><span className={`status ${post.status.replace(" ", "-").toLowerCase()}`}>{post.status}</span><b className="arrow">›</b></button>; }

function CalendarView({ posts, open, title }: { posts: Post[]; open: (p: Post) => void; title: string }) { return <div className="page-content"><section className="section-heading"><div><span>WEEKLY PLAN</span><h2>{title === "Content" ? "All content" : "Content calendar"}</h2><p>One idea, adapted for each audience and platform.</p></div><div className="filter-pills"><button className="selected">This week</button><button>All platforms</button></div></section><section className="panel list-panel">{posts.map((post) => <PostRow key={post.id} post={post} open={open}/>)}</section></div>; }

function ApprovalsView({ posts, open }: { posts: Post[]; open: (p: Post) => void }) { const review = posts.filter((p) => p.status !== "Approved"); return <div className="page-content"><section className="section-heading"><div><span>HUMAN REVIEW</span><h2>Approval queue</h2><p>Yellow and red content cannot publish without an accountable human decision.</p></div></section><section className="panel list-panel">{review.length ? review.map((post) => <PostRow key={post.id} post={post} open={open}/>) : <div className="empty">Everything is approved. Nice work.</div>}</section></div>; }

function AssetsView() { return <div className="page-content"><section className="section-heading"><div><span>APPROVED LIBRARY</span><h2>Brand assets</h2><p>Locked templates preserve logos, disclosures, typography, and licensing information.</p></div><button className="primary">+ Upload asset</button></section><div className="asset-grid">{assets.map(([src,title,state]) => <article className="asset-card" key={src}><img src={src} alt={title}/><div><strong>{title}</strong><span>{state}</span></div><button>•••</button></article>)}</div></div>; }

function AnalyticsView() { return <div className="page-content"><section className="section-heading"><div><span>ATTRIBUTION</span><h2>Content performance</h2><p>Every click and lead is tied to a content ID, campaign ID, platform, UTM, and landing-page variant.</p></div></section><div className="metrics"><Metric label="Link clicks" value="642" note="↑ 22% this month" accent="cyan"/><Metric label="Leads" value="31" note="4.8% conversion" accent="lime"/><Metric label="Applications" value="9" note="29% of leads" accent="blue"/><Metric label="Top pillar" value="HELOC" note="42% of attributed leads" accent="gold"/></div><section className="panel chart"><div className="panel-head"><div><span>30-DAY TREND</span><h3>Attributed engagement</h3></div></div><div className="bars">{[36,48,43,62,54,76,68,88,72,96,84,110].map((h,i)=><i key={i} style={{height:h}}><span>{i%3===0?`${i+1}`:""}</span></i>)}</div></section></div>; }

function SettingsView({ channels, notify }: { channels: typeof channels; notify: (s: string) => void }) { return <div className="page-content"><section className="section-heading"><div><span>WORKSPACE</span><h2>Connections & controls</h2><p>Provider credentials are encrypted and kept outside the CRM.</p></div></section><section className="panel settings-list">{channels.map((c)=><div key={c.name}><i style={{background:c.color}}>{c.mark}</i><span><strong>{c.name}</strong><small>{c.state === "Connected" ? "OAuth connection healthy" : "Connect a professional account"}</small></span><button onClick={()=>notify(`${c.name} connection setup opened.`)}>{c.state === "Connected" ? "Manage" : "Connect"}</button></div>)}</section></div>; }

function PostDrawer({ post, close, update }: { post: Post; close: () => void; update: (id: number, status: Post["status"]) => void }) { return <div className="drawer-backdrop" onMouseDown={close}><aside className="drawer" onMouseDown={(e)=>e.stopPropagation()}><header><div><span>CONTENT #{String(post.id).padStart(4,"0")}</span><h2>{post.title}</h2></div><button onClick={close}>×</button></header><img className="drawer-art" src={post.asset} alt="Post creative"/><div className="drawer-meta"><span className={`badge ${post.risk.toLowerCase()}`}>{post.risk} compliance</span><span>{post.day}, JUL {post.date} · {post.time}</span></div><section><h3>Platform versions</h3><div className="caption"><b>Facebook</b><p>Home equity may give homeowners another way to access funds without replacing their existing first mortgage. Explore the options and understand the terms before deciding what fits.</p></div><div className="caption"><b>LinkedIn</b><p>A HELOC and a cash-out refinance solve different problems. The best structure depends on the existing first mortgage, equity position, intended use, and qualification profile.</p></div></section><section className="audit"><h3>Compliance record</h3><p><b>Source:</b> Adaxa approved HELOC knowledge article</p><p><b>Disclosure:</b> HELOC-EVG-2026.04</p><p><b>UTM:</b> utm_campaign=heloc_education&amp;utm_content=cs_{post.id}</p></section><footer><button className="ghost" onClick={()=>update(post.id,"Draft")}>Return to draft</button><button className="primary" onClick={()=>update(post.id,"Approved")}>Approve & schedule</button></footer></aside></div>; }
