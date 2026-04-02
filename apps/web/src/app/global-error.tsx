"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#ffffff",
          color: "#171717",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "2rem",
          textAlign: "center",
          gap: "1.5rem",
        }}
      >
        <strong style={{ fontSize: "1.4rem", fontWeight: 700 }}>Vishu</strong>
        <div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#6b7280", margin: 0 }}>
            A critical error occurred. Please reload the page.
          </p>
        </div>
        <button
          onClick={reset}
          style={{
            background: "#171717",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            padding: "0.5rem 1.25rem",
            cursor: "pointer",
            fontSize: "0.9rem",
            fontWeight: 600,
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
