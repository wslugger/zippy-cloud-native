import { prisma } from "./prisma";
import { ItemType, DependencyType, PricingModel, Prisma } from "@prisma/client";

export interface BOMOptions {
    termMonths?: number;
    primaryServiceId?: string;

    configValues?: Record<string, Record<string, any>>;
}

export interface LineItem {
    id: string;
    sku: string;
    name: string;
    type: ItemType;
    quantity: number;
    parentSku?: string;
    role?: string; // "PRIMARY" | "SECONDARY"
    configValues?: Record<string, any>;
    pricing: {
        nrc: number;
        mrc: number;
        termMonths?: number;
    };
}

export interface BOMResult {
    lineItems: LineItem[];
    totals: {
        totalNrc: number;
        totalMrc: number;
        totalTcv?: number; // NRC + (MRC * termMonths)
    };
    termMonths?: number;
    warnings: string[];
}

type PricingWithTiers = Prisma.PricingGetPayload<{ include: { tiers: true } }>;

/**
 * Select the best pricing record for a given quantity, term, and context.
 * Priority: exact (termMonths + context) → termMonths only → context only → null/null fallback
 */
function selectPricingWithContext(
    pricingRecords: PricingWithTiers[],
    quantity: number,
    termMonths: number | null,
    context: string | null
): PricingWithTiers | null {
    const now = new Date();

    const eligible = pricingRecords.filter(p => {
        if (quantity < p.minQuantity) return false;
        if (p.maxQuantity !== null && quantity > p.maxQuantity) return false;
        if (p.effectiveDate > now) return false;
        if (p.expirationDate !== null && p.expirationDate < now) return false;
        return true;
    });

    if (eligible.length === 0) return null;

    const priorities: Array<(p: PricingWithTiers) => boolean> = [
        (p) => p.termMonths === termMonths && p.context === context,
        (p) => p.termMonths === termMonths && p.context === null,
        (p) => p.termMonths === null && p.context === context,
        (p) => p.termMonths === null && p.context === null,
    ];

    for (const matcher of priorities) {
        const match = eligible.find(matcher);
        if (match) return match;
    }

    return eligible[0];
}

function computePricing(
    pricing: PricingWithTiers,
    quantity: number
): { nrc: number; mrc: number } {
    if (pricing.pricingModel === PricingModel.FLAT) {
        return {
            nrc: Number(pricing.priceNrc) * quantity,
            mrc: Number(pricing.priceMrc) * quantity,
        };
    } else if (pricing.pricingModel === PricingModel.TIERED) {
        const tier = pricing.tiers.find(
            t => quantity >= t.startingUnit && (t.endingUnit === null || quantity <= t.endingUnit)
        );
        return {
            nrc: Number(pricing.priceNrc) * quantity,
            mrc: (tier ? Number(tier.priceMrc) : Number(pricing.priceMrc)) * quantity,
        };
    } else {
        return {
            nrc: Number(pricing.priceNrc) * quantity,
            mrc: Number(pricing.priceMrc) * quantity,
        };
    }
}

const MAX_DEPTH = 7;

// Service types that can have PRIMARY/SECONDARY context
const SERVICE_TYPES: ItemType[] = [
    ItemType.MANAGED_SERVICE,
    ItemType.SERVICE_OPTION,
    ItemType.CONNECTIVITY,
];

export async function calculateBOM(
    skuIds: string[],
    options: BOMOptions = {}
): Promise<BOMResult> {
    const warnings: string[] = [];
    const lineItemMap = new Map<string, LineItem>();

    const termMonths = options.termMonths ?? null;

    let queue: { id: string; parentSku?: string; depth: number; quantity: number }[] = skuIds.map(id => ({
        id,
        depth: 0,
        quantity: 1,
    }));


    while (queue.length > 0) {
        const { id, parentSku, depth, quantity } = queue.shift()!;

        if (depth > MAX_DEPTH) {
            warnings.push(`Maximum dependency depth of ${MAX_DEPTH} reached for item ${id}. Skipping further nesting.`);
            continue;
        }

        const item = await prisma.catalogItem.findUnique({
            where: { id },
            include: {
                pricing: { include: { tiers: true } },
                childDependencies: {
                    where: {
                        // Only operational dependency types are auto-expanded into BOM rows.
                        type: { in: [DependencyType.INCLUDES, DependencyType.MANDATORY_ATTACHMENT] },
                    },
                },
                attributes: {
                    include: { term: true },
                },
            },
        });

        if (!item) {
            warnings.push(`Item with ID ${id} not found in catalog.`);
            continue;
        }

        // Determine role (PRIMARY or SECONDARY) for service types
        let role: string | undefined;
        if (options.primaryServiceId && SERVICE_TYPES.includes(item.type)) {
            role = item.id === options.primaryServiceId ? 'PRIMARY' : 'SECONDARY';
        }

        // Context for pricing selection
        const pricingContext = role ?? null;

        // Select best pricing record
        const selectedPricing = selectPricingWithContext(item.pricing, quantity, termMonths, pricingContext);

        let nrc = 0;
        let mrc = 0;

        if (selectedPricing) {
            const computed = computePricing(selectedPricing, quantity);
            nrc = computed.nrc;
            mrc = computed.mrc;
        }

        // Attach configValues if provided for this item
        const itemConfigValues = options.configValues?.[id];

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
                role,
                configValues: itemConfigValues,
                pricing: {
                    nrc,
                    mrc,
                    termMonths: selectedPricing?.termMonths ?? undefined,
                },
            });
        }

        // Enqueue child dependencies (INCLUDES + MANDATORY_ATTACHMENT only)
        for (const dep of item.childDependencies) {
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

    const totalTcv = termMonths
        ? totals.totalNrc + totals.totalMrc * termMonths
        : undefined;

    return {
        lineItems,
        totals: {
            ...totals,
            totalTcv,
        },
        termMonths: termMonths ?? undefined,
        warnings,
    };
}
