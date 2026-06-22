import crypto from "crypto";

type WechatSessionPayload = {
  exp: number;
  openid: string;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getWechatSessionSecret() {
  return process.env.WECHAT_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
}

export function createWechatSessionToken(openid: string) {
  const secret = getWechatSessionSecret();

  if (!secret) {
    throw new Error("微信登录环境变量缺失，请配置 WECHAT_SESSION_SECRET。");
  }

  const payload: WechatSessionPayload = {
    openid,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");

  return `${encodedPayload}.${signature}`;
}

export function verifyWechatSessionToken(token: string) {
  const secret = getWechatSessionSecret();

  if (!secret || !token.includes(".")) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  const expectedSignature = crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as WechatSessionPayload;

    if (!payload.openid || payload.exp < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
