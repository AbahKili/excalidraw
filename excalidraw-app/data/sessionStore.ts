const SESSIONS_KEY = "nerdstudio_sessions";
const ACTIVE_SESSION_KEY = "nerdstudio_active_session";

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
  return session;
}

export function getSession(id: string): Session | null {
  return getAll().find((s) => s.id === id) || null;
}

export function updateSession(id: string, updates: Partial<Pick<Session, "title" | "sceneData">>) {
  const sessions = getAll();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return;
  sessions[idx] = { ...sessions[idx], ...updates, lastModified: new Date().toISOString() };
  saveAll(sessions);
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
