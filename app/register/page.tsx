import Link from "next/link";

export default function RegisterPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#120b06",
        padding: "16px",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "rgba(26,15,7,0.95)",
          border: "1px solid rgba(120,80,20,0.5)",
          borderRadius: "20px",
          padding: "28px",
        }}
      >
        <div
          style={{
            display: "flex",
            overflow: "hidden",
            borderRadius: "12px",
            border: "1px solid rgba(180,120,30,0.35)",
            marginBottom: "24px",
          }}
        >
          <Link
            href="/login"
            style={{
              flex: 1,
              padding: "12px",
              textAlign: "center",
              background: "#3a2414",
              color: "#f6dc9a",
              fontWeight: 700,
            }}
          >
            Logowanie
          </Link>

          <div
            style={{
              flex: 1,
              padding: "12px",
              textAlign: "center",
              background: "linear-gradient(#f4dfa3, #d6a22b)",
              color: "#1a1208",
              fontWeight: 700,
            }}
          >
            Rejestracja
          </div>
        </div>

        <h1 style={{ margin: 0, textAlign: "center", color: "#f6dc9a" }}>
          Plonopolis
        </h1>

        <p
          style={{
            marginTop: "8px",
            textAlign: "center",
            color: "rgba(245,231,200,0.75)",
          }}
        >
          Załóż konto i zacznij rozwijać farmę
        </p>

        <form style={{ marginTop: "24px", display: "grid", gap: "16px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "6px" }}>Login</label>
            <input
              type="text"
              style={{
                width: "100%",
                borderRadius: "10px",
                border: "none",
                padding: "12px",
                background: "#d9cbb3",
                color: "#111",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "6px" }}>Email</label>
            <input
              type="email"
              style={{
                width: "100%",
                borderRadius: "10px",
                border: "none",
                padding: "12px",
                background: "#d9cbb3",
                color: "#111",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "6px" }}>Hasło</label>
            <input
              type="password"
              style={{
                width: "100%",
                borderRadius: "10px",
                border: "none",
                padding: "12px",
                background: "#d9cbb3",
                color: "#111",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "6px" }}>
              Powtórz hasło
            </label>
            <input
              type="password"
              style={{
                width: "100%",
                borderRadius: "10px",
                border: "none",
                padding: "12px",
                background: "#d9cbb3",
                color: "#111",
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              border: "none",
              borderRadius: "12px",
              padding: "14px",
              background: "linear-gradient(#f0b63f, #b87413)",
              color: "#fff7df",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Zarejestruj się
          </button>
        </form>
      </section>
    </main>
  );
}
