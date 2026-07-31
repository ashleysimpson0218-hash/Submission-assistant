import fs from "fs";
import path from "path";

const bootstrapPath = path.resolve(__dirname, "..", "supabase-welcomeflow-state.sql");
const containmentPath = path.resolve(__dirname, "..", "supabase", "migrations", "20260717014305_contain_real_candidate_data.sql");

function normalizedSql(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/\s+/g, " ").trim().toLowerCase();
}

describe("WelcomeFlow workspace bootstrap safety", () => {
  test("keeps RLS enabled and revokes all anonymous table privileges", () => {
    const sql = normalizedSql(bootstrapPath);
    expect(sql).toContain("alter table public.welcomeflow_workspace_state enable row level security");
    expect(sql).toMatch(/revoke select,\s*insert,\s*update,\s*delete on table public\.welcomeflow_workspace_state from anon/);
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
});
