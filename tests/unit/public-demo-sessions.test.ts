import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { PublicDemoSessionStore } from "../../server/public-demo-sessions";
import { createPublicShowcaseProject } from "../../server/public-showcase";

function request(cookie?: string) {
  return { headers: { cookie } } as Request;
}

function response() {
  const cookie = vi.fn();
  return { value: { cookie } as unknown as Response, cookie };
}

describe("public judge demo sessions", () => {
  it("reuses one visitor workspace while isolating a second visitor", () => {
    const sessions = new PublicDemoSessionStore(false);
    const firstResponse = response();
    const first = sessions.getRepository(request(), firstResponse.value, 1_000);
    const cookieCall = firstResponse.cookie.mock.calls[0];
    const sessionId = String(cookieCall[1]);
    const firstProject = first.getActiveProject();
    firstProject.name = "Judge A workspace";
    first.saveProject(firstProject);

    const sameVisitor = sessions.getRepository(
      request(`labspace_judge_session=${sessionId}`),
      response().value,
      2_000,
    );
    const secondVisitor = sessions.getRepository(request(), response().value, 2_000);

    expect(sameVisitor.getActiveProject().name).toBe("Judge A workspace");
    expect(secondVisitor.getActiveProject()).toEqual(createPublicShowcaseProject());
    expect(sessions.size).toBe(2);
    expect(cookieCall[2]).toMatchObject({ httpOnly: true, sameSite: "lax", secure: false });
    sessions.close();
  });

  it("expires inactive visitor workspaces", () => {
    const sessions = new PublicDemoSessionStore(false);
    const firstResponse = response();
    sessions.getRepository(request(), firstResponse.value, 1_000);
    const sessionId = String(firstResponse.cookie.mock.calls[0][1]);

    const refreshed = sessions.getRepository(
      request(`labspace_judge_session=${sessionId}`),
      response().value,
      4 * 60 * 60 * 1000 + 1_001,
    );

    expect(refreshed.getActiveProject()).toEqual(createPublicShowcaseProject());
    expect(sessions.size).toBe(1);
    sessions.close();
  });
});
