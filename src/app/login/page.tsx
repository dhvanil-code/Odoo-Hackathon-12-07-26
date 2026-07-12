import { signIn } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
export default function Login() {
  async function login(formData: FormData) {
    "use server";
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });
    redirect("/dashboard");
  }
  return (
    <main className="auth">
      <section className="auth-art">
        <div className="brand">
          <span className="brand-mark">A</span>AssetFlow
        </div>
        <div>
          <div className="eyebrow" style={{ color: "#b8d3c7" }}>
            One operational truth
          </div>
          <h1 className="display">
            Every asset.
            <br />
            Exactly where
            <br />
            it should be.
          </h1>
          <p style={{ color: "#b9cbc3", maxWidth: 500 }}>
            Control allocations, shared resources, maintenance, audits and
            lifecycle decisions from one accountable workspace.
          </p>
        </div>
        <small style={{ color: "#8eaaa0" }}>
          Enterprise Asset & Resource Management
        </small>
      </section>
      <section className="auth-card">
        <div className="login-box">
          <div className="brand">
            <span className="brand-mark">A</span>AssetFlow
          </div>
          <div style={{ margin: "48px 0 30px" }}>
            <div className="eyebrow">Welcome back</div>
            <h2
              style={{ fontSize: 34, letterSpacing: "-.04em", margin: "8px 0" }}
            >
              Sign in to your workspace
            </h2>
            <p className="subtle">
              Use your organization credentials to continue.
            </p>
          </div>
          <form action={login}>
            <label className="field">
              Work email
              <input
                className="input"
                name="email"
                type="email"
                defaultValue="admin@assetflow.local"
                required
              />
            </label>
            <label className="field">
              Password
              <input
                className="input"
                name="password"
                type="password"
                defaultValue="AssetFlowDemo!2026"
                required
                minLength={8}
              />
            </label>
            <button className="btn" style={{ width: "100%", marginTop: 12 }}>
              Sign in securely
            </button>
          </form>
          <div
            className="toolbar"
            style={{ justifyContent: "space-between", marginTop: 16 }}
          >
            <Link className="subtle" href="/forgot-password">
              Forgot password?
            </Link>
            <Link className="subtle" href="/signup">
              Create employee account
            </Link>
          </div>
          <p className="subtle" style={{ marginTop: 22 }}>
            Demo accounts use <b>AssetFlowDemo!2026</b>. Signup always creates
            an Employee role.
          </p>
        </div>
      </section>
    </main>
  );
}
