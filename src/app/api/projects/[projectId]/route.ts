import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;

  if (!projectId) {
    return NextResponse.json({ error: "缺少项目 ID。" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "登录状态已失效，请重新登录后再删除。" }, { status: 401 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const supabaseForDelete = supabaseAdmin ?? supabase;

  const { data: project, error: projectError } = await supabaseForDelete
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string }>();

  if (projectError) {
    return NextResponse.json({ error: projectError.message || "项目查询失败。" }, { status: 500 });
  }

  if (!project) {
    return NextResponse.json({ error: "项目不存在或没有删除权限。" }, { status: 404 });
  }

  const { error: chaptersError } = await supabaseForDelete.from("chapters").delete().eq("project_id", projectId).eq("user_id", user.id);

  if (chaptersError) {
    return NextResponse.json({ error: chaptersError.message || "章节删除失败。" }, { status: 500 });
  }

  const { error: deleteError } = await supabaseForDelete.from("projects").delete().eq("id", projectId).eq("user_id", user.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message || "项目删除失败。" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
