import Link from "next/link";
import { AccountForm } from "@/components/account-form";
export default function Signup() {
  return (
    <main className="auth">
      <section className="auth-art">
        <div className="brand">
          <span className="brand-mark">A</span>AssetFlow
        </div>
        <div>
          <div className="eyebrow" style={{ color: "#b8d3c7" }}>
            Employee onboarding
          </div>
          <h1 className="display">
            Join your
            <br />
            organization’s
            <br />
            asset workspace.
          </h1>
          <p>
            Signup always grants Employee access only. Administrators control
            elevated roles.
          </p>
        </div>
      </section>
      <section className="auth-card">
        <div className="login-box">
          <div className="eyebrow">New employee</div>
          <h2>Create your account</h2>
          <AccountForm mode="signup" />
          <p className="subtle">
            <Link href="/login">Return to sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
