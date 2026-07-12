import Link from "next/link";
import { AccountForm } from "@/components/account-form";
export default function Forgot() {
  return (
    <main className="auth-card" style={{ minHeight: "100vh" }}>
      <div className="login-box">
        <div className="brand">
          <span className="brand-mark">A</span>AssetFlow
        </div>
        <h1>Reset your password</h1>
        <p className="subtle">
          We return the same response whether an account exists.
        </p>
        <AccountForm mode="forgot" />
        <p className="subtle">
          <Link href="/login">Return to sign in</Link>
        </p>
      </div>
    </main>
  );
}
