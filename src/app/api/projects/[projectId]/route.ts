import { getAppSession } from "@/lib/auth/session";
import { getSessionUserId } from "@/lib/auth/user-id";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const { projectId } = await context.params;

  if (!projectId) {
    return NextResponse.json({ error: "缺少项目 ID。" }, { status: 400 });
  }

  const session = await getAppSession(request);

  if (!session) {
    return NextResponse.json({ error: "登录状态已失效，请重新登录后再删除。" }, { status: 401 });
  }

  const userId = getSessionUserId(session);
  const supabase = createSupabaseAdminClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle<{ id: string }>();

  if (projectError) {
    return NextResponse.json({ error: projectError.message || "项目查询失败。" }, { status: 500 });
  }

  if (!project) {
    return NextResponse.json({ error: "项目不存在或没有删除权限。" }, { status: 404 });
  }

  const { error: chaptersError } = await supabase.from("chapters").delete().eq("project_id", projectId).eq("user_id", userId);

  if (chaptersError) {
    return NextResponse.json({ error: chaptersError.message || "章节删除失败。" }, { status: 500 });
  }

  const { error: deleteError } = await supabase.from("projects").delete().eq("id", projectId).eq("user_id", userId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message || "项目删除失败。" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
