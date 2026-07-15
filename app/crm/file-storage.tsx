"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { formatBytes, newId } from "./data";
import type { CrmFile, CrmState } from "./types";
import { EmptyState, Modal, PageHeader } from "./ui";

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function FileStorageView({ state, setState, notify }: { state: CrmState; setState: (updater: (current: CrmState) => CrmState) => void; notify: (message: string, tone?: "info" | "error" | "success") => void }) {
  const [folder, setFolder] = useState("All files");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [preview, setPreview] = useState<CrmFile | null>(null);

  const files = useMemo(() => state.files.filter((file) => (folder === "All files" || file.folder === folder) && file.name.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "size" ? b.size - a.size : Date.parse(b.createdAt) - Date.parse(a.createdAt)), [folder, search, sort, state.files]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;
    if (selected.some((file) => file.size > 2 * 1024 * 1024)) {
      notify("Browser-local uploads are limited to 2 MB per file. Connect object storage for larger files.", "error");
      event.target.value = "";
      return;
    }
    try {
      const uploaded = await Promise.all(selected.map(async (file): Promise<CrmFile> => ({ id: newId("file"), name: file.name, folder: folder === "All files" ? "General" : folder, type: file.type || "application/octet-stream", size: file.size, createdAt: new Date().toISOString(), dataUrl: await readFile(file) })));
      setState((current) => ({ ...current, files: [...uploaded, ...current.files] }));
      notify(`${uploaded.length} file${uploaded.length === 1 ? "" : "s"} stored in this browser.`, "info");
    } catch { notify("The selected file could not be read.", "error"); }
    event.target.value = "";
  }

  function addFolder() {
    const name = window.prompt("Folder name")?.trim();
    if (!name || state.folders.some((item) => item.toLowerCase() === name.toLowerCase())) return;
    setState((current) => ({ ...current, folders: [...current.folders, name] }));
    setFolder(name);
  }

  function rename(file: CrmFile) {
    const name = window.prompt("Rename file", file.name)?.trim();
    if (!name) return;
    setState((current) => ({ ...current, files: current.files.map((item) => item.id === file.id ? { ...item, name } : item) }));
  }

  function move(file: CrmFile) {
    const destination = window.prompt(`Move to folder: ${state.folders.join(", ")}`, file.folder)?.trim();
    if (!destination || !state.folders.includes(destination)) return notify("Choose an existing folder.", "error");
    setState((current) => ({ ...current, files: current.files.map((item) => item.id === file.id ? { ...item, folder: destination } : item) }));
  }

  function remove(file: CrmFile) {
    setState((current) => ({ ...current, files: current.files.filter((item) => item.id !== file.id) }));
    if (preview?.id === file.id) setPreview(null);
  }

  return <div className="crm-page">
    <PageHeader title="File Storage" description="Organize workspace files in searchable folders." actions={<><button onClick={addFolder}>+ Folder</button><label className="crm-upload-button primary">Upload<input type="file" multiple onChange={upload} /></label></>} />
    <div className="crm-file-layout">
      <aside className="crm-folder-list"><strong>Folders</strong>{["All files", ...state.folders].map((name) => <button className={folder === name ? "active" : ""} key={name} onClick={() => setFolder(name)}><span>{name === "All files" ? "AF" : "FD"}</span>{name}<small>{name === "All files" ? state.files.length : state.files.filter((file) => file.folder === name).length}</small></button>)}</aside>
      <section className="crm-files-panel">
        <div className="crm-file-toolbar"><label className="crm-search-field"><span>Q</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search files" /></label><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest</option><option value="name">Name</option><option value="size">Size</option></select><div className="crm-segment"><button className={layout === "grid" ? "active" : ""} onClick={() => setLayout("grid")}>Grid</button><button className={layout === "list" ? "active" : ""} onClick={() => setLayout("list")}>List</button></div></div>
        {files.length ? <div className={`crm-file-items ${layout}`}>{files.map((file) => <article key={file.id} className="crm-file-card"><button className="crm-file-preview" onClick={() => setPreview(file)}><span>{file.type.startsWith("image/") ? <img src={file.dataUrl} alt="" /> : file.type.includes("pdf") ? "PDF" : "FILE"}</span><strong>{file.name}</strong><small>{formatBytes(file.size)} · {file.folder}</small></button><div><button onClick={() => rename(file)}>Rename</button><button onClick={() => move(file)}>Move</button><a href={file.dataUrl} download={file.name}>Download</a><button className="danger-text" onClick={() => remove(file)}>Delete</button></div></article>)}</div> : <EmptyState title="No files here" body="Upload a file or choose another folder." />}
      </section>
    </div>
    {preview ? <Modal title={preview.name} close={() => setPreview(null)} wide><div className="crm-preview-area">{preview.type.startsWith("image/") ? <img src={preview.dataUrl} alt={preview.name} /> : preview.type === "application/pdf" ? <iframe src={preview.dataUrl} title={preview.name} /> : <EmptyState title="Preview unavailable" body="Download this file to open it in its native application." />}</div></Modal> : null}
  </div>;
}
