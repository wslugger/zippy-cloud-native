import { NextRequest, NextResponse } from "next/server";
import {
  PackagePolicyOperator,
  PackagePolicyScope,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertPackageType,
  validatePolicyConflicts,
} from "@/lib/package-policy-engine";

function toPoliciesForValidation(
  policies: Array<{
    id: string;
    packageId: string;
    targetCatalogItemId: string;
    designOptionId: string;
    operator: PackagePolicyOperator;
    active: boolean;
    values: Array<{ designOptionValue: { value: string } }>;
  }>
) {
  return policies.map((policy) => ({
    id: policy.id,
    packageId: policy.packageId,
    targetCatalogItemId: policy.targetCatalogItemId,
    designOptionId: policy.designOptionId,
    operator: policy.operator,
    active: policy.active,
    values: policy.values.map((v) => v.designOptionValue.value),
  }));
}

async function getPolicies(packageId: string, tx: Prisma.TransactionClient | typeof prisma) {
  return tx.packageDesignOptionPolicy.findMany({
    where: { packageId },
    include: {
      targetCatalogItem: {
        select: { id: true, sku: true, name: true, type: true },
      },
      designOption: true,
      values: {
        include: {
          designOptionValue: true,
        },
      },
    },
    orderBy: [{ targetCatalogItemId: "asc" }, { designOptionId: "asc" }, { operator: "asc" }],
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: packageId } = await params;

  try {
    await assertPackageType(packageId);
    const policies = await getPolicies(packageId, prisma);
    return NextResponse.json({ policies });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch package policies" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: packageId } = await params;

  try {
    await assertPackageType(packageId);

    const body = (await request.json()) as {
      targetCatalogItemId?: string;
      designOptionId?: string;
      operator?: PackagePolicyOperator;
      scope?: PackagePolicyScope;
      active?: boolean;
      valueIds?: string[];
    };

    if (!body.targetCatalogItemId || !body.designOptionId || !body.operator) {
      return NextResponse.json(
        { error: "targetCatalogItemId, designOptionId, and operator are required" },
        { status: 400 }
      );
    }

    if (!Object.values(PackagePolicyOperator).includes(body.operator)) {
      return NextResponse.json({ error: `Invalid operator '${body.operator}'` }, { status: 400 });
    }

    const policies = await prisma.$transaction(async (tx) => {
      const created = await tx.packageDesignOptionPolicy.create({
        data: {
          packageId,
          targetCatalogItemId: body.targetCatalogItemId!,
          designOptionId: body.designOptionId!,
          operator: body.operator!,
          scope: body.scope ?? "PROJECT",
          active: body.active ?? true,
        },
      });

      const valueIds = Array.from(new Set(body.valueIds ?? []));
      if (valueIds.length > 0) {
        await tx.packageDesignOptionPolicyValue.createMany({
          data: valueIds.map((designOptionValueId) => ({
            policyId: created.id,
            designOptionValueId,
          })),
        });
      }

      const allPolicies = await getPolicies(packageId, tx);
      const conflicts = validatePolicyConflicts(toPoliciesForValidation(allPolicies));
      if (conflicts.length > 0) {
        throw new Error(conflicts[0].message);
      }

      return allPolicies;
    });

    return NextResponse.json({ policies }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create package policy";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: packageId } = await params;

  try {
    await assertPackageType(packageId);

    const body = (await request.json()) as {
      id?: string;
      targetCatalogItemId?: string;
      designOptionId?: string;
      operator?: PackagePolicyOperator;
      scope?: PackagePolicyScope;
      active?: boolean;
      valueIds?: string[];
    };

    if (!body.id) {
      return NextResponse.json({ error: "Policy id is required" }, { status: 400 });
    }

    const policies = await prisma.$transaction(async (tx) => {
      await tx.packageDesignOptionPolicy.update({
        where: { id: body.id },
        data: {
          targetCatalogItemId: body.targetCatalogItemId,
          designOptionId: body.designOptionId,
          operator: body.operator,
          scope: body.scope,
          active: body.active,
        },
      });

      if (body.valueIds) {
        await tx.packageDesignOptionPolicyValue.deleteMany({ where: { policyId: body.id } });

        const valueIds = Array.from(new Set(body.valueIds));
        if (valueIds.length > 0) {
          await tx.packageDesignOptionPolicyValue.createMany({
            data: valueIds.map((designOptionValueId) => ({
              policyId: body.id!,
              designOptionValueId,
            })),
          });
        }
      }

      const allPolicies = await getPolicies(packageId, tx);
      const conflicts = validatePolicyConflicts(toPoliciesForValidation(allPolicies));
      if (conflicts.length > 0) {
        throw new Error(conflicts[0].message);
      }

      return allPolicies;
    });

    return NextResponse.json({ policies });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update package policy";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: packageId } = await params;

  try {
    await assertPackageType(packageId);

    const body = (await request.json()) as {
      policies?: Array<{
        targetCatalogItemId: string;
        designOptionId: string;
        operator: PackagePolicyOperator;
        scope?: PackagePolicyScope;
        active?: boolean;
        valueIds?: string[];
      }>;
    };

    const policies = body.policies ?? [];

    const allPolicies = await prisma.$transaction(async (tx) => {
      await tx.packageDesignOptionPolicyValue.deleteMany({
        where: { policy: { packageId } },
      });
      await tx.packageDesignOptionPolicy.deleteMany({ where: { packageId } });

      for (const policy of policies) {
        const created = await tx.packageDesignOptionPolicy.create({
          data: {
            packageId,
            targetCatalogItemId: policy.targetCatalogItemId,
            designOptionId: policy.designOptionId,
            operator: policy.operator,
            scope: policy.scope ?? "PROJECT",
            active: policy.active ?? true,
          },
        });

        const valueIds = Array.from(new Set(policy.valueIds ?? []));
        if (valueIds.length > 0) {
          await tx.packageDesignOptionPolicyValue.createMany({
            data: valueIds.map((designOptionValueId) => ({
              policyId: created.id,
              designOptionValueId,
            })),
          });
        }
      }

      const replaced = await getPolicies(packageId, tx);
      const conflicts = validatePolicyConflicts(toPoliciesForValidation(replaced));
      if (conflicts.length > 0) {
        throw new Error(conflicts[0].message);
      }

      return replaced;
    });

    return NextResponse.json({ policies: allPolicies });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to replace package policies";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: packageId } = await params;

  try {
    await assertPackageType(packageId);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id query parameter is required" }, { status: 400 });
    }

    await prisma.packageDesignOptionPolicy.delete({ where: { id } });

    const policies = await getPolicies(packageId, prisma);
    return NextResponse.json({ policies });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete package policy" }, { status: 500 });
  }
}
