import { AccountForm } from "@/components/account-form";
export default async function Reset({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main className="auth-card" style={{ minHeight: "100vh" }}>
      <div className="login-box">
        <h1>Choose a new password</h1>
        <AccountForm mode="reset" token={token} />
      </div>
    </main>
  );
}
