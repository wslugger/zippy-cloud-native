import { prisma } from "./prisma";
import { ItemType, DependencyType, PricingModel } from "@prisma/client";

export interface LineItem {
    id: string;
    sku: string;
    name: string;
    type: ItemType;
    quantity: number;
    parentSku?: string;
    pricing: {
        nrc: number;
        mrc: number;
    };
}

export interface BOMResult {
    lineItems: LineItem[];
    totals: {
        totalNrc: number;
        totalMrc: number;
    };
    warnings: string[];
}

const MAX_DEPTH = 7;

export async function calculateBOM(skuIds: string[]): Promise<BOMResult> {
    const warnings: string[] = [];
    const lineItemMap = new Map<string, LineItem>();

    // Use a queue for breadth-first traversal of dependencies
    let queue: { id: string; parentSku?: string; depth: number; quantity: number }[] = skuIds.map(id => ({
        id,
        depth: 0,
        quantity: 1,
    }));

    const processed = new Set<string>();

    while (queue.length > 0) {
        const { id, parentSku, depth, quantity } = queue.shift()!;

        if (depth > MAX_DEPTH) {
            warnings.push(`Maximum dependency depth of ${MAX_DEPTH} reached for item ${id}. Skipping further nesting.`);
            continue;
        }

        // Fetch the item with its pricing and mandatory dependencies
        const item = await prisma.catalogItem.findUnique({
            where: { id },
            include: {
                pricing: {
                    include: {
                        tiers: true,
                    },
                },
                parentDependencies: {
                    where: {
                        type: {
                            in: [DependencyType.INCLUDES, DependencyType.MANDATORY_ATTACHMENT],
                        },
                    },
                },
            },
        });

        if (!item) {
            warnings.push(`Item with ID ${id} not found in catalog.`);
            continue;
        }

        // Calculate pricing
        let nrc = 0;
        let mrc = 0;

        const pricing = item.pricing[0]; // For now, assume one primary pricing record
        if (pricing) {
            if (pricing.pricingModel === PricingModel.FLAT) {
                nrc = Number(pricing.priceNrc) * quantity;
                mrc = Number(pricing.priceMrc) * quantity;
            } else if (pricing.pricingModel === PricingModel.TIERED) {
                // Find the correct tier
                const tier = pricing.tiers.find(
                    t => quantity >= t.startingUnit && (t.endingUnit === null || quantity <= t.endingUnit)
                );
                nrc = Number(pricing.priceNrc) * quantity; // NRC often flat even in tiered MRC
                mrc = (tier ? Number(tier.priceMrc) : Number(pricing.priceMrc)) * quantity;
            } else {
                // Fallback for other models (PER_UNIT, etc.)
                nrc = Number(pricing.priceNrc) * quantity;
                mrc = Number(pricing.priceMrc) * quantity;
            }
        }

        // Update or add line item
        const existing = lineItemMap.get(id);
        if (existing) {
            existing.quantity += quantity;
            existing.pricing.nrc += nrc;
            existing.pricing.mrc += mrc;
        } else {
            lineItemMap.set(id, {
                id: item.id,
                sku: item.sku,
                name: item.name,
                type: item.type,
                quantity,
                parentSku,
                pricing: { nrc, mrc },
            });
        }

        // Add child dependencies to queue
        for (const dep of item.parentDependencies) {
            queue.push({
                id: dep.childId,
                parentSku: item.sku,
                depth: depth + 1,
                quantity: dep.quantityMultiplier * quantity,
            });
        }
    }

    const lineItems = Array.from(lineItemMap.values());
    const totals = lineItems.reduce(
        (acc, item) => {
            acc.totalNrc += item.pricing.nrc;
            acc.totalMrc += item.pricing.mrc;
            return acc;
        },
        { totalNrc: 0, totalMrc: 0 }
    );

    return {
        lineItems,
        totals,
        warnings,
    };
}
