import React, { useState, useCallback, useEffect } from "react";

declare global {
  interface Window {
    google: any;
    gapi: any;
    _nerdstudioGoogleUser: GoogleUser | null;
  }
}

export interface GoogleUser {
  name: string;
  email: string;
  picture: string;
  accessToken: string;
}

const CLIENT_ID = import.meta.env.VITE_APP_GOOGLE_CLIENT_ID || "";
const API_KEY = import.meta.env.VITE_APP_GOOGLE_API_KEY || "";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

// ── API loader helpers ────────────────────────────────────────────────

function loadGoogleApi(): Promise<void> {
  return new Promise((resolve) => {
    if (window.gapi) return resolve();
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

function loadGoogleIdentity(): Promise<void> {
  return new Promise((resolve) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

async function fetchUserInfo(token: string): Promise<GoogleUser | null> {
  try {
    const resp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return {
      name: data.name,
      email: data.email,
      picture: data.picture,
      accessToken: token,
    };
  } catch {
    return null;
  }
}

// ── Auth ──────────────────────────────────────────────────────────────

export async function googleSignIn(): Promise<GoogleUser | null> {
  if (!CLIENT_ID) return null;
  await loadGoogleIdentity();

  return new Promise((resolve) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: `openid profile email ${SCOPES}`,
      callback: async (resp: any) => {
        if (resp.error) {
          console.error("Google sign-in error:", resp.error);
          resolve(null);
          return;
        }
        const user = await fetchUserInfo(resp.access_token);
        if (user) window._nerdstudioGoogleUser = user;
        resolve(user);
      },
    });
    client.requestAccessToken();
  });
}

export function googleSignOut() {
  window._nerdstudioGoogleUser = null;
  const token = window.google?.accounts?.oauth2?.revoke;
  // Clear any stored token
  if (window.google?.accounts?.id) {
    window.google.accounts.id.disableAutoSelect();
  }
}

export function getGoogleUser(): GoogleUser | null {
  return window._nerdstudioGoogleUser || null;
}

async function getToken(): Promise<string | null> {
  if (window._nerdstudioGoogleUser?.accessToken) {
    return window._nerdstudioGoogleUser.accessToken;
  }
  const user = await googleSignIn();
  return user?.accessToken || null;
}

// ── Drive operations ──────────────────────────────────────────────────

export async function saveToGoogleDrive(
  data: string,
  filename: string,
): Promise<boolean> {
  const token = await getToken();
  if (!token || !CLIENT_ID) return false;

  const boundary = "excalidraw-boundary";
  const metadata = {
    name: filename.endsWith(".excalidraw") ? filename : `${filename}.excalidraw`,
    mimeType: "application/json",
  };

  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: application/json",
    "",
    data,
    `--${boundary}--`,
  ].join("\r\n");

  const resp = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  return resp.ok;
}

export async function openFromGoogleDrive(): Promise<{
  name: string;
  data: string;
} | null> {
  if (!CLIENT_ID || !API_KEY) return null;

  const token = await getToken();
  if (!token) return null;

  await loadGoogleApi();
  await new Promise<void>((resolve) => window.gapi.load("picker", resolve));

  return new Promise((resolve) => {
    const picker = new window.google.picker.PickerBuilder()
      .addView(
        new window.google.picker.DocsView()
          .setIncludeFolders(true)
          .setMimeTypes("application/json"),
      )
      .setOAuthToken(token)
      .setDeveloperKey(API_KEY)
      .setCallback(async (data: any) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const doc = data.docs[0];
          const resp = await fetch(
            `https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          const content = await resp.text();
          resolve({ name: doc.name, data: content });
        } else {
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });
}

// ── Sign-In Button Component ──────────────────────────────────────────

export const GoogleSignInButton: React.FC = () => {
  const [user, setUser] = useState<GoogleUser | null>(
    window._nerdstudioGoogleUser || null,
  );
  const [loading, setLoading] = useState(false);

  if (!CLIENT_ID) return null;

  const handleSignIn = async () => {
    setLoading(true);
    const u = await googleSignIn();
    if (u) setUser(u);
    setLoading(false);
  };

  const handleSignOut = () => {
    googleSignOut();
    setUser(null);
  };

  if (user) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px" }}>
        <img
          src={user.picture}
          alt={user.name}
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: "2px solid var(--color-border)",
          }}
        />
        <span style={{ fontSize: 13, color: "var(--color-text)" }}>
          {user.name.split(" ")[0]}
        </span>
        <button
          onClick={handleSignOut}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-text-muted)",
            cursor: "pointer",
            fontSize: 12,
            padding: 0,
          }}
          title="Sign out"
        >
          &times;
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleSignIn}
      disabled={loading}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 14px",
        border: "1px solid var(--color-border)",
        borderRadius: 6,
        background: "#fff",
        color: "#1f1f1f",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      {loading ? "Signing in..." : "Sign in with Google"}
    </button>
  );
};

// ── Drive Buttons (only shown when signed in) ─────────────────────────

export const GoogleDriveButtons: React.FC<{
  onSave: () => void;
  onOpen: (data: string, name: string) => void;
}> = ({ onSave, onOpen }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const user = window._nerdstudioGoogleUser;

  if (!CLIENT_ID || !user) return null;

  const handleSave = async () => {
    setLoading(true);
    setError("");
    try {
      onSave();
    } catch (e: any) {
      setError(e.message || "Save failed");
    }
    setLoading(false);
  };

  const handleOpen = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await openFromGoogleDrive();
      if (result) onOpen(result.data, result.name);
    } catch (e: any) {
      setError(e.message || "Open failed");
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: "0 12px" }}>
      <button
        onClick={handleOpen}
        disabled={loading}
        style={{
          display: "block",
          width: "100%",
          padding: "8px 12px",
          marginBottom: 8,
          border: "1px solid var(--color-border)",
          borderRadius: 6,
          background: "var(--color-surface-low)",
          color: "var(--color-text)",
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        Open from Google Drive
      </button>
      <button
        onClick={handleSave}
        disabled={loading}
        style={{
          display: "block",
          width: "100%",
          padding: "8px 12px",
          border: "1px solid var(--color-border)",
          borderRadius: 6,
          background: "var(--color-surface-low)",
          color: "var(--color-text)",
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        Save to Google Drive
      </button>
      {error && (
        <div style={{ color: "var(--color-error)", fontSize: 12, marginTop: 8 }}>
          {error}
        </div>
      )}
    </div>
  );
};
