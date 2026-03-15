import { NextRequest, NextResponse } from "next/server";
import { DesignOptionValueType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  isFeatureOrOptionLifecycleStatus,
  normalizeLifecycleStatus,
} from "@/lib/lifecycle-status";

function normalizeValueType(valueType?: DesignOptionValueType | "ENUM" | string | null): DesignOptionValueType | null {
  if (!valueType) return null;
  if (valueType === "ENUM") return DesignOptionValueType.STRING;
  if (Object.values(DesignOptionValueType).includes(valueType as DesignOptionValueType)) {
    return valueType as DesignOptionValueType;
  }
  return null;
}

function sanitizeStringList(values?: string[] | null): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((value) => value.trim()).filter(Boolean);
}

type PrismaWithOptionDelegates = typeof prisma & {
  designOptionDefinition?: {
    findMany: (...args: unknown[]) => Promise<unknown[]>;
    create: (...args: unknown[]) => Promise<unknown>;
    update: (...args: unknown[]) => Promise<unknown>;
    findUnique: (...args: unknown[]) => Promise<unknown>;
  };
  designOptionValue?: {
    findMany: (...args: unknown[]) => Promise<unknown[]>;
    createMany: (...args: unknown[]) => Promise<unknown>;
    deleteMany: (...args: unknown[]) => Promise<unknown>;
  };
};

function hasOptionDelegates() {
  const client = prisma as PrismaWithOptionDelegates;
  return Boolean(client.designOptionDefinition && client.designOptionValue);
}

function isMissingMetadataColumnError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2022") return false;
  const text = `${error.message} ${JSON.stringify(error.meta ?? {})}`.toLowerCase();
  return text.includes("constraints") || text.includes("assumptions");
}

function isUnknownValueMetadataArgumentError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const text = error.message.toLowerCase();
  if (!text.includes("unknown argument")) return false;
  return text.includes("description") || text.includes("constraints") || text.includes("assumptions");
}

async function loadOptionsViaSqlFallback() {
  const [definitions, values] = await Promise.all([
    prisma.$queryRaw<Array<{
      id: string;
      key: string;
      label: string;
      description: string | null;
      valueType: DesignOptionValueType;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>>`SELECT "id","key","label","description","valueType","isActive","createdAt","updatedAt" FROM "DesignOptionDefinition" ORDER BY "label" ASC`,
    prisma.$queryRaw<Array<{
      id: string;
      designOptionId: string;
      value: string;
      label: string;
      sortOrder: number;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>>`SELECT "id","designOptionId","value","label","sortOrder","isActive","createdAt","updatedAt" FROM "DesignOptionValue" ORDER BY "sortOrder" ASC, "label" ASC`,
  ]);

  const valuesByDefinition = new Map<string, Array<{
    id: string;
    designOptionId: string;
    value: string;
    label: string;
    sortOrder: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>>();
  for (const value of values) {
    const group = valuesByDefinition.get(value.designOptionId) ?? [];
    group.push(value);
    valuesByDefinition.set(value.designOptionId, group);
  }

  return definitions.map((definition) => ({
    ...definition,
    lifecycleStatus: "SUPPORTED" as const,
    constraints: [] as string[],
    assumptions: [] as string[],
    values: valuesByDefinition.get(definition.id) ?? [],
  }));
}

export async function GET() {
  try {
    if (!hasOptionDelegates()) {
      const options = await loadOptionsViaSqlFallback();
      return NextResponse.json({
        options,
        warning: "Prisma client is outdated for design option delegates; using SQL compatibility mode",
      });
    }

    const options = await prisma.designOptionDefinition.findMany({
      include: {
        values: {
          orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
        },
      },
      orderBy: [{ label: "asc" }],
    });

    return NextResponse.json({ options });
  } catch (error) {
    if (isMissingMetadataColumnError(error)) {
      try {
        const options = await loadOptionsViaSqlFallback();

        return NextResponse.json({ options, warning: "design-option metadata columns missing; using compatibility mode" });
      } catch (fallbackError) {
        const message = fallbackError instanceof Error ? fallbackError.message : "Failed in compatibility mode";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    const message = error instanceof Error ? error.message : "Failed to fetch design options";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasOptionDelegates()) {
      return NextResponse.json(
        { error: "Design option write APIs are unavailable because Prisma client is outdated. Run 'npx prisma generate' and restart dev server." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as {
      key?: string;
      label?: string;
      description?: string;
      constraints?: string[];
      assumptions?: string[];
      valueType?: DesignOptionValueType | "ENUM";
      isActive?: boolean;
      lifecycleStatus?: string;
      values?: Array<{
        value: string;
        label: string;
        description?: string;
        constraints?: string[];
        assumptions?: string[];
        sortOrder?: number;
        isActive?: boolean;
      }>;
    };

    const normalizedValueType = normalizeValueType(body.valueType ?? DesignOptionValueType.STRING);
    if (!normalizedValueType) {
      return NextResponse.json({ error: `Invalid valueType '${body.valueType}'` }, { status: 400 });
    }
    const normalizedLifecycleStatus = normalizeLifecycleStatus(body.lifecycleStatus) ?? "SUPPORTED";
    if (!isFeatureOrOptionLifecycleStatus(normalizedLifecycleStatus)) {
      return NextResponse.json({ error: `Invalid lifecycleStatus '${body.lifecycleStatus}'` }, { status: 400 });
    }

    if (!body.key || !body.label) {
      return NextResponse.json({ error: "key and label are required" }, { status: 400 });
    }

    try {
      const option = await prisma.$transaction(async (tx) => {
        const created = await tx.designOptionDefinition.create({
          data: {
            key: body.key!,
            label: body.label!,
            description: body.description,
            constraints: sanitizeStringList(body.constraints),
            assumptions: sanitizeStringList(body.assumptions),
            valueType: normalizedValueType,
            isActive: body.isActive ?? true,
            lifecycleStatus: normalizedLifecycleStatus,
          },
        });

        const values = body.values ?? [];
        if (values.length > 0) {
          try {
            await tx.designOptionValue.createMany({
              data: values.map((value, idx) => ({
                designOptionId: created.id,
                value: value.value,
                label: value.label,
                description: value.description?.trim() || null,
                constraints: sanitizeStringList(value.constraints),
                assumptions: sanitizeStringList(value.assumptions),
                sortOrder: value.sortOrder ?? idx,
                isActive: value.isActive ?? true,
              })),
            });
          } catch (valueCreateError) {
            if (!isUnknownValueMetadataArgumentError(valueCreateError)) {
              throw valueCreateError;
            }

            await tx.designOptionValue.createMany({
              data: values.map((value, idx) => ({
                designOptionId: created.id,
                value: value.value,
                label: value.label,
                sortOrder: value.sortOrder ?? idx,
                isActive: value.isActive ?? true,
              })),
            });
          }
        }

        return tx.designOptionDefinition.findUnique({
          where: { id: created.id },
          include: {
            values: {
              orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
            },
          },
        });
      });

      return NextResponse.json({ option }, { status: 201 });
    } catch (createError) {
      if (!isMissingMetadataColumnError(createError)) {
        throw createError;
      }

      const option = await prisma.$transaction(async (tx) => {
        const created = await tx.designOptionDefinition.create({
          data: {
            key: body.key!,
            label: body.label!,
            description: body.description,
            valueType: normalizedValueType,
            isActive: body.isActive ?? true,
            lifecycleStatus: normalizedLifecycleStatus,
          },
        });

        const values = body.values ?? [];
        if (values.length > 0) {
          await tx.designOptionValue.createMany({
            data: values.map((value, idx) => ({
              designOptionId: created.id,
              value: value.value,
              label: value.label,
              description: value.description?.trim() || null,
              constraints: sanitizeStringList(value.constraints),
              assumptions: sanitizeStringList(value.assumptions),
              sortOrder: value.sortOrder ?? idx,
              isActive: value.isActive ?? true,
            })),
          });
        }

        return tx.designOptionDefinition.findUnique({
          where: { id: created.id },
          include: {
            values: {
              orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
            },
          },
        });
      });

      return NextResponse.json({ option, warning: "metadata columns missing; saved without constraints/assumptions" }, { status: 201 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create design option";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!hasOptionDelegates()) {
      return NextResponse.json(
        { error: "Design option write APIs are unavailable because Prisma client is outdated. Run 'npx prisma generate' and restart dev server." },
        { status: 500 }
      );
    }

    const body = (await request.json()) as {
      id?: string;
      key?: string;
      label?: string;
      description?: string;
      constraints?: string[];
      assumptions?: string[];
      valueType?: DesignOptionValueType | "ENUM";
      isActive?: boolean;
      lifecycleStatus?: string;
      values?: Array<{
        id?: string;
        value: string;
        label: string;
        description?: string;
        constraints?: string[];
        assumptions?: string[];
        sortOrder?: number;
        isActive?: boolean;
      }>;
    };

    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const normalizedValueType = body.valueType !== undefined ? normalizeValueType(body.valueType) : undefined;
    if (body.valueType !== undefined && !normalizedValueType) {
      return NextResponse.json({ error: `Invalid valueType '${body.valueType}'` }, { status: 400 });
    }
    const normalizedLifecycleStatus = body.lifecycleStatus !== undefined
      ? normalizeLifecycleStatus(body.lifecycleStatus)
      : undefined;
    if (body.lifecycleStatus !== undefined && !normalizedLifecycleStatus) {
      return NextResponse.json({ error: `Invalid lifecycleStatus '${body.lifecycleStatus}'` }, { status: 400 });
    }
    if (normalizedLifecycleStatus && !isFeatureOrOptionLifecycleStatus(normalizedLifecycleStatus)) {
      return NextResponse.json({ error: `Invalid lifecycleStatus '${body.lifecycleStatus}'` }, { status: 400 });
    }

    try {
      const option = await prisma.$transaction(async (tx) => {
        await tx.designOptionDefinition.update({
          where: { id: body.id },
          data: {
            key: body.key,
            label: body.label,
            description: body.description,
            constraints: body.constraints !== undefined ? sanitizeStringList(body.constraints) : undefined,
            assumptions: body.assumptions !== undefined ? sanitizeStringList(body.assumptions) : undefined,
            valueType: normalizedValueType ?? undefined,
            isActive: body.isActive,
            lifecycleStatus: normalizedLifecycleStatus ?? undefined,
          },
        });

        if (body.values) {
          await tx.designOptionValue.deleteMany({ where: { designOptionId: body.id } });
          if (body.values.length > 0) {
            try {
              await tx.designOptionValue.createMany({
                data: body.values.map((value, idx) => ({
                  designOptionId: body.id!,
                  value: value.value,
                  label: value.label,
                  description: value.description?.trim() || null,
                  constraints: sanitizeStringList(value.constraints),
                  assumptions: sanitizeStringList(value.assumptions),
                  sortOrder: value.sortOrder ?? idx,
                  isActive: value.isActive ?? true,
                })),
              });
            } catch (valueCreateError) {
              if (!isUnknownValueMetadataArgumentError(valueCreateError)) {
                throw valueCreateError;
              }

              await tx.designOptionValue.createMany({
                data: body.values.map((value, idx) => ({
                  designOptionId: body.id!,
                  value: value.value,
                  label: value.label,
                  sortOrder: value.sortOrder ?? idx,
                  isActive: value.isActive ?? true,
                })),
              });
            }
          }
        }

        return tx.designOptionDefinition.findUnique({
          where: { id: body.id },
          include: {
            values: {
              orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
            },
          },
        });
      });

      return NextResponse.json({ option });
    } catch (updateError) {
      if (!isMissingMetadataColumnError(updateError)) {
        throw updateError;
      }

      const option = await prisma.$transaction(async (tx) => {
        await tx.designOptionDefinition.update({
          where: { id: body.id },
          data: {
            key: body.key,
            label: body.label,
            description: body.description,
            valueType: normalizedValueType ?? undefined,
            isActive: body.isActive,
            lifecycleStatus: normalizedLifecycleStatus ?? undefined,
          },
        });

        if (body.values) {
          await tx.designOptionValue.deleteMany({ where: { designOptionId: body.id } });
          if (body.values.length > 0) {
            await tx.designOptionValue.createMany({
              data: body.values.map((value, idx) => ({
                designOptionId: body.id!,
                value: value.value,
                label: value.label,
                description: value.description?.trim() || null,
                constraints: sanitizeStringList(value.constraints),
                assumptions: sanitizeStringList(value.assumptions),
                sortOrder: value.sortOrder ?? idx,
                isActive: value.isActive ?? true,
              })),
            });
          }
        }

        return tx.designOptionDefinition.findUnique({
          where: { id: body.id },
          include: {
            values: {
              orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
            },
          },
        });
      });

      return NextResponse.json({ option, warning: "metadata columns missing; updated without constraints/assumptions" });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update design option";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
