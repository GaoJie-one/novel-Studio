import type { AppSession } from "@/lib/auth/session";
import { getSessionUserId } from "@/lib/auth/user-id";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function getDailyLimit(session: AppSession) {
  const rawLimit = session.kind === "wechat" ? process.env.WECHAT_DAILY_GENERATION_LIMIT : process.env.WEB_DAILY_GENERATION_LIMIT;
  const parsed = Number(rawLimit);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return session.kind === "wechat" ? 5 : 20;
  }

  return Math.round(parsed);
}

export async function consumeGenerationQuota(session: AppSession) {
  const supabase = createSupabaseAdminClient();
  const userId = getSessionUserId(session);
  const dailyLimit = getDailyLimit(session);

  const { data, error } = await supabase.rpc("consume_generation_quota", {
    p_daily_limit: dailyLimit,
    p_user_id: userId
  });

  if (error) {
    throw new Error(error.message || "生成额度记录失败，请确认 consume_generation_quota 已创建。");
  }

  if (data !== true) {
    throw new Error(`今日生成次数已用完，请明天再试。当前每日上限为 ${dailyLimit} 次。`);
  }
}
