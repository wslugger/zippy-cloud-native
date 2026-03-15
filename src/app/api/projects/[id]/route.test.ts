import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    projectItem: { findMany: vi.fn() },
    solutionSite: { findMany: vi.fn() },
    projectRequirementDocument: { findMany: vi.fn() },
    projectRecommendation: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

type MockFn = ReturnType<typeof vi.fn>;
type PrismaMock = {
  project: {
    findFirst: MockFn;
  };
  projectItem: { findMany: MockFn };
  solutionSite: { findMany: MockFn };
  projectRequirementDocument: { findMany: MockFn };
  projectRecommendation: { findMany: MockFn };
};

const mockedGetSession = vi.mocked(getSession);
const mockedPrisma = prisma as unknown as PrismaMock;

const baseProject = {
  id: "project-1",
  name: "Project One",
  customerName: "ACME",
  status: "DRAFT",
  workflowStage: "PROJECT_CREATED",
  termMonths: 12,
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  updatedAt: new Date("2026-03-01T00:00:00.000Z"),
  rawRequirements: null,
  manualNotes: null,
  userId: "user-1",
};

describe("GET /api/projects/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when no session exists", async () => {
    mockedGetSession.mockResolvedValueOnce(null);

    const response = await GET({} as NextRequest, { params: Promise.resolve({ id: "project-1" }) });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mockedPrisma.project.findFirst).not.toHaveBeenCalled();
  });

  it("returns 404 when project is not found", async () => {
    mockedGetSession.mockResolvedValueOnce({ userId: "user-1", email: "a@b.com", role: "SA" });
    mockedPrisma.project.findFirst.mockResolvedValueOnce(null);

    const response = await GET({} as NextRequest, { params: Promise.resolve({ id: "project-1" }) });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Project not found" });
    expect(mockedPrisma.projectItem.findMany).not.toHaveBeenCalled();
  });

  it("returns 200 and empty recommendations when one downstream query fails", async () => {
    mockedGetSession.mockResolvedValueOnce({ userId: "user-1", email: "a@b.com", role: "SA" });
    mockedPrisma.project.findFirst.mockResolvedValueOnce(baseProject);
    mockedPrisma.projectItem.findMany.mockResolvedValueOnce([{ id: "item-1" }]);
    mockedPrisma.solutionSite.findMany.mockResolvedValueOnce([{ id: "site-1" }]);
    mockedPrisma.projectRequirementDocument.findMany.mockResolvedValueOnce([{ id: "doc-1" }]);
    mockedPrisma.projectRecommendation.findMany.mockRejectedValueOnce(new Error("db unavailable"));

    const response = await GET({} as NextRequest, { params: Promise.resolve({ id: "project-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toEqual([{ id: "item-1" }]);
    expect(body.sites).toEqual([{ id: "site-1" }]);
    expect(body.requirementDocs).toEqual([{ id: "doc-1" }]);
    expect(body.recommendations).toEqual([]);
  });

  it("returns 200 with all sections when all queries succeed", async () => {
    mockedGetSession.mockResolvedValueOnce({ userId: "user-1", email: "a@b.com", role: "SA" });
    mockedPrisma.project.findFirst.mockResolvedValueOnce(baseProject);
    mockedPrisma.projectItem.findMany.mockResolvedValueOnce([{ id: "item-1" }]);
    mockedPrisma.solutionSite.findMany.mockResolvedValueOnce([{ id: "site-1" }]);
    mockedPrisma.projectRequirementDocument.findMany.mockResolvedValueOnce([{ id: "doc-1" }]);
    mockedPrisma.projectRecommendation.findMany.mockResolvedValueOnce([{ id: "rec-1" }]);

    const response = await GET({} as NextRequest, { params: Promise.resolve({ id: "project-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: "project-1",
      items: [{ id: "item-1" }],
      sites: [{ id: "site-1" }],
      requirementDocs: [{ id: "doc-1" }],
      recommendations: [{ id: "rec-1" }],
    });
  });
});
