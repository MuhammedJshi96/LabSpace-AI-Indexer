import type { Request, Response } from "express";
import { MemoryProjectRepository } from "./repository";
import { createPublicShowcaseProject } from "./public-showcase";

const SESSION_COOKIE = "labspace_judge_session";
const SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const MAX_SESSIONS = 250;
const SESSION_ID_PATTERN = /^[0-9a-f-]{36}$/i;

type SessionEntry = {
  repository: MemoryProjectRepository;
  touchedAt: number;
};

function readCookie(header: string | undefined, name: string) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName !== name) continue;
    try {
      return decodeURIComponent(rawValue.join("="));
    } catch {
      return null;
    }
  }
  return null;
}

export class PublicDemoSessionStore {
  private readonly sessions = new Map<string, SessionEntry>();

  constructor(private readonly secureCookies: boolean) {}

  getRepository(request: Request, response: Response, now = Date.now()) {
    this.removeExpired(now);
    const cookieSessionId = readCookie(request.headers.cookie, SESSION_COOKIE);
    const sessionId =
      cookieSessionId && SESSION_ID_PATTERN.test(cookieSessionId)
        ? cookieSessionId
        : crypto.randomUUID();

    let entry = this.sessions.get(sessionId);
    if (!entry) {
      this.makeRoom();
      entry = {
        repository: new MemoryProjectRepository(createPublicShowcaseProject),
        touchedAt: now,
      };
      this.sessions.set(sessionId, entry);
    } else {
      entry.touchedAt = now;
    }

    if (cookieSessionId !== sessionId) {
      response.cookie(SESSION_COOKIE, sessionId, {
        httpOnly: true,
        sameSite: "lax",
        secure: this.secureCookies,
        path: "/",
        maxAge: SESSION_TTL_MS,
      });
    }

    return entry.repository;
  }

  get size() {
    return this.sessions.size;
  }

  close() {
    for (const entry of this.sessions.values()) entry.repository.close();
    this.sessions.clear();
  }

  private removeExpired(now: number) {
    for (const [sessionId, entry] of this.sessions) {
      if (now - entry.touchedAt <= SESSION_TTL_MS) continue;
      entry.repository.close();
      this.sessions.delete(sessionId);
    }
  }

  private makeRoom() {
    if (this.sessions.size < MAX_SESSIONS) return;
    const oldest = [...this.sessions.entries()].sort(
      ([, left], [, right]) => left.touchedAt - right.touchedAt,
    )[0];
    if (!oldest) return;
    oldest[1].repository.close();
    this.sessions.delete(oldest[0]);
  }
}
