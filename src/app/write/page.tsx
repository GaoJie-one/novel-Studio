import { WriteClient } from "./write-client";

export default async function WritePage({
  searchParams
}: {
  searchParams: Promise<{ generated?: string; generating?: string; projectId?: string }>;
}) {
  const { generated, generating, projectId } = await searchParams;
  const initialMode = projectId ? "loading" : generated === "1" ? "result" : generating === "1" ? "generating" : "idle";

  return <WriteClient initialMode={initialMode} projectId={projectId} />;
}
