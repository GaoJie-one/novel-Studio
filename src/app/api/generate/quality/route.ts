import { getAppSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 120;

type QualityChapter = {
  chapterNumber?: number;
  title?: string;
  outline?: string;
  content?: string;
};

type QualityRequest = {
  title?: string;
  genre?: string;
  protagonist?: string;
  setting?: string;
  prompt?: string;
  wordsPerChapter?: number;
  chapters?: QualityChapter[];
};

function normalizeText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function countVisibleCharacters(value: string) {
  return value.replace(/\s/g, "").length;
}

function createOpenAIClient() {
  const baseURL = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;

  if (!baseURL || !apiKey || !process.env.LLM_MODEL_NAME) {
    throw new Error("LLM 环境变量未配置完整，请检查 LLM_BASE_URL、LLM_API_KEY、LLM_MODEL_NAME。");
  }

  return new OpenAI({ apiKey, baseURL });
}

export async function POST(request: Request) {
  try {
    const session = await getAppSession(request);

    if (!session) {
      return NextResponse.json({ error: "登录状态已失效，请重新登录后再检查。" }, { status: 401 });
    }

    const body = (await request.json()) as QualityRequest;
    const chapters = Array.isArray(body.chapters) ? body.chapters : [];
    const chapterText = chapters
      .map((chapter, index) => {
        const content = normalizeText(chapter.content, "");
        const excerpt = content.length > 2600 ? `${content.slice(0, 1200)}\n...\n${content.slice(-1200)}` : content;

        return `第 ${chapter.chapterNumber ?? index + 1} 章：${normalizeText(chapter.title, "未命名章节")}
大纲：${normalizeText(chapter.outline, "无")}
可见字数：${countVisibleCharacters(content)}
正文摘录：
${excerpt}`;
      })
      .join("\n\n---\n\n");

    const client = createOpenAIClient();
    const completion = await client.chat.completions.create({
      model: process.env.LLM_MODEL_NAME as string,
      messages: [
        {
          role: "system",
          content:
            "你是一名中文小说责任编辑。请检查小说草稿的连续性、重复、人物一致性、伏笔收束和章节字数。输出简洁中文报告，不要使用 Markdown 表格。"
        },
        {
          role: "user",
          content: `请检查下面这部小说草稿，并给出可执行修改建议。

标题：${normalizeText(body.title, "未命名小说")}
类型：${normalizeText(body.genre, "未设置")}
人物设定：${normalizeText(body.protagonist, "未设置")}
背景：${normalizeText(body.setting, "未设置")}
主线：${normalizeText(body.prompt, "未设置")}
每章目标字数：约 ${body.wordsPerChapter ?? "未设置"} 字

重点检查：
1. 是否有重复场景、重复环境描写、重复心理独白。
2. 章节之间是否承接自然，地点、伤势、线索、人物关系是否断裂。
3. 人物设定是否跑偏。
4. 伏笔是否有遗忘或结尾是否没有收束。
5. 每章字数是否明显偏离目标。
6. 给出 3-8 条最值得修改的建议。

章节内容：
${chapterText}`
        }
      ],
      temperature: 0.35,
      max_tokens: 2400
    });

    return NextResponse.json({
      report: completion.choices[0]?.message?.content?.trim() || "没有生成检查报告，请稍后重试。"
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "质量检查失败，请稍后重试。" }, { status: 500 });
  }
}
