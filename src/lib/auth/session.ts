import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyWechatSessionToken } from "@/lib/wechat/session";

export type AppSession =
  | {
      id: string;
      kind: "supabase";
    }
  | {
      id: string;
      kind: "wechat";
    };

export async function getAppSession(request: Request): Promise<AppSession | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    return {
      id: user.id,
      kind: "supabase"
    };
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
  const wechatSession = token ? verifyWechatSessionToken(token) : null;

  if (wechatSession) {
    return {
      id: wechatSession.openid,
      kind: "wechat"
    };
  }

  return null;
}
