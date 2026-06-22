import { createWechatSessionToken } from "@/lib/wechat/session";
import { NextResponse } from "next/server";

type WechatLoginRequest = {
  code?: string;
};

type Code2SessionResponse = {
  errcode?: number;
  errmsg?: string;
  openid?: string;
  session_key?: string;
  unionid?: string;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const appid = process.env.WECHAT_APP_ID;
    const secret = process.env.WECHAT_APP_SECRET;

    if (!appid || !secret) {
      return NextResponse.json({ error: "微信登录环境变量缺失，请配置 WECHAT_APP_ID 和 WECHAT_APP_SECRET。" }, { status: 500 });
    }

    const body = (await request.json()) as WechatLoginRequest;

    if (!body.code) {
      return NextResponse.json({ error: "缺少微信登录 code。" }, { status: 400 });
    }

    const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
    url.searchParams.set("appid", appid);
    url.searchParams.set("secret", secret);
    url.searchParams.set("js_code", body.code);
    url.searchParams.set("grant_type", "authorization_code");

    const response = await fetch(url);
    const payload = (await response.json()) as Code2SessionResponse;

    if (!response.ok || payload.errcode || !payload.openid) {
      return NextResponse.json({ error: payload.errmsg || "微信登录失败，请稍后重试。" }, { status: 401 });
    }

    return NextResponse.json({
      token: createWechatSessionToken(payload.openid),
      openid: payload.openid
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "微信登录失败，请稍后重试。" }, { status: 500 });
  }
}
