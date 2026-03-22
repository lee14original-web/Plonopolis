"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!login || !password) {
      alert("Wpisz login i hasło");
      return;
    }

    router.push("/game");
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
        <div
          style={{
            display: "flex",
            overflow: "hidden",
            borderRadius: "12px",
            border: "1px solid rgba(180,120,30,0.35)",
            marginBottom: "24px",
          }}
        >
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
            Logowanie
          </div>

          <Link
            href="/register"
            style={{
              flex: 1,
              padding: "12px",
              textAlign: "center",
              background: "#3a2414",
              color: "#f6dc9a",
              fontWeight: 700,
            }}
          >
            Rejestracja
          </Link>
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
          Zaloguj się do swojej farmy
        </p>

        <form onSubmit={handleSubmit} style={{ marginTop: "24px", display: "grid", gap: "16px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "6px" }}>Login</label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

          <label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input type="checkbox" />
            <span>Zapamiętaj mnie</span>
          </label>

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
            Zaloguj się
          </button>
        </form>
      </section>
    </main>
  );
}
