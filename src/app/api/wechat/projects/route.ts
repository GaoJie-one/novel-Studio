import { getAppSession } from "@/lib/auth/session";
import { getSessionUserId } from "@/lib/auth/user-id";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

type ChapterPayload = {
  chapterNumber?: number;
  content?: string;
  outline?: string;
  title?: string;
};

type SaveProjectRequest = {
  avoidances?: string;
  chapters?: ChapterPayload[];
  genre?: string;
  prompt?: string;
  protagonist?: string;
  setting?: string;
  style?: string;
  title?: string;
  totalWords?: number;
  wordsPerChapter?: number;
};

type ProjectRow = {
  id: string;
  title: string;
  genre: string | null;
  tone: string | null;
  chapter_count: number | null;
  words_per_chapter: number | null;
  main_characters: string | null;
  world_setting: string | null;
  story_outline: string | null;
  updated_at: string | null;
};

type ChapterRow = {
  chapter_number: number;
  content: string | null;
  outline: string | null;
  title: string | null;
};

function normalizeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizePositiveNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(parsed), min), max);
}

function countVisibleCharacters(value: string) {
  return value.replace(/\s/g, "").length;
}

function formatProject(project: ProjectRow, chapters: ChapterRow[]) {
  const normalizedChapters = chapters
    .sort((a, b) => a.chapter_number - b.chapter_number)
    .map((chapter) => ({
      chapterNumber: chapter.chapter_number,
      content: chapter.content || "",
      outline: chapter.outline || "",
      title: chapter.title || `第 ${chapter.chapter_number} 章`
    }));

  return {
    id: project.id,
    title: project.title,
    genre: project.genre || "",
    protagonist: project.main_characters || "",
    setting: project.world_setting || "",
    prompt: project.story_outline || "",
    style: project.tone || "",
    createdAt: project.updated_at || "",
    totalWords: normalizedChapters.reduce((total, chapter) => total + countVisibleCharacters(chapter.content), 0),
    wordsPerChapter: project.words_per_chapter || 0,
    chapterCount: project.chapter_count || normalizedChapters.length,
    chapters: normalizedChapters
  };
}

async function getWechatUserId(request: Request) {
  const session = await getAppSession(request);

  if (!session) {
    return null;
  }

  return getSessionUserId(session);
}

export async function GET(request: Request) {
  try {
    const userId = await getWechatUserId(request);

    if (!userId) {
      return NextResponse.json({ error: "登录状态已失效，请重新登录后再读取历史。" }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id,title,genre,tone,chapter_count,words_per_chapter,main_characters,world_setting,story_outline,updated_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .returns<ProjectRow[]>();

    if (projectsError) {
      return NextResponse.json({ error: projectsError.message || "历史读取失败。" }, { status: 500 });
    }

    const projectIds = (projects || []).map((project) => project.id);
    const { data: chapters, error: chaptersError } = projectIds.length
      ? await supabase
          .from("chapters")
          .select("project_id,chapter_number,title,outline,content")
          .in("project_id", projectIds)
          .eq("user_id", userId)
          .returns<Array<ChapterRow & { project_id: string }>>()
      : { data: [], error: null };

    if (chaptersError) {
      return NextResponse.json({ error: chaptersError.message || "章节读取失败。" }, { status: 500 });
    }

    const chaptersByProject = new Map<string, ChapterRow[]>();

    for (const chapter of chapters || []) {
      const nextChapters = chaptersByProject.get(chapter.project_id) || [];
      nextChapters.push(chapter);
      chaptersByProject.set(chapter.project_id, nextChapters);
    }

    return NextResponse.json({
      projects: (projects || []).map((project) => formatProject(project, chaptersByProject.get(project.id) || []))
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "历史读取失败。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getWechatUserId(request);

    if (!userId) {
      return NextResponse.json({ error: "登录状态已失效，请重新登录后再保存。" }, { status: 401 });
    }

    const body = (await request.json()) as SaveProjectRequest;
    const sourceChapters = Array.isArray(body.chapters) ? body.chapters : [];
    const chapters = sourceChapters.map((chapter, index) => ({
      chapterNumber: normalizePositiveNumber(chapter.chapterNumber, index + 1, 1, 20),
      content: normalizeText(chapter.content, ""),
      outline: normalizeText(chapter.outline, ""),
      title: normalizeText(chapter.title, `第 ${index + 1} 章`)
    }));

    if (!chapters.length) {
      return NextResponse.json({ error: "缺少章节内容，无法保存。" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        user_id: userId,
        title: normalizeText(body.title, "未命名小说"),
        genre: normalizeText(body.genre, "未分类"),
        target_reader: "",
        tone: normalizeText(body.style, ""),
        chapter_count: chapters.length,
        words_per_chapter: normalizePositiveNumber(body.wordsPerChapter, 2000, 500, 8000),
        main_characters: normalizeText(body.protagonist, ""),
        world_setting: normalizeText(body.setting, ""),
        story_outline: normalizeText(body.prompt, ""),
        status: "completed"
      })
      .select("id,title,genre,tone,chapter_count,words_per_chapter,main_characters,world_setting,story_outline,updated_at")
      .single<ProjectRow>();

    if (projectError || !project) {
      return NextResponse.json({ error: projectError?.message || "作品保存失败。" }, { status: 500 });
    }

    const { error: chaptersError } = await supabase.from("chapters").insert(
      chapters.map((chapter) => ({
        project_id: project.id,
        user_id: userId,
        chapter_number: chapter.chapterNumber,
        title: chapter.title,
        outline: chapter.outline,
        content: chapter.content,
        status: "completed"
      }))
    );

    if (chaptersError) {
      await supabase.from("projects").delete().eq("id", project.id).eq("user_id", userId);
      return NextResponse.json({ error: chaptersError.message || "章节保存失败。" }, { status: 500 });
    }

    return NextResponse.json({
      project: formatProject(project, chapters.map((chapter) => ({
        chapter_number: chapter.chapterNumber,
        content: chapter.content,
        outline: chapter.outline,
        title: chapter.title
      })))
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "作品保存失败。" }, { status: 500 });
  }
}
