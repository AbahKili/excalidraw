const SESSIONS_KEY = "nerdstudio_sessions";
const ACTIVE_SESSION_KEY = "nerdstudio_active_session";

const API_BASE = "/api/draw";

export interface SessionMeta {
  id: string;
  title: string;
  lastModified: string; // ISO timestamp
}

export interface Session extends SessionMeta {
  sceneData: string | null; // serialized JSON of elements + appState
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function getToken(): string | null {
  return localStorage.getItem("nerdstudio_token");
}

async function api(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<Response | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const opts: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    };
    if (body) opts.body = JSON.stringify(body);
    return await fetch(`${API_BASE}${path}`, opts);
  } catch {
    return null;
  }
}

function getAll(): Session[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(sessions: Session[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function listSessions(): SessionMeta[] {
  return getAll().map(({ id, title, lastModified }) => ({ id, title, lastModified }));
}

// Pull sessions from server and merge into localStorage (server is source of truth)
export async function syncFromServer(): Promise<void> {
  const resp = await api("GET", "/sessions");
  if (!resp || !resp.ok) return;
  try {
    const serverList: { id: string; title: string; lastModified: string }[] =
      await resp.json();
    const local = getAll();
    const localMap = new Map(local.map((s) => [s.id, s]));
    const merged: Session[] = [];

    for (const s of serverList) {
      const existing = localMap.get(s.id);
      if (existing) {
        // Keep whichever is newer
        const serverDate = new Date(s.lastModified).getTime();
        const localDate = new Date(existing.lastModified).getTime();
        merged.push(serverDate >= localDate ? { ...existing, ...s, sceneData: existing.sceneData } : existing);
        localMap.delete(s.id);
      } else {
        merged.push({ ...s, sceneData: null });
      }
    }
    // Append any local-only sessions (offline-created) that aren't on server yet
    for (const remaining of localMap.values()) {
      merged.unshift(remaining);
    }
    saveAll(merged);
  } catch { /* ignore */ }
}

export function createSession(title?: string): Session {
  const session: Session = {
    id: generateId(),
    title: title || "Untitled Canvas",
    lastModified: new Date().toISOString(),
    sceneData: null,
  };
  const sessions = getAll();
  sessions.unshift(session);
  saveAll(sessions);
  // Push to server (fire-and-forget)
  api("POST", "/sessions", {
    session_id: session.id,
    title: session.title,
    scene_data: session.sceneData,
  });
  return session;
}

export function getSession(id: string): Session | null {
  return getAll().find((s) => s.id === id) || null;
}

export function updateSession(
  id: string,
  updates: Partial<Pick<Session, "title" | "sceneData">>,
) {
  const sessions = getAll();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return;
  sessions[idx] = { ...sessions[idx], ...updates, lastModified: new Date().toISOString() };
  saveAll(sessions);
  // Push to server (fire-and-forget)
  const body: Record<string, unknown> = {};
  if (updates.title !== undefined) body.title = updates.title;
  if (updates.sceneData !== undefined) body.scene_data = updates.sceneData;
  if (Object.keys(body).length) api("PUT", `/sessions/${id}`, body);
}

export function renameSession(id: string, title: string) {
  updateSession(id, { title });
}

export function deleteSession(id: string) {
  const sessions = getAll().filter((s) => s.id !== id);
  saveAll(sessions);
  if (getActiveSessionId() === id) {
    clearActiveSession();
  }
  // Push delete to server (fire-and-forget)
  api("DELETE", `/sessions/${id}`);
}

export function setActiveSessionId(id: string | null) {
  if (id) {
    localStorage.setItem(ACTIVE_SESSION_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  }
}

export function getActiveSessionId(): string | null {
  return localStorage.getItem(ACTIVE_SESSION_KEY);
}

export function clearActiveSession() {
  localStorage.removeItem(ACTIVE_SESSION_KEY);
}
