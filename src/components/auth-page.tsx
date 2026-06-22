"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type AuthPageProps = {
  mode: "sign-in" | "sign-up";
  redirectTo?: string;
};

const formCopy = {
  "sign-in": {
    title: "欢迎回来",
    subtitle: "登录您的账户，继续您的故事。",
    button: "登录",
    footerText: "还没有账户？",
    footerLink: "立即注册",
    footerHref: "/auth/sign-up"
  },
  "sign-up": {
    title: "开始创作之旅",
    subtitle: "注册账户，开启无限创作可能。",
    button: "注册并开始",
    footerText: "已有账户？",
    footerLink: "去登录",
    footerHref: "/auth/sign-in"
  }
};

function PenIcon() {
  return (
    <svg aria-hidden="true" className="brand-icon" fill="none" viewBox="0 0 32 32">
      <path
        d="M7.2 23.6 5 28l4.4-2.2 14.8-14.8a4 4 0 0 0-5.6-5.6L7.2 16.8v6.8Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
      <path d="m17.2 6.8 8 8" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
    </svg>
  );
}

function FieldIcon({ type }: { type: "email" | "lock" | "user" }) {
  if (type === "email") {
    return (
      <svg aria-hidden="true" className="field-icon" fill="none" viewBox="0 0 24 24">
        <path d="M4.5 7.5h15v9h-15v-9Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="m5.2 8.2 6.8 5 6.8-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (type === "lock") {
    return (
      <svg aria-hidden="true" className="field-icon" fill="none" viewBox="0 0 24 24">
        <path d="M6.5 10.5h11v8h-11v-8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="field-icon" fill="none" viewBox="0 0 24 24">
      <path d="M12 12.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

export function AuthPage({ mode, redirectTo = "/write" }: AuthPageProps) {
  const copy = formCopy[mode];
  const isSignUp = mode === "sign-up";
  const router = useRouter();
  const safeRedirectTo = redirectTo.startsWith("/") ? redirectTo : "/write";
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function friendlyAuthError(errorMessage: string) {
    const normalized = errorMessage.toLowerCase();

    if (normalized.includes("invalid login credentials")) {
      return "邮箱或密码不正确。请检查后重试，或先确认是否已经注册。";
    }

    if (normalized.includes("email rate limit exceeded") || normalized.includes("rate limit")) {
      return "请求过于频繁，请稍后再试，不要连续点击。";
    }

    if (normalized.includes("user already registered") || normalized.includes("already registered")) {
      return "这个邮箱已经注册过了，请直接登录。";
    }

    if (normalized.includes("password")) {
      return "密码不符合要求，请至少输入 6 位字符。";
    }

    return errorMessage || "认证失败，请稍后重试。";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();

    if (!email || !password || (isSignUp && !name)) {
      setMessage(isSignUp ? "请填写笔名、邮箱和密码。" : "请填写邮箱和密码。");
      setIsSubmitting(false);
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              pen_name: name
            }
          }
        });

        if (error) {
          setMessage(friendlyAuthError(error.message));
          return;
        }

        if (data.session) {
          router.refresh();
          router.replace(safeRedirectTo);
          return;
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (!signInError) {
          router.refresh();
          router.replace(safeRedirectTo);
          return;
        }

        setMessage("账号已创建，但当前项目仍要求邮箱确认。请到邮箱完成确认后再登录。");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        setMessage(friendlyAuthError(error.message));
        return;
      }

      router.refresh();
      router.replace(safeRedirectTo);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "认证服务暂时不可用，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-brand-panel">
        <Link className="auth-brand" href="/">
          <PenIcon />
          <span>Story Forge</span>
        </Link>

        <div className="auth-pitch">
          <h1>
            用文字
            <span>创造世界</span>
          </h1>
          <p>一念之间，万千世界跃然纸上。输入你的灵感，让 AI 为你编织一段荡气回肠的传奇故事。</p>
        </div>

        <div className="auth-stats" aria-label="平台数据">
          <div>
            <strong>10,000+</strong>
            <span>部小说</span>
          </div>
          <div>
            <strong>50+</strong>
            <span>种风格</span>
          </div>
          <div>
            <strong>30秒</strong>
            <span>极速生成</span>
          </div>
        </div>

        <p className="auth-copyright">© 2025 Story Forge · AI 小说创作平台</p>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <div className="auth-form-heading">
            <h2>{copy.title}</h2>
            <p>{copy.subtitle}</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignUp ? (
              <label className="auth-field">
                <span>笔名</span>
                <div className="auth-input">
                  <FieldIcon type="user" />
                  <input autoComplete="nickname" name="name" placeholder="您的创作笔名" type="text" />
                </div>
              </label>
            ) : null}

            <label className="auth-field">
              <span>邮箱</span>
              <div className="auth-input">
                <FieldIcon type="email" />
                <input autoComplete="email" name="email" placeholder="your@email.com" type="email" />
              </div>
            </label>

            <label className="auth-field">
              <span>密码</span>
              <div className="auth-input">
                <FieldIcon type="lock" />
                <input autoComplete={isSignUp ? "new-password" : "current-password"} name="password" placeholder="••••••••" type="password" />
              </div>
            </label>

            {message ? <p className="auth-message">{message}</p> : null}

            <button className="auth-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? "处理中..." : copy.button}
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <p className="auth-switch">
            {copy.footerText}
            <Link href={copy.footerHref}>{copy.footerLink}</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
