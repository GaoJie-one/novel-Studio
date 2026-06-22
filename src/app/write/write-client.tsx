"use client";

import { AppShell } from "@/components/app-shell";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const genres = ["玄幻", "修仙", "都市", "历史", "武侠", "悬疑", "言情", "科幻"];
const styles = ["热血激昂", "细腻婉约", "幽默诙谐", "悬念迭起", "史诗宏大", "温情脉脉"];
const lengths = ["短篇（1章）", "中篇（3章）", "长篇（5章）"];
const characterTemplate = "姓名：\n身份：\n性格：\n目标：\n与其他角色关系：";

type WriterMode = "idle" | "loading" | "generating" | "result";

type WriteClientProps = {
  initialMode: WriterMode;
  projectId?: string;
};

type CreationForm = {
  avoidances: string;
  genre: string;
  protagonist: string;
  setting: string;
  prompt: string;
  style: string;
  length: string;
  wordsPerChapter: string;
};

type Chapter = {
  id: string;
  chapterNumber: number;
  title: string;
  outline: string;
  content: string;
};

type ProjectRow = {
  id: string;
  title: string;
  genre: string;
  tone: string;
  chapter_count: number;
  words_per_chapter: number;
  main_characters: string;
  world_setting: string;
  story_outline: string;
};

type ChapterRow = {
  id: string;
  chapter_number: number;
  title: string;
  outline: string;
  content: string;
};

type GeneratedNovelResponse = {
  title: string;
  chapters: Array<{
    chapterNumber: number;
    title: string;
    outline: string;
    content: string;
  }>;
};

type GenerationKind = "novel" | "chapter";

type PendingGeneration = {
  kind: GenerationKind;
  chapterId?: string;
};

type QualityReport = {
  status: "idle" | "loading" | "ready" | "error";
  content: string;
};

const defaultForm: CreationForm = {
  avoidances: "",
  genre: genres[0],
  protagonist: "",
  setting: "",
  prompt: "",
  style: styles[0],
  length: lengths[0],
  wordsPerChapter: "2000"
};

const sampleForm: CreationForm = {
  avoidances: "不要开放式结尾；不要反复写望天、赶路、回忆式开场；不要让人物关系回到原点",
  genre: genres[0],
  protagonist: "李涵：少年剑修，身怀远古血脉；沈青鸾：冷静医修，掌握失传丹术；陆承渊：旧日仇敌，暗中追查血脉真相",
  setting: "天玄大陆",
  prompt: "李涵发现自己身怀远古血脉，踏上复仇之路",
  style: styles[0],
  length: lengths[0],
  wordsPerChapter: "2000"
};

const sampleChapters: Chapter[] = [
  {
    id: "chapter-1",
    chapterNumber: 1,
    title: "第一章　远古血脉",
    outline: "李涵在族中测灵时发现体内沉睡着远古血脉，引来族老震惊，也让隐藏多年的仇敌开始露面。",
    content:
      "天地初开，混沌未分，一道剑气自虚空中划破苍穹，带来了这个世界最初的裂变。\n\n天玄大陆，一个存在了数万年的古老大地。这里山川壮阔，灵气充沛，无数强者在此间留下了不朽的传说。\n\n李涵出生于天玄大陆边陲一座小镇，自幼便展现出与常人不同的气质。那一年，他十六岁。命运的齿轮，就在那个普通得不能再普通的清晨，悄然开始转动。"
  },
  {
    id: "chapter-2",
    chapterNumber: 2,
    title: "第二章　旧怨浮现",
    outline: "血脉觉醒后，李涵得知父母失踪并非意外。族中有人试图夺走他的传承，他被迫离开小镇。",
    content:
      "夜色压在小镇上方，像一块被水浸透的黑布。\n\n李涵站在祠堂前，听见族老用极低的声音说出那个被尘封多年的名字。那一刻，他终于明白，自己这些年的平静生活，不过是有人替他挡下了风暴。\n\n而现在，风暴要亲自来找他了。"
  },
  {
    id: "chapter-3",
    chapterNumber: 3,
    title: "第三章　踏入山门",
    outline: "李涵进入玄霄宗，在试炼中初露锋芒，并发现宗门深处藏着与远古血脉相关的线索。",
    content:
      "玄霄宗立在九峰之间，云海如潮，钟声自山巅滚落。\n\n李涵抬头望去，只见石阶一路没入雾中，仿佛通往另一个世界。他握紧手中的旧玉牌，心里第一次生出清晰的念头：他要知道真相，也要让那些欠债的人付出代价。\n\n山门开启，他一步踏入。"
  }
];

function getLengthConfig(length: string) {
  const chapterCount = Number.parseInt(length.match(/\d+/)?.[0] ?? "1", 10);

  return { chapterCount: Number.isFinite(chapterCount) ? chapterCount : 1 };
}

function normalizeWordsPerChapter(value: string) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 2000;
  }

  return parsed;
}

function countVisibleCharacters(value: string) {
  return value.replace(/\s/g, "").length;
}

function createNovelMarkdown(projectTitle: string, chapters: Chapter[]) {
  return [`# ${projectTitle}`, ...chapters.map((chapter) => `## ${chapter.title}\n\n${chapter.content}`)].join("\n\n");
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function createDraftChapters(form: CreationForm) {
  const { chapterCount } = getLengthConfig(form.length);
  const wordsPerChapter = normalizeWordsPerChapter(form.wordsPerChapter);
  const protagonist = form.protagonist.trim() || sampleForm.protagonist;
  const setting = form.setting.trim() || sampleForm.setting;
  const prompt = form.prompt.trim() || sampleForm.prompt;

  return Array.from({ length: chapterCount }, (_, index) => {
    const chapterNumber = index + 1;
    const isFinalChapter = chapterNumber === chapterCount;

    return {
      chapterNumber,
      title: `第${chapterNumber}章　${isFinalChapter ? "终局回响" : chapterNumber === 1 ? "命运开端" : chapterNumber === 2 ? "暗潮浮现" : "新的转折"}`,
      outline: `${protagonist}在${setting}中推进故事主线：${prompt}。${isFinalChapter ? "本章必须完成主线并写出明确结局。" : "本章要有阶段性推进和自然后续期待。"}本章目标约 ${wordsPerChapter} 字。`,
      content:
        isFinalChapter
          ? `${setting}的风吹过最后一处战场，${protagonist}终于直面命运最深处的答案。\n\n${prompt}。所有埋下的因果都在这一章收束，主线冲突得到解决，人物命运也有了清晰归宿。\n\n目标字数：约 ${wordsPerChapter} 字。`
          : chapterNumber === 1
            ? `${setting}的风吹过长街，${protagonist}第一次意识到，自己平静的人生已经被命运撕开一道裂口。\n\n${prompt}。他没有退路，只能向前。\n\n目标字数：约 ${wordsPerChapter} 字。`
            : `${protagonist}沿着线索继续前行。旧日秘密一点点浮出水面，而${setting}深处，还有更大的风暴正在等他。\n\n这一章可以继续扩写冲突、人物关系和关键反转。\n\n目标字数：约 ${wordsPerChapter} 字。`
    };
  });
}

function getLengthLabel(chapterCount: number) {
  const matchedLength = lengths.find((length) => getLengthConfig(length).chapterCount === chapterCount);

  return matchedLength ?? lengths[lengths.length - 1];
}

async function generateNovelDraft(form: CreationForm, chapterCount: number, wordsPerChapter: number): Promise<GeneratedNovelResponse> {
  const response = await fetch("/api/generate/novel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      avoidances: form.avoidances,
      genre: form.genre,
      protagonist: form.protagonist,
      setting: form.setting,
      prompt: form.prompt,
      style: form.style,
      chapterCount,
      wordsPerChapter
    })
  });

  const payload = (await response.json().catch(() => null)) as (GeneratedNovelResponse & { error?: string }) | null;

  if (!response.ok) {
    throw new Error(payload?.error || "小说正文生成失败，请稍后重试。");
  }

  if (!payload?.chapters?.length) {
    throw new Error("模型没有返回章节内容，请稍后重试。");
  }

  return {
    title: payload.title || "未命名小说",
    chapters: payload.chapters
  };
}

async function generateChapterDraft({
  chapter,
  chapterCount,
  chapters,
  form,
  projectTitle,
  wordsPerChapter
}: {
  chapter: Chapter;
  chapterCount: number;
  chapters: Chapter[];
  form: CreationForm;
  projectTitle: string;
  wordsPerChapter: number;
}): Promise<GeneratedNovelResponse["chapters"][number]> {
  const response = await fetch("/api/generate/novel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      avoidances: form.avoidances,
      genre: form.genre,
      protagonist: form.protagonist,
      setting: form.setting,
      prompt: form.prompt,
      style: form.style,
      chapterCount,
      wordsPerChapter,
      targetChapterNumber: chapter.chapterNumber,
      projectTitle,
      existingChapters: chapters.map((item) => ({
        chapterNumber: item.chapterNumber,
        ending: item.content.replace(/\s+/g, " ").trim().slice(-520),
        title: item.title,
        outline: item.outline
      }))
    })
  });

  const payload = (await response.json().catch(() => null)) as (GeneratedNovelResponse & { error?: string }) | null;

  if (!response.ok) {
    throw new Error(payload?.error || "本章重新生成失败，请稍后重试。");
  }

  const generatedChapter = payload?.chapters?.[0];

  if (!generatedChapter) {
    throw new Error("模型没有返回章节内容，请稍后重试。");
  }

  return generatedChapter;
}

async function replaceProjectChapters({
  chapters,
  projectId,
  supabase,
  userId
}: {
  chapters: GeneratedNovelResponse["chapters"];
  projectId: string;
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
  userId: string;
}) {
  const { error: deleteError } = await supabase.from("chapters").delete().eq("project_id", projectId).eq("user_id", userId);

  if (deleteError) {
    throw new Error(deleteError.message || "旧章节覆盖失败，请稍后重试。");
  }

  const { data: chapterRows, error: chaptersError } = await supabase
    .from("chapters")
    .insert(
      chapters.map((chapter) => ({
        project_id: projectId,
        user_id: userId,
        chapter_number: chapter.chapterNumber,
        title: chapter.title,
        outline: chapter.outline,
        content: chapter.content,
        status: "completed"
      }))
    )
    .select("id,chapter_number,title,outline,content")
    .order("chapter_number", { ascending: true })
    .returns<ChapterRow[]>();

  if (chaptersError) {
    throw new Error(chaptersError.message || "章节保存失败，请稍后重试。");
  }

  return rowsToChapters(chapterRows ?? []);
}

function projectToForm(project: ProjectRow): CreationForm {
  return {
    avoidances: "",
    genre: project.genre || defaultForm.genre,
    protagonist: project.main_characters || "",
    setting: project.world_setting || "",
    prompt: project.story_outline || "",
    style: project.tone || defaultForm.style,
    length: getLengthLabel(project.chapter_count),
    wordsPerChapter: String(project.words_per_chapter || 2000)
  };
}

function rowsToChapters(rows: ChapterRow[]): Chapter[] {
  return rows.map((row) => ({
    id: row.id,
    chapterNumber: row.chapter_number,
    title: row.title,
    outline: row.outline,
    content: row.content
  }));
}

function CreationSidebar({
  form,
  hasGeneratedContent,
  mode,
  onChange,
  onGenerate
}: {
  form: CreationForm;
  hasGeneratedContent: boolean;
  mode: WriterMode;
  onChange: (form: CreationForm) => void;
  onGenerate: () => void;
}) {
  const isLocked = mode === "generating" || mode === "loading";
  const { chapterCount } = getLengthConfig(form.length);
  const wordsPerChapter = normalizeWordsPerChapter(form.wordsPerChapter);

  function handleGenerate() {
    if (isLocked) {
      return;
    }

    onGenerate();
  }

  return (
    <aside className={isLocked ? "writer-sidebar writer-sidebar-locked" : "writer-sidebar"}>
      <div className="writer-sidebar-scroll">
        <h1 className="panel-title">
          <span>⌁</span>
          创作参数
        </h1>

        <section className="control-group">
          <h2>小说类型</h2>
          <div className="option-grid">
            {genres.map((genre) => (
              <button
                aria-pressed={form.genre === genre}
                className={form.genre === genre ? "choice choice-active" : "choice"}
                disabled={isLocked}
                key={genre}
                onClick={() => onChange({ ...form, genre })}
                type="button"
              >
                {genre}
              </button>
            ))}
          </div>
        </section>

        <section className="control-group">
          <div className="control-heading-row">
            <h2>人物设定</h2>
            <button disabled={isLocked} onClick={() => onChange({ ...form, protagonist: form.protagonist ? `${form.protagonist}\n\n${characterTemplate}` : characterTemplate })} type="button">
              插入模板
            </button>
          </div>
          <textarea
            className="forge-textarea"
            disabled={isLocked}
            onChange={(event) => onChange({ ...form, protagonist: event.target.value })}
            placeholder="例：李寒：少年剑修，身怀远古血脉；苏晴：医修，冷静敏锐；陈洛：旧友，隐藏真实身份"
            value={form.protagonist}
          />
        </section>

        <section className="control-group">
          <h2>故事背景</h2>
          <input
            className="forge-input"
            disabled={isLocked}
            onChange={(event) => onChange({ ...form, setting: event.target.value })}
            placeholder="例：天玄大陆 / 现代都市 / 唐朝长安"
            value={form.setting}
          />
        </section>

        <section className="control-group">
          <h2>情节提示</h2>
          <textarea
            className="forge-textarea"
            disabled={isLocked}
            onChange={(event) => onChange({ ...form, prompt: event.target.value })}
            placeholder="例：主要人物发现远古血脉的秘密，被迫卷入宗门旧怨……"
            value={form.prompt}
          />
        </section>

        <section className="control-group">
          <h2>避免事项</h2>
          <textarea
            className="forge-textarea forge-textarea-compact"
            disabled={isLocked}
            onChange={(event) => onChange({ ...form, avoidances: event.target.value })}
            placeholder="例：不要开放式结尾；不要重复环境描写；不要第一人称"
            value={form.avoidances}
          />
        </section>

        <section className="control-group">
          <h2>写作风格</h2>
          <div className="style-grid">
            {styles.map((style) => (
              <button
                aria-pressed={form.style === style}
                className={form.style === style ? "choice choice-active" : "choice"}
                disabled={isLocked}
                key={style}
                onClick={() => onChange({ ...form, style })}
                type="button"
              >
                {style}
              </button>
            ))}
          </div>
        </section>

        <section className="control-group">
          <h2>篇幅长度</h2>
          <div className="length-list">
            {lengths.map((length) => (
              <button
                aria-pressed={form.length === length}
                className={form.length === length ? "length-choice length-choice-active" : "length-choice"}
                disabled={isLocked}
                key={length}
                onClick={() => onChange({ ...form, length })}
                type="button"
              >
                {length}
                {form.length === length ? <span>›</span> : null}
              </button>
            ))}
          </div>
        </section>

        <section className="control-group">
          <h2>每章字数</h2>
          <input
            className="forge-input"
            disabled={isLocked}
            inputMode="numeric"
            min={300}
            onChange={(event) => onChange({ ...form, wordsPerChapter: event.target.value })}
            placeholder="例：2000，生成结果会围绕该字数"
            step={100}
            type="number"
            value={form.wordsPerChapter}
          />
        </section>
      </div>

      <div className="writer-sidebar-footer">
        <p className="generation-estimate">
          将生成 {chapterCount} 章，每章约 {wordsPerChapter} 字
        </p>
        <button className={isLocked ? "generate-button generate-button-loading" : "generate-button"} disabled={isLocked} onClick={handleGenerate} type="button">
          {isLocked ? (
            <>
              <span className="button-spinner" aria-hidden="true" />
              正在创作中...
            </>
          ) : hasGeneratedContent ? (
            "✨ 重新生成小说"
          ) : (
            "✨ 一键生成小说"
          )}
        </button>
      </div>
    </aside>
  );
}

function EmptyStage({ message, onFillSample }: { message?: string; onFillSample: () => void }) {
  return (
    <section className="writer-stage">
      <div className="empty-state">
        <div className="empty-icon">⌁</div>
        <h2>开始您的创作</h2>
        <p>
          在左侧填写故事的基本信息，
          <br />
          点击生成按钮，
          <br />
          让 AI 为您创作一段精彩的故事。
        </p>

        <div className="feature-pills">
          <span>🏔️ 丰富的世界观设定</span>
          <span>⚔️ 跌宕起伏的情节</span>
          <span>👤 立体的人物刻画</span>
          <span>✨ 流畅优美的文笔</span>
        </div>

        <button className="sample-fill-button" onClick={onFillSample} type="button">
          填入示例
        </button>

        {message ? <p className="empty-message">{message}</p> : null}
      </div>
    </section>
  );
}

function GeneratingStage({ status }: { status: string }) {
  return (
    <section className="writer-stage writer-generating-stage" aria-live="polite" aria-busy="true">
      <div className="generation-wait">
        <div className="generation-orbit" aria-hidden="true">
          <span className="generation-ring" />
          <span className="generation-mark">⌁</span>
        </div>
        <h2>AI 正在挥毫泼墨...</h2>
        <p>{status}</p>
      </div>
    </section>
  );
}

function LoadingProjectStage() {
  return (
    <section className="writer-stage writer-generating-stage" aria-live="polite" aria-busy="true">
      <div className="generation-wait">
        <div className="generation-orbit" aria-hidden="true">
          <span className="generation-ring" />
          <span className="generation-mark">⌁</span>
        </div>
        <h2>正在打开创作项目...</h2>
        <p>正在从数据库读取章节内容</p>
      </div>
    </section>
  );
}

function ConfirmDialog({
  cancelLabel,
  confirmLabel,
  description,
  onCancel,
  onConfirm,
  title
}: {
  cancelLabel: string;
  confirmLabel: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
}) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section aria-modal="true" className="confirm-dialog" role="dialog">
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="confirm-dialog-actions">
          <button className="dialog-secondary-button" onClick={onCancel} type="button">
            {cancelLabel}
          </button>
          <button className="dialog-primary-button" onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function ResultStage({
  activeChapterId,
  chapters,
  isSaving,
  isRegeneratingChapter,
  message,
  projectTitle,
  onChapterChange,
  onExportMarkdown,
  onExportText,
  onQualityCheck,
  onChapterRegenerate,
  onChapterSelect,
  onChapterSave,
  onReset
}: {
  activeChapterId: string;
  chapters: Chapter[];
  isSaving: boolean;
  isRegeneratingChapter: boolean;
  message: string;
  projectTitle: string;
  onChapterChange: (chapter: Chapter) => void;
  onExportMarkdown: () => void;
  onExportText: () => void;
  onQualityCheck: () => void;
  onChapterRegenerate: (chapter: Chapter) => void;
  onChapterSelect: (chapterId: string) => void;
  onChapterSave: (chapter: Chapter) => Promise<string>;
  onReset: () => void;
}) {
  const activeChapter = chapters.find((chapter) => chapter.id === activeChapterId) ?? chapters[0];
  const [saveMessage, setSaveMessage] = useState("");
  const [dirtyChapterIds, setDirtyChapterIds] = useState<string[]>([]);

  useEffect(() => {
    if (!dirtyChapterIds.length) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirtyChapterIds.length]);

  useEffect(() => {
    if (!activeChapter || !dirtyChapterIds.includes(activeChapter.id) || activeChapter.id.startsWith("chapter-") || isSaving || isRegeneratingChapter) {
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        setSaveMessage("自动保存中...");
        const message = await onChapterSave(activeChapter);
        setSaveMessage(message === "已保存到数据库" ? "已自动保存" : message);

        if (message === "已保存到数据库") {
          setDirtyChapterIds((currentIds) => currentIds.filter((id) => id !== activeChapter.id));
        }

        window.setTimeout(() => setSaveMessage(""), 1800);
      })();
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [activeChapter, dirtyChapterIds, isRegeneratingChapter, isSaving, onChapterSave]);

  if (!activeChapter) {
    return (
      <section className="writer-stage">
        <div className="empty-state">
          <div className="empty-icon">⌁</div>
          <h2>暂无章节内容</h2>
          <p>这个项目还没有章节记录，可以重新创作生成章节。</p>
          <button className="reset-write-button" onClick={onReset} type="button">
            重新创作
          </button>
        </div>
      </section>
    );
  }

  async function handleSave() {
    const message = await onChapterSave(activeChapter);
    setSaveMessage(message);
    if (message === "已保存到数据库") {
      setDirtyChapterIds((currentIds) => currentIds.filter((id) => id !== activeChapter.id));
    }
    window.setTimeout(() => setSaveMessage(""), 1800);
  }

  function handleChapterChange(nextChapter: Chapter) {
    setDirtyChapterIds((currentIds) => (currentIds.includes(nextChapter.id) ? currentIds : [...currentIds, nextChapter.id]));
    onChapterChange(nextChapter);
  }

  const isActiveChapterDirty = dirtyChapterIds.includes(activeChapter.id);
  const activeChapterCharacters = countVisibleCharacters(activeChapter.content);

  return (
    <section className="writer-result">
      <div className="result-heading">
        <h1>☰ {projectTitle}</h1>
        <div className="result-actions">
          {message ? <span>{message}</span> : null}
          {saveMessage ? <span>{saveMessage}</span> : null}
          <button className="reset-write-button" onClick={onQualityCheck} type="button">
            质量检查
          </button>
          <button className="reset-write-button" onClick={onExportMarkdown} type="button">
            导出 MD
          </button>
          <button className="reset-write-button" onClick={onExportText} type="button">
            导出 TXT
          </button>
          <button className="reset-write-button" onClick={onReset} type="button">
            重新创作
          </button>
        </div>
      </div>

      <div className="chapter-workbench">
        <aside className="chapter-list" aria-label="章节列表">
          <div className="chapter-list-heading">
            <span>章节</span>
            <strong>{chapters.length}</strong>
          </div>
          {chapters.map((chapter, index) => (
            <button
              aria-pressed={chapter.id === activeChapter.id}
              className={chapter.id === activeChapter.id ? "chapter-tab chapter-tab-active" : "chapter-tab"}
              key={chapter.id}
              onClick={() => onChapterSelect(chapter.id)}
              type="button"
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>
                {chapter.title}
                {dirtyChapterIds.includes(chapter.id) ? <i>未保存</i> : null}
              </strong>
              <em>{chapter.outline}</em>
            </button>
          ))}
        </aside>

        <article className="chapter-editor">
          <label className="chapter-field">
            <span>章节标题</span>
            <input
              value={activeChapter.title}
              onChange={(event) => handleChapterChange({ ...activeChapter, title: event.target.value })}
            />
          </label>

          <label className="chapter-field">
            <span>章节大纲</span>
            <textarea
              className="chapter-outline-input"
              value={activeChapter.outline}
              onChange={(event) => handleChapterChange({ ...activeChapter, outline: event.target.value })}
            />
          </label>

          <label className="chapter-field chapter-content-field">
            <span>
              章节正文
              <em>{activeChapterCharacters} 字{isActiveChapterDirty ? " · 未保存" : " · 已保存"}</em>
            </span>
            <textarea
              className="chapter-content-input"
              value={activeChapter.content}
              onChange={(event) => handleChapterChange({ ...activeChapter, content: event.target.value })}
            />
          </label>

          <div className="chapter-editor-footer">
            <span>修改后点击保存；重新生成当前章会覆盖本章标题、大纲和正文。</span>
            <div className="chapter-editor-actions">
              <button className="secondary-editor-button" disabled={isSaving || isRegeneratingChapter} onClick={() => onChapterRegenerate(activeChapter)} type="button">
                {isRegeneratingChapter ? "生成中..." : "重新生成本章"}
              </button>
              <button disabled={isSaving || isRegeneratingChapter} onClick={handleSave} type="button">
                {isSaving ? "保存中..." : "保存本章"}
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

export function WriteClient({ initialMode, projectId }: WriteClientProps) {
  const [mode, setMode] = useState<WriterMode>(initialMode);
  const [form, setForm] = useState<CreationForm>(initialMode === "result" ? sampleForm : defaultForm);
  const [chapters, setChapters] = useState<Chapter[]>(initialMode === "result" ? sampleChapters : []);
  const [activeChapterId, setActiveChapterId] = useState(initialMode === "result" ? sampleChapters[0].id : "");
  const [currentProjectId, setCurrentProjectId] = useState(projectId ?? "");
  const [regeneratingProjectId, setRegeneratingProjectId] = useState("");
  const [pendingGeneration, setPendingGeneration] = useState<PendingGeneration | null>(null);
  const [generationStatus, setGenerationStatus] = useState("正在准备创作参数");
  const [projectTitle, setProjectTitle] = useState("万古第一神");
  const [isSaving, setIsSaving] = useState(false);
  const [isRegeneratingChapter, setIsRegeneratingChapter] = useState(false);
  const [qualityReport, setQualityReport] = useState<QualityReport>({ status: "idle", content: "" });
  const [pageMessage, setPageMessage] = useState("");

  useEffect(() => {
    setMode(initialMode);
    setCurrentProjectId(projectId ?? "");

    if (initialMode === "loading") {
      setForm(defaultForm);
      setChapters([]);
      setActiveChapterId("");
      setProjectTitle("正在加载项目");
      setPageMessage("");
    }

    if (initialMode === "idle") {
      setForm(defaultForm);
      setChapters([]);
      setActiveChapterId("");
      setProjectTitle("万古第一神");
    }
  }, [initialMode, projectId]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    let mounted = true;

    async function loadProject() {
      setPageMessage("正在加载项目...");

      const supabase = createSupabaseBrowserClient();
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id,title,genre,tone,chapter_count,words_per_chapter,main_characters,world_setting,story_outline")
        .eq("id", projectId)
        .single<ProjectRow>();

      if (!mounted) {
        return;
      }

      if (projectError || !project) {
        setMode("idle");
        setPageMessage("项目加载失败，可能不存在或没有访问权限。");
        return;
      }

      const { data: chapterRows, error: chaptersError } = await supabase
        .from("chapters")
        .select("id,chapter_number,title,outline,content")
        .eq("project_id", projectId)
        .order("chapter_number", { ascending: true })
        .returns<ChapterRow[]>();

      if (!mounted) {
        return;
      }

      if (chaptersError) {
        setMode("idle");
        setPageMessage("章节加载失败，请稍后重试。");
        return;
      }

      const nextChapters = rowsToChapters(chapterRows ?? []);
      setMode("result");
      setCurrentProjectId(project.id);
      setProjectTitle(project.title);
      setForm(projectToForm(project));
      setChapters(nextChapters);
      setActiveChapterId(nextChapters[0]?.id ?? "");
      setPageMessage("");
    }

    loadProject();

    return () => {
      mounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (mode !== "generating") {
      return;
    }

    window.history.replaceState(null, "", "/write?generating=1");
    setGenerationStatus(regeneratingProjectId ? "正在准备覆盖当前小说" : "正在准备新小说");

    const timer = window.setTimeout(() => {
      void createProjectFromForm();
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [mode]);

  function handleGenerate() {
    setPageMessage("");
    const nextPendingGeneration: PendingGeneration = { kind: "novel" };

    if (currentProjectId || chapters.length) {
      setPendingGeneration(nextPendingGeneration);
      return;
    }

    startGeneration(nextPendingGeneration);
  }

  function startGeneration(nextPendingGeneration: PendingGeneration) {
    if (nextPendingGeneration.kind === "chapter") {
      const chapter = chapters.find((item) => item.id === nextPendingGeneration.chapterId);

      if (chapter) {
        void regenerateChapter(chapter);
      }

      setPendingGeneration(null);
      return;
    }

    setPendingGeneration(null);
    setRegeneratingProjectId(currentProjectId);
    setMode("generating");
  }

  function cancelGeneration() {
    setPendingGeneration(null);
  }

  function handleChapterRegenerate(chapter: Chapter) {
    setPendingGeneration({ kind: "chapter", chapterId: chapter.id });
  }

  async function createProjectFromForm() {
    const supabase = createSupabaseBrowserClient();
    const normalizedForm: CreationForm = {
      ...form,
      protagonist: form.protagonist.trim() || sampleForm.protagonist,
      setting: form.setting.trim() || sampleForm.setting,
      prompt: form.prompt.trim() || sampleForm.prompt,
      wordsPerChapter: String(normalizeWordsPerChapter(form.wordsPerChapter))
    };
    const { chapterCount } = getLengthConfig(normalizedForm.length);
    const wordsPerChapter = normalizeWordsPerChapter(normalizedForm.wordsPerChapter);

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMode("idle");
      setPageMessage("登录状态已失效，请重新登录后再创作。");
      window.history.replaceState(null, "", "/write");
      return;
    }

    const projectIdToReplace = regeneratingProjectId || currentProjectId;
    let draftNovel: GeneratedNovelResponse;

    try {
      setGenerationStatus("正在生成大纲和章节正文");
      draftNovel = await generateNovelDraft(normalizedForm, chapterCount, wordsPerChapter);
      setGenerationStatus(projectIdToReplace ? "正在覆盖原小说内容" : "正在保存到创作历史");
    } catch (error) {
      setMode(projectIdToReplace ? "result" : "idle");
      setPageMessage(error instanceof Error ? error.message : "小说正文生成失败，请稍后重试。");
      window.history.replaceState(null, "", projectIdToReplace ? `/write?projectId=${projectIdToReplace}` : "/write");
      return;
    }

    let nextProject: { id: string; title: string };

    if (projectIdToReplace) {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .update({
          title: draftNovel.title,
          genre: normalizedForm.genre,
          target_reader: "",
          tone: normalizedForm.style,
          chapter_count: chapterCount,
          words_per_chapter: wordsPerChapter,
          main_characters: normalizedForm.protagonist,
          world_setting: normalizedForm.setting,
          story_outline: normalizedForm.prompt,
          status: "completed"
        })
        .eq("id", projectIdToReplace)
        .eq("user_id", user.id)
        .select("id,title")
        .single<{ id: string; title: string }>();

      if (projectError || !project) {
        setMode("result");
        setPageMessage(projectError?.message || "项目覆盖失败，请稍后重试。");
        window.history.replaceState(null, "", `/write?projectId=${projectIdToReplace}`);
        return;
      }

      nextProject = project;
    } else {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          title: draftNovel.title,
          genre: normalizedForm.genre,
          target_reader: "",
          tone: normalizedForm.style,
          chapter_count: chapterCount,
          words_per_chapter: wordsPerChapter,
          main_characters: normalizedForm.protagonist,
          world_setting: normalizedForm.setting,
          story_outline: normalizedForm.prompt,
          status: "completed"
        })
        .select("id,title")
        .single<{ id: string; title: string }>();

      if (projectError || !project) {
        setMode("idle");
        setPageMessage(projectError?.message || "项目保存失败，请稍后重试。");
        window.history.replaceState(null, "", "/write");
        return;
      }

      nextProject = project;
    }

    let nextChapters: Chapter[];

    try {
      setGenerationStatus("正在写入章节内容");
      nextChapters = await replaceProjectChapters({
        chapters: draftNovel.chapters,
        projectId: nextProject.id,
        supabase,
        userId: user.id
      });
    } catch (error) {
      setMode(currentProjectId ? "result" : "idle");
      setPageMessage(error instanceof Error ? error.message : "章节保存失败，请稍后重试。");
      window.history.replaceState(null, "", projectIdToReplace ? `/write?projectId=${projectIdToReplace}` : "/write");
      return;
    }

    setMode("result");
    setForm(normalizedForm);
    setCurrentProjectId(nextProject.id);
    setProjectTitle(nextProject.title);
    setChapters(nextChapters);
    setActiveChapterId(nextChapters[0]?.id ?? "");
    setRegeneratingProjectId("");
    setGenerationStatus("创作完成");
    setPageMessage("");
    window.history.replaceState(null, "", `/write?projectId=${nextProject.id}`);
  }

  async function regenerateChapter(chapter: Chapter) {
    const normalizedForm: CreationForm = {
      ...form,
      protagonist: form.protagonist.trim() || sampleForm.protagonist,
      setting: form.setting.trim() || sampleForm.setting,
      prompt: form.prompt.trim() || sampleForm.prompt,
      wordsPerChapter: String(normalizeWordsPerChapter(form.wordsPerChapter))
    };
    const { chapterCount } = getLengthConfig(normalizedForm.length);
    const wordsPerChapter = normalizeWordsPerChapter(normalizedForm.wordsPerChapter);
    const supabase = createSupabaseBrowserClient();
    setIsRegeneratingChapter(true);
    setPageMessage("正在重新生成当前章节...");

    try {
      const generatedChapter = await generateChapterDraft({
        chapter,
        chapterCount,
        chapters,
        form: normalizedForm,
        projectTitle,
        wordsPerChapter
      });

      const nextChapter: Chapter = {
        id: chapter.id,
        chapterNumber: chapter.chapterNumber,
        title: generatedChapter.title,
        outline: generatedChapter.outline,
        content: generatedChapter.content
      };

      if (!currentProjectId || chapter.id.startsWith("chapter-")) {
        setChapters((currentChapters) => currentChapters.map((item) => (item.id === chapter.id ? nextChapter : item)));
        setPageMessage("已重新生成当前章节，保存后会写入数据库。");
        return;
      }

      const { error } = await supabase
        .from("chapters")
        .update({
          title: nextChapter.title,
          outline: nextChapter.outline,
          content: nextChapter.content
        })
        .eq("id", chapter.id)
        .eq("project_id", currentProjectId);

      if (error) {
        throw new Error(error.message || "本章保存失败，请稍后重试。");
      }

      setChapters((currentChapters) => currentChapters.map((item) => (item.id === chapter.id ? nextChapter : item)));
      setPageMessage("当前章节已重新生成并保存。");
      window.setTimeout(() => setPageMessage(""), 2200);
    } catch (error) {
      setPageMessage(error instanceof Error ? error.message : "本章重新生成失败，请稍后重试。");
    } finally {
      setIsRegeneratingChapter(false);
    }
  }

  function handleReset() {
    setMode("idle");
    setForm(defaultForm);
    setChapters([]);
    setActiveChapterId("");
    setCurrentProjectId("");
    setRegeneratingProjectId("");
    setPendingGeneration(null);
    setProjectTitle("万古第一神");
    setPageMessage("");
    window.history.replaceState(null, "", "/write");
  }

  function handleFillSample() {
    setForm(sampleForm);
    setPageMessage("已填入示例参数，可以直接生成或继续修改。");
  }

  function handleExportMarkdown() {
    downloadTextFile(`${projectTitle || "novel"}.md`, createNovelMarkdown(projectTitle, chapters), "text/markdown;charset=utf-8");
  }

  function handleExportText() {
    downloadTextFile(`${projectTitle || "novel"}.txt`, chapters.map((chapter) => `${chapter.title}\n\n${chapter.content}`).join("\n\n"), "text/plain;charset=utf-8");
  }

  async function handleQualityCheck() {
    if (!chapters.length) {
      setPageMessage("暂无章节内容可检查。");
      return;
    }

    setQualityReport({ status: "loading", content: "正在检查章节连续性和重复问题..." });

    const response = await fetch("/api/generate/quality", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: projectTitle,
        genre: form.genre,
        protagonist: form.protagonist,
        setting: form.setting,
        prompt: form.prompt,
        wordsPerChapter: normalizeWordsPerChapter(form.wordsPerChapter),
        chapters
      })
    });
    const payload = (await response.json().catch(() => null)) as { error?: string; report?: string } | null;

    if (!response.ok) {
      setQualityReport({ status: "error", content: payload?.error || "质量检查失败，请稍后重试。" });
      return;
    }

    setQualityReport({ status: "ready", content: payload?.report || "没有生成检查报告，请稍后重试。" });
  }

  function handleChapterChange(nextChapter: Chapter) {
    setChapters((currentChapters) => currentChapters.map((chapter) => (chapter.id === nextChapter.id ? nextChapter : chapter)));
  }

  async function handleChapterSave(chapter: Chapter) {
    if (!currentProjectId || chapter.id.startsWith("chapter-")) {
      return "当前章节还没有保存到数据库。";
    }

    setIsSaving(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("chapters")
      .update({
        title: chapter.title,
        outline: chapter.outline,
        content: chapter.content
      })
      .eq("id", chapter.id)
      .eq("project_id", currentProjectId);

    setIsSaving(false);

    if (error) {
      return error.message || "保存失败，请稍后重试。";
    }

    return "已保存到数据库";
  }

  return (
    <AppShell active="write">
      <div className="writer-layout">
        <CreationSidebar form={form} hasGeneratedContent={Boolean(currentProjectId || chapters.length)} mode={mode} onChange={setForm} onGenerate={handleGenerate} />
        {mode === "loading" ? (
          <LoadingProjectStage />
        ) : mode === "generating" ? (
          <GeneratingStage status={generationStatus} />
        ) : mode === "result" ? (
          <ResultStage
            activeChapterId={activeChapterId}
            chapters={chapters}
            isSaving={isSaving}
            isRegeneratingChapter={isRegeneratingChapter}
            message={pageMessage}
            projectTitle={projectTitle}
            onChapterChange={handleChapterChange}
            onExportMarkdown={handleExportMarkdown}
            onExportText={handleExportText}
            onQualityCheck={handleQualityCheck}
            onChapterRegenerate={handleChapterRegenerate}
            onChapterSelect={setActiveChapterId}
            onChapterSave={handleChapterSave}
            onReset={handleReset}
          />
        ) : (
          <EmptyStage message={pageMessage} onFillSample={handleFillSample} />
        )}
      </div>
      {pendingGeneration ? (
        <ConfirmDialog
          cancelLabel="取消"
          confirmLabel={pendingGeneration.kind === "chapter" ? "重新生成本章" : "覆盖并重新生成"}
          description={
            pendingGeneration.kind === "chapter"
              ? "重新生成会覆盖当前章节的标题、大纲和正文，已手动编辑但未保存的内容也会被替换。"
              : `重新生成会覆盖当前小说的标题、大纲和正文。预计生成 ${getLengthConfig(form.length).chapterCount} 章，每章约 ${normalizeWordsPerChapter(form.wordsPerChapter)} 字。`
          }
          onCancel={cancelGeneration}
          onConfirm={() => startGeneration(pendingGeneration)}
          title={pendingGeneration.kind === "chapter" ? "重新生成当前章节？" : "覆盖当前小说？"}
        />
      ) : null}
      {qualityReport.status !== "idle" ? (
        <div className="dialog-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-dialog quality-dialog" role="dialog">
            <h2>{qualityReport.status === "loading" ? "正在检查" : qualityReport.status === "error" ? "检查失败" : "质量检查报告"}</h2>
            <pre>{qualityReport.content}</pre>
            <div className="confirm-dialog-actions">
              <button className="dialog-primary-button" onClick={() => setQualityReport({ status: "idle", content: "" })} type="button">
                关闭
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
