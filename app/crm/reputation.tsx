"use client";

import { useMemo, useState } from "react";
import type { CrmState } from "./types";
import { Badge, EmptyState, PageHeader } from "./ui";

export function ReputationView({ state, notify }: { state: CrmState; notify: (message: string, tone?: "info" | "error" | "success") => void }) {
  const [range, setRange] = useState("90");
  const [filterNow] = useState(() => Date.now());
  const reviews = useMemo(() => state.reviews.filter((item) => range === "all" || Date.parse(item.createdAt) >= filterNow - Number(range) * 86400000), [filterNow, range, state.reviews]);
  const realReviews = reviews.filter((item) => item.source !== "Preview");
  const average = realReviews.length ? realReviews.reduce((sum, item) => sum + item.rating, 0) / realReviews.length : 0;
  return <div className="crm-page"><PageHeader title="Reputation" description="Monitor reviews and create accountable review requests." actions={<button className="primary" onClick={() => notify("Connect a supported review provider in Settings before sending requests.", "info")}>Request review</button>} />
    <section className="crm-reputation-summary"><div><span>Average rating</span><strong>{average ? average.toFixed(1) : "--"}</strong><small>{realReviews.length ? `${realReviews.length} connected reviews` : "No connected reviews"}</small></div><div><span>Review requests</span><strong>0</strong><small>No request backend connected</small></div><label>Date range<select value={range} onChange={(event) => setRange(event.target.value)}><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All time</option></select></label></section>
    <section className="crm-section"><div className="crm-section-heading"><div><h2>Reviews</h2><p>Connection state and feedback history.</p></div><Badge tone="amber">Provider setup needed</Badge></div>{reviews.length ? <div className="crm-review-list">{reviews.map((review) => <article key={review.id}><span className="crm-rating">{"*".repeat(review.rating)}</span><h3>{review.customer}</h3><p>{review.body}</p><footer>{review.source} · {new Date(review.createdAt).toLocaleDateString()}</footer></article>)}</div> : <EmptyState title="No reviews in this range" body="Connected provider reviews will appear here." />}</section>
  </div>;
}
