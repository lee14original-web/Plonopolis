import Link from "next/link";

export default function Page() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), #120b06",
        padding: "16px",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "560px",
          background: "rgba(26,15,7,0.95)",
          border: "1px solid rgba(120,80,20,0.5)",
          borderRadius: "20px",
          padding: "32px",
          textAlign: "center",
          boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "48px",
            color: "#f6dc9a",
          }}
        >
          Plonopolis
        </h1>

        <p
          style={{
            marginTop: "16px",
            color: "rgba(245,231,200,0.85)",
            fontSize: "18px",
          }}
        >
          Zbuduj swoją farmę, rozwijaj sad i opiekuj się zwierzętami.
        </p>

        <div
          style={{
            marginTop: "28px",
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/login"
            style={{
              padding: "14px 24px",
              borderRadius: "12px",
              background: "linear-gradient(#f4dfa3, #d6a22b)",
              color: "#1a1208",
              fontWeight: 700,
            }}
          >
            Logowanie
          </Link>

          <Link
            href="/register"
            style={{
              padding: "14px 24px",
              borderRadius: "12px",
              background: "#3a2414",
              color: "#f6dc9a",
              fontWeight: 700,
              border: "1px solid rgba(180,120,30,0.35)",
            }}
          >
            Rejestracja
          </Link>
        </div>
      </section>
    </main>
  );
}
