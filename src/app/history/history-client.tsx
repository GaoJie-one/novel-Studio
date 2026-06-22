"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useState } from "react";

type HistoryItem = {
  id: string;
  chapterCount: number;
  genre: string;
  title: string;
  protagonist: string;
  setting: string;
  totalWords: number;
  createdAt: string;
  href: string;
};

type ProjectRow = {
  id: string;
  title: string;
  genre: string;
  chapter_count: number;
  main_characters: string;
  world_setting: string;
  words_per_chapter: number;
  updated_at: string;
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "刚刚";
  }

  return date.toLocaleDateString("zh-CN");
}

function projectToHistoryItem(project: ProjectRow): HistoryItem {
  return {
    id: project.id,
    chapterCount: project.chapter_count || 0,
    genre: project.genre,
    title: project.title,
    protagonist: project.main_characters || "未命名",
    setting: project.world_setting || "未设置",
    totalWords: (project.chapter_count || 0) * (project.words_per_chapter || 0),
    createdAt: formatDate(project.updated_at),
    href: `/write?projectId=${project.id}`
  };
}

export function HistoryClient() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<HistoryItem | null>(null);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "success" | "error">("info");
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("全部");

  async function loadProjects(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setIsLoading(true);
    }

    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("projects")
      .select("id,title,genre,chapter_count,words_per_chapter,main_characters,world_setting,updated_at")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .returns<ProjectRow[]>();

    if (error) {
      setMessageTone("error");
      setMessage(error.message || "创作历史加载失败。");
      setItems([]);
    } else {
      setItems((data ?? []).map(projectToHistoryItem));
    }

    if (!options?.silent) {
      setIsLoading(false);
    }
  }

  const genres = ["全部", ...Array.from(new Set(items.map((item) => item.genre).filter(Boolean)))];
  const normalizedSearch = search.trim().toLowerCase();
  const visibleItems = items.filter((item) => {
    const matchesGenre = genreFilter === "全部" || item.genre === genreFilter;
    const matchesSearch =
      !normalizedSearch ||
      `${item.title} ${item.protagonist} ${item.setting} ${item.genre}`.toLowerCase().includes(normalizedSearch);

    return matchesGenre && matchesSearch;
  });

  useEffect(() => {
    let mounted = true;

    void (async () => {
      await loadProjects();

      if (!mounted) {
        return;
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleDelete(item: HistoryItem) {
    if (deletingId) {
      return;
    }

    setDeleteCandidate(null);
    setDeletingId(item.id);
    setMessageTone("info");
    setMessage("");

    const response = await fetch(`/api/projects/${item.id}`, {
      method: "DELETE"
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setDeletingId("");
      setMessageTone("error");
      setMessage(payload?.error || "删除失败，请稍后重试。");
      return;
    }

    await loadProjects({ silent: true });
    setDeletingId("");
    setMessageTone("success");
    setMessage(`已删除《${item.title}》。该操作不可恢复。`);
    window.setTimeout(() => setMessage(""), 2200);
  }

  return (
    <section className="history-page">
      <div className="history-heading-row">
        <h1 className="history-title">◴ 创作历史</h1>
      </div>
      <div className="history-tools">
        <input aria-label="搜索创作历史" onChange={(event) => setSearch(event.target.value)} placeholder="搜索标题、人物、背景" value={search} />
        <select aria-label="按类型筛选" onChange={(event) => setGenreFilter(event.target.value)} value={genreFilter}>
          {genres.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
        </select>
      </div>
      {message ? (
        <p className={`history-status history-status-${messageTone}`} role="status">
          {message}
        </p>
      ) : null}

      {isLoading ? (
        <div className="history-empty">
          <h2>正在加载创作历史...</h2>
          <p>正在从数据库读取你的小说项目。</p>
        </div>
      ) : visibleItems.length > 0 ? (
        <div className="history-list">
          {visibleItems.map((item) => (
            <article className="history-card" key={item.id}>
              <Link className="history-card-main" href={item.href}>
                <div className="history-meta">
                  <span>{item.genre}</span>
                  <time>{item.createdAt}</time>
                  <time>{item.chapterCount} 章 · 约 {item.totalWords || 0} 字</time>
                </div>
                <h2>{item.title}</h2>
                <p>
                  人物设定：{item.protagonist} · 背景：{item.setting}
                </p>
                <strong>继续创作 →</strong>
              </Link>

              <button className="history-delete-button" disabled={deletingId === item.id} onClick={() => setDeleteCandidate(item)} type="button">
                {deletingId === item.id ? "删除中..." : "删除"}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="history-empty">
          <h2>{items.length ? "没有匹配的作品" : "暂无创作历史"}</h2>
          <p>{items.length ? "可以调整搜索词或类型筛选。" : "删除后的项目不会继续显示。可以回到创作页重新开始新的故事。"}</p>
          <Link href="/write">去创作 →</Link>
        </div>
      )}
      {deleteCandidate ? (
        <div className="dialog-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-dialog" role="dialog">
            <h2>删除这部小说？</h2>
            <p>删除《{deleteCandidate.title}》会同时删除项目和章节内容，当前版本暂不支持恢复。</p>
            <div className="confirm-dialog-actions">
              <button className="dialog-secondary-button" onClick={() => setDeleteCandidate(null)} type="button">
                取消
              </button>
              <button className="dialog-danger-button" onClick={() => handleDelete(deleteCandidate)} type="button">
                确认删除
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
