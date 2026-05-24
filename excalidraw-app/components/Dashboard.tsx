import React, { useState, useEffect, useCallback } from "react";
import { getStoredUser, clearAuth, type NerdStudioUser } from "./NerdStudioLogin";
import { listSessions, createSession, deleteSession, renameSession, syncFromServer, type SessionMeta } from "../data/sessionStore";

interface DashboardProps {
  onNewCanvas: (sessionId: string) => void;
  onOpenCanvas: (sessionId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNewCanvas, onOpenCanvas }) => {
  const [user, setUser] = useState<NerdStudioUser | null>(null);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [, setTick] = useState(0);

  useEffect(() => {
    setUser(getStoredUser());
    setSessions(listSessions());
    // Pull latest from server in background
    syncFromServer().then(() => setSessions(listSessions()));
  }, []);

  const refresh = useCallback(() => {
    setSessions(listSessions());
    setTick((t) => t + 1);
  }, []);

  const handleCreate = () => {
    const session = createSession();
    refresh();
    onNewCanvas(session.id);
  };

  const handleOpen = (id: string) => {
    onOpenCanvas(id);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this canvas? This action cannot be undone.")) {
      deleteSession(id);
      refresh();
    }
  };

  const handleRenameStart = (session: SessionMeta) => {
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleRenameSubmit = (id: string) => {
    if (editTitle.trim()) {
      renameSession(id, editTitle.trim());
      refresh();
    }
    setEditingId(null);
  };

  const handleLogout = () => {
    clearAuth();
    window.location.reload();
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return "Just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="8" fill="#fff" opacity="0.9" />
              <text x="20" y="27" textAnchor="middle" fontSize="22" fontWeight="700" fill="#121212" fontFamily="system-ui">N</text>
            </svg>
            <h1 style={styles.title}>Nerd Studio Draw</h1>
          </div>
          <div style={styles.headerRight}>
            {user && (
              <>
                <img src={user.avatar} alt="" style={styles.avatar} />
                <span style={styles.userName}>{user.name}</span>
              </>
            )}
            <button onClick={handleLogout} style={styles.logoutBtn}>Sign out</button>
          </div>
        </header>

        {/* Main */}
        <main style={styles.main}>
          <div style={styles.toolbar}>
            <h2 style={styles.sectionTitle}>Your Drawings</h2>
            <button onClick={handleCreate} style={styles.createBtn}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>+</span>
              <span>Create New Canvas</span>
            </button>
          </div>

          {sessions.length === 0 ? (
            <div style={styles.empty}>
              <p style={styles.emptyText}>No drawings yet.</p>
              <p style={styles.emptyHint}>Create your first canvas to get started.</p>
            </div>
          ) : (
            <div style={styles.grid}>
              {sessions.map((session) => (
                <div
                  key={session.id}
                  style={styles.card}
                  onClick={() => {
                    if (editingId !== session.id) handleOpen(session.id);
                  }}
                >
                  <div style={styles.cardPreview}>
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect width="48" height="48" rx="6" fill="rgba(255,255,255,0.06)" />
                      <path d="M14 18h20M14 24h14M14 30h8" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div style={styles.cardInfo}>
                    {editingId === session.id ? (
                      <input
                        style={styles.editInput}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => handleRenameSubmit(session.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameSubmit(session.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div style={styles.cardTitle}>{session.title}</div>
                    )}
                    <div style={styles.cardDate}>{formatDate(session.lastModified)}</div>
                  </div>
                  <div style={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                    <button
                      style={styles.actionBtn}
                      title="Rename"
                      onClick={() => handleRenameStart(session)}
                    >
                      ✎
                    </button>
                    <button
                      style={styles.actionBtn}
                      title="Delete"
                      onClick={() => handleDelete(session.id)}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #121212 100%)",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#fff",
  },
  container: {
    maxWidth: 960,
    margin: "0 auto",
    padding: "0 24px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 0",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 32,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    margin: 0,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
  },
  userName: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },
  logoutBtn: {
    background: "none",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "rgba(255,255,255,0.5)",
    padding: "6px 12px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 12,
  },
  main: {
    paddingBottom: 48,
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "rgba(255,255,255,0.7)",
    margin: 0,
  },
  createBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 20px",
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 8,
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s",
  },
  empty: {
    textAlign: "center",
    padding: "80px 0",
  },
  emptyText: {
    fontSize: 18,
    color: "rgba(255,255,255,0.3)",
    margin: "0 0 8px",
  },
  emptyHint: {
    fontSize: 14,
    color: "rgba(255,255,255,0.15)",
    margin: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 16,
  },
  card: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "16px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 10,
    cursor: "pointer",
    transition: "background 0.15s, border-color 0.15s",
  },
  cardPreview: {
    flexShrink: 0,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  cardDate: {
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
    marginTop: 4,
  },
  editInput: {
    fontSize: 14,
    fontWeight: 600,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 4,
    color: "#fff",
    padding: "2px 6px",
    width: "100%",
    outline: "none",
  },
  cardActions: {
    display: "flex",
    gap: 4,
    flexShrink: 0,
  },
  actionBtn: {
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.3)",
    cursor: "pointer",
    fontSize: 16,
    padding: "4px 6px",
    borderRadius: 4,
    transition: "color 0.15s",
  },
};
