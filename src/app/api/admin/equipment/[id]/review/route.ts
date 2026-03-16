import { NextRequest, NextResponse } from "next/server";
import { EquipmentPurpose, EquipmentReviewStatus, LifecycleStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateEquipmentPublishable } from "@/lib/equipment-catalog";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { reviewStatus?: string };
  const status = body.reviewStatus === "PUBLISHED"
    ? EquipmentReviewStatus.PUBLISHED
    : body.reviewStatus === "REJECTED"
      ? EquipmentReviewStatus.REJECTED
      : null;

  if (!status) {
    return NextResponse.json({ error: "reviewStatus must be PUBLISHED or REJECTED." }, { status: 400 });
  }

  const item = await prisma.catalogItem.findUnique({
    where: { id },
    include: {
      equipmentProfile: {
        include: {
          wanSpec: true,
          lanSpec: true,
          wlanSpec: true,
        },
      },
    },
  });

  if (!item || item.type !== "HARDWARE" || !item.equipmentProfile) {
    return NextResponse.json({ error: "Equipment item not found." }, { status: 404 });
  }

  if (status === EquipmentReviewStatus.PUBLISHED) {
    const errors = validateEquipmentPublishable({
      make: item.equipmentProfile.make,
      model: item.equipmentProfile.model,
      pricingSku: item.equipmentProfile.pricingSku,
      family: item.equipmentProfile.family,
      primaryPurpose: item.primaryPurpose ?? EquipmentPurpose.WAN,
      secondaryPurposes: item.secondaryPurposes,
      vendorDatasheetUrl: item.equipmentProfile.vendorDatasheetUrl,
      wanSpec: item.equipmentProfile.wanSpec,
      lanSpec: item.equipmentProfile.lanSpec,
      wlanSpec: item.equipmentProfile.wlanSpec,
      sku: item.sku,
    });

    if (errors.length > 0) {
      return NextResponse.json({ error: "Publish validation failed", details: errors }, { status: 422 });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.equipmentProfile.update({
      where: { catalogItemId: id },
      data: {
        reviewStatus: status,
      },
    });

    return tx.catalogItem.update({
      where: { id },
      data: {
        lifecycleStatus: status === EquipmentReviewStatus.PUBLISHED ? LifecycleStatus.SUPPORTED : LifecycleStatus.APPROVAL_REQUIRED,
      },
      include: {
        equipmentProfile: true,
      },
    });
  });

  return NextResponse.json({ item: updated });
}
