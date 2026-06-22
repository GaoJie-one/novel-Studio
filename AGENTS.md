# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js 15 App Router project for a Chinese novel generation studio. Application routes live in `src/app`: auth pages under `src/app/auth`, the writing workflow in `src/app/write`, history in `src/app/history`, and the LLM endpoint at `src/app/api/generate/novel/route.ts`. Shared React components are in `src/components`, Supabase helpers are in `src/lib/supabase`, global styles are in `src/styles/globals.css`, and request middleware is in `src/middleware.ts`. Keep route-specific UI close to its route and move reused UI into `src/components`.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm run dev`: start the local development server, usually at `http://127.0.0.1:3000`.
- `npm run build`: create a production Next.js build and catch server/client integration issues.
- `npm run start`: serve the production build after `npm run build`.
- `npm run lint`: run the Next.js ESLint configuration.
- `npm run typecheck`: run TypeScript without emitting files.

Run `npm run lint` and `npm run typecheck` before opening a PR.

## Coding Style & Naming Conventions

Use TypeScript and React function components. Match the existing two-space indentation, double quotes, semicolons, and path alias imports such as `@/components/app-shell`. Component files use kebab-case (`auth-page.tsx`), exported components use PascalCase, hooks and helpers use camelCase, and route folders use lowercase URL segments. Keep server-only logic in route handlers, server components, or `src/lib/supabase/server.ts`; browser-only code must include `"use client"`.

## Testing Guidelines

No automated test framework is configured yet. For now, validate changes with `npm run lint`, `npm run typecheck`, and manual flows through sign-in, writing, generation, and history. When adding tests, prefer colocated `*.test.ts` or `*.test.tsx` files and document any new test command in `package.json` and this guide.

## Security & Configuration Tips

The generation API requires `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL_NAME`. Supabase clients also depend on the project URL and keys expected by the Supabase helper files. Store secrets in local environment files, never commit them, and avoid logging prompts, keys, or generated private user content.

## Commit & Pull Request Guidelines

This repository currently has no Git commit history, so use clear imperative commit messages such as `Add novel generation route` or `Fix auth redirect`. PRs should include a short summary, verification steps, linked issues when available, and screenshots or screen recordings for visible UI changes. Call out any schema, environment, or deployment changes explicitly.
