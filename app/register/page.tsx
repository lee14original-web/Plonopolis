"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();

  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!login || !email || !password || !repeatPassword) {
      alert("Uzupełnij wszystkie pola");
      return;
    }

    if (password !== repeatPassword) {
      alert("Hasła się nie zgadzają");
      return;
    }

    // tymczasowo przechodzimy do logowania
    router.push("/login");
  }

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
        {/* TABS */}
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

        {/* HEADER */}
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
          Załóż konto i zacznij farmę
        </p>

        {/* FORM */}
        <form onSubmit={handleSubmit} style={{ marginTop: "24px", display: "grid", gap: "16px" }}>
          <div>
            <label>Login</label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                background: "#d9cbb3",
              }}
            />
          </div>

          <div>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                background: "#d9cbb3",
              }}
            />
          </div>

          <div>
            <label>Hasło</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                background: "#d9cbb3",
              }}
            />
          </div>

          <div>
            <label>Powtórz hasło</label>
            <input
              type="password"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                background: "#d9cbb3",
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              padding: "14px",
              borderRadius: "12px",
              background: "linear-gradient(#f0b63f, #b87413)",
              fontWeight: 700,
              border: "none",
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
