import fs from "fs";
import path from "path";

const bootstrapPath = path.resolve(__dirname, "..", "supabase-welcomeflow-state.sql");
const containmentPath = path.resolve(__dirname, "..", "supabase", "migrations", "20260717014305_contain_real_candidate_data.sql");
const rateLimitPath = path.resolve(__dirname, "..", "supabase", "migrations", "20260731033000_add_shared_api_rate_limits.sql");

function normalizedSql(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\s+/g, " ").trim().toLowerCase();
}

describe("WelcomeFlow workspace bootstrap safety", () => {
  test("keeps RLS enabled and revokes every anonymous write-capable table privilege", () => {
    const sql = normalizedSql(bootstrapPath);
    expect(sql).toContain("alter table public.welcomeflow_workspace_state enable row level security");
    expect(sql).toMatch(/revoke insert,\s*update,\s*delete,\s*truncate,\s*references,\s*trigger on table public\.welcomeflow_workspace_state from public, anon/);
    expect(sql).toContain("has_table_privilege('anon', 'public.welcomeflow_workspace_state', privilege_name)");
  });

  test("cannot recreate anonymous write policies or grants", () => {
    const sql = normalizedSql(bootstrapPath);
    expect(sql).not.toMatch(/create policy.{0,240}for (insert|update|delete).{0,120}to anon/);
    expect(sql).not.toMatch(/grant (insert|update|delete|select,\s*insert|all).{0,120}to anon/);
  });

  test("drops the same legacy policies as the containment migration", () => {
    const bootstrap = normalizedSql(bootstrapPath);
    const containment = normalizedSql(containmentPath);
    ["welcomeFlow prototype read", "welcomeFlow prototype insert", "welcomeFlow prototype update"].forEach((policy) => {
      const normalizedPolicy = policy.toLowerCase();
      expect(bootstrap).toContain(`drop policy if exists "${normalizedPolicy}"`);
      expect(containment).toContain(`drop policy if exists "${normalizedPolicy}"`);
    });
  });

  test("removes anonymous write policies even when their names are unknown", () => {
    [bootstrapPath, containmentPath].forEach((filePath) => {
      const sql = normalizedSql(filePath);
      expect(sql).toContain("from pg_policies");
      expect(sql).toMatch(/cmd in \('all', 'insert', 'update', 'delete'\)/);
      expect(sql).toMatch(/'public' = any\(roles\).*'anon' = any\(roles\)/);
      expect(sql).toContain("drop policy if exists %i on public.welcomeflow_workspace_state");
    });
  });

  test("optional containment helpers are guarded before revoke", () => {
    const sql = normalizedSql(containmentPath);
    expect(sql).toContain("to_regprocedure('public.rls_auto_enable()') is not null");
    expect(sql).toContain("exception when others then raise warning");
    expect(sql.indexOf("commit;")).toBeLessThan(sql.indexOf("optional cleanup runs after mandatory containment commits"));
  });

  test("final catalog assertions cover helper present, absent, and revoke-failure paths", () => {
    const sql = normalizedSql(containmentPath);
    expect(sql.match(/to_regprocedure\('public\.rls_auto_enable\(\)'\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(sql).toContain("has_function_privilege('anon', 'public.rls_auto_enable()', 'execute')");
    expect(sql).toContain("aclexplode(coalesce(p.proacl, acldefault('f', p.proowner)))");
    expect(sql).toContain("raise exception 'unsafe rls_auto_enable execute privilege remains'");
  });

  test("mandatory containment removes unknown PUBLIC policies and validates all write paths", () => {
    const sql = normalizedSql(containmentPath);
    expect(sql).toMatch(/'public' = any\(roles\).*'anon' = any\(roles\)/);
    ["insert", "update", "delete", "truncate", "references", "trigger"].forEach((privilege) => {
      expect(sql).toContain(`'${privilege}'`);
    });
    expect(sql).toContain("raise exception 'unsafe anonymous/public workspace write policy remains'");
  });

  test("shared API rate limits are atomic and callable only by the service role", () => {
    const sql = normalizedSql(rateLimitPath);
    expect(sql).toContain("security invoker");
    expect(sql).toContain("on conflict (action_name, subject_hash, window_bucket)");
    expect(sql).toContain("where limits.request_count < p_limit");
    expect(sql).toContain("revoke all privileges on function public.welcomeflow_consume_api_rate_limit(text, text, integer, integer) from public, anon, authenticated");
    expect(sql).toContain("grant execute on function public.welcomeflow_consume_api_rate_limit(text, text, integer, integer) to service_role");
  });
});
