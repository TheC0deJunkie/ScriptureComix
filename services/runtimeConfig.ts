/**
 * runtimeConfig — decides whether the running app may call AI at all.
 *
 * The product rule is "generate once, everyone has it": content (verses,
 * quizzes, context) is produced ahead of time — during development or by
 * scripts/pregenerate.ts — and shipped under public/data. Readers never pay
 * for or wait on generation.
 *
 * Runtime AI is therefore ON in `vite` dev (so anything you open while
 * developing gets generated and written back into the project) and OFF in
 * production builds unless VITE_RUNTIME_AI=true is set explicitly.
 */
export function runtimeAIEnabled(): boolean {
  const env = (typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined) || {};
  if (String(env.VITE_RUNTIME_AI).toLowerCase() === 'true') return true;
  if (String(env.VITE_RUNTIME_AI).toLowerCase() === 'false') return false;
  return !!env.DEV;
}
