import React, { useState, useEffect, useCallback } from "react";
import { getStoredUser, getStoredToken, clearAuth, type NerdStudioUser } from "./NerdStudioLogin";
import { listSessions, createSession, deleteSession, renameSession, syncFromServer, type SessionMeta } from "../data/sessionStore";

const FREE_MAX_CANVASES = 10;
const UPGRADE_URL = "https://nerdstudio.online/upgrade";

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
  const [membership, setMembership] = useState<string>("free");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
    setSessions(listSessions());
    syncFromServer().then(() => setSessions(listSessions()));
    // Check membership status
    checkMembership();
  }, []);

  const checkMembership = async () => {
    const token = getStoredToken();
    if (!token) return;
    try {
      const resp = await fetch("https://id.nerdstudio.online/api/me", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.membership === "premium" && data.membership_expires_at) {
          const expires = new Date(data.membership_expires_at);
          if (expires > new Date()) {
            setMembership("premium");
            return;
          }
        }
      }
    } catch {}
    setMembership("free");
  };

  const refresh = useCallback(() => {
    setSessions(listSessions());
    setTick((t) => t + 1);
  }, []);

  const handleCreate = () => {
    if (membership !== "premium" && sessions.length >= FREE_MAX_CANVASES) {
      setShowUpgradeModal(true);
      return;
    }
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

        {/* Upgrade banner for free users */}
        {membership !== "premium" && (
          <div style={styles.upgradeBanner}>
            <span style={{ flex: 1 }}>
              {sessions.length >= FREE_MAX_CANVASES
                ? `You've reached ${FREE_MAX_CANVASES} canvases. Upgrade to Pro for unlimited.`
                : `${sessions.length}/${FREE_MAX_CANVASES} canvases used · Upgrade to unlock unlimited`}
            </span>
            <a href={UPGRADE_URL} style={styles.upgradeBtn}>
              Upgrade
            </a>
          </div>
        )}

        {/* Main */}
        <main style={styles.main}>
          <div style={styles.toolbar}>
            <h2 style={styles.sectionTitle}>Your Drawings</h2>
            <button
              onClick={handleCreate}
              style={{
                ...styles.createBtn,
                ...(membership !== "premium" && sessions.length >= FREE_MAX_CANVASES
                  ? { opacity: 0.4, cursor: "not-allowed" }
                  : {}),
              }}
              title={
                membership !== "premium" && sessions.length >= FREE_MAX_CANVASES
                  ? "Upgrade to create more canvases"
                  : "Create New Canvas"
              }
            >
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

      {/* Upgrade modal */}
      {showUpgradeModal && (
        <div style={styles.modalOverlay} onClick={() => setShowUpgradeModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
              Upgrade to Nerd Studio Pro
            </h3>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 20, lineHeight: 1.6 }}>
              You've reached the free limit of {FREE_MAX_CANVASES} canvases.
              Get unlimited canvases, HD export, and all premium features across Nerd Studio.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowUpgradeModal(false)} style={styles.modalCancelBtn}>
                Maybe later
              </button>
              <a href={UPGRADE_URL} style={styles.modalUpgradeBtn}>
                Upgrade — Rp99K/mo
              </a>
            </div>
          </div>
        </div>
      )}
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
  upgradeBanner: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 16px",
    background: "rgba(34,197,94,0.08)",
    border: "1px solid rgba(34,197,94,0.15)",
    borderRadius: 8,
    marginBottom: 24,
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },
  upgradeBtn: {
    background: "rgba(34,197,94,0.15)",
    color: "#22c55e",
    border: "none",
    padding: "6px 14px",
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
    whiteSpace: "nowrap",
  },
  modalOverlay: {
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#1a1a2e",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 28,
    maxWidth: 420,
    width: "90%",
  },
  modalCancelBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "rgba(255,255,255,0.5)",
    padding: "8px 16px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
  },
  modalUpgradeBtn: {
    background: "#22c55e",
    color: "#000",
    border: "none",
    padding: "8px 18px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
  },
};
