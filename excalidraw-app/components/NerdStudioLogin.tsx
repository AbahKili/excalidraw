import React, { useState, useEffect } from "react";

const IDP_ORIGIN = "https://id.nerdstudio.online";
const CLIENT_ID = "draw";
const CLIENT_SECRET = import.meta.env.VITE_CLIENT_SECRET || "";
const REDIRECT_URI = "https://draw.nerdstudio.online/auth/callback";
const STORAGE_KEY = "nerdstudio_token";
const USER_KEY = "nerdstudio_user";

export interface NerdStudioUser {
  id: string;
  email: string;
  name: string;
  avatar: string;
}

function generateState(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function getStoredUser(): NerdStudioUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function storeAuth(token: string, user: NerdStudioUser) {
  localStorage.setItem(STORAGE_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(USER_KEY);
}

async function exchangeCode(code: string): Promise<{
  token: string;
  user: NerdStudioUser;
} | null> {
  try {
    const resp = await fetch(`${IDP_ORIGIN}/api/token/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    return { token: data.token, user: data.user };
  } catch {
    return null;
  }
}

export async function verifyToken(
  token: string,
): Promise<NerdStudioUser | null> {
  try {
    const resp = await fetch(`${IDP_ORIGIN}/api/token/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.valid ? data.user : null;
  } catch {
    return null;
  }
}

function handleSignIn() {
  const state = generateState();
  sessionStorage.setItem("nerdstudio_oauth_state", state);
  const url = `${IDP_ORIGIN}/api/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}`;
  window.location.href = url;
}

export const NerdStudioLogin: React.FC<{ onAuthenticated: () => void }> = ({
  onAuthenticated,
}) => {
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const init = async () => {
      // Handle OAuth callback
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const storedState = sessionStorage.getItem("nerdstudio_oauth_state");

      if (code && state && state === storedState) {
        sessionStorage.removeItem("nerdstudio_oauth_state");
        // Clean URL
        window.history.replaceState({}, "", "/");

        const result = await exchangeCode(code);
        if (result) {
          storeAuth(result.token, result.user);
          onAuthenticated();
          return;
        }
        setError("Authentication failed. Please try again.");
      }

      // Check existing token
      const token = getStoredToken();
      if (token) {
        const user = await verifyToken(token);
        if (user) {
          // Update stored user info
          storeAuth(token, user);
          onAuthenticated();
          return;
        }
        // Token invalid, clear it
        clearAuth();
      }

      setChecking(false);
    };

    init();
  }, [onAuthenticated]);

  if (checking) {
    return (
      <div style={styles.container}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Checking authentication...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <svg width="64" height="64" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="8" fill="#121212" />
            <text
              x="20"
              y="27"
              textAnchor="middle"
              fontSize="22"
              fontWeight="700"
              fill="#fff"
              fontFamily="system-ui, sans-serif"
            >
              N
            </text>
          </svg>
        </div>

        <h1 style={styles.title}>Nerd Studio Draw</h1>
        <p style={styles.subtitle}>
          Sketch diagrams with a hand-drawn feel.
          <br />
          Sign in with your Nerd Studio account to get started.
        </p>

        <button onClick={handleSignIn} style={styles.button}>
          <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Nerd Studio
        </button>

        {error && <p style={styles.error}>{error}</p>}

        <p style={styles.footer}>
          Powered by Nerd Studio IDP
        </p>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    width: "100vw",
    background: "linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #121212 100%)",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  card: {
    textAlign: "center",
    padding: "48px 40px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.04)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.08)",
    maxWidth: 400,
    width: "100%",
  },
  logo: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: "#fff",
    margin: "0 0 8px",
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 1.6,
    margin: "0 0 32px",
  },
  button: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 28px",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 8,
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "background 0.2s",
  },
  error: {
    marginTop: 20,
    color: "#ef4444",
    fontSize: 13,
  },
  footer: {
    marginTop: 32,
    fontSize: 11,
    color: "rgba(255,255,255,0.2)",
  },
  spinner: {
    width: 32,
    height: 32,
    border: "3px solid rgba(255,255,255,0.1)",
    borderTopColor: "rgba(255,255,255,0.5)",
    borderRadius: "50%",
    animation: "nerdstudio-spin 0.8s linear infinite",
  },
  loadingText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    marginTop: 16,
  },
};
