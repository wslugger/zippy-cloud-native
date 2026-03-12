import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing bom-engine
vi.mock('@/lib/prisma', () => ({
    prisma: {
        taxonomyTerm: {
            findUnique: vi.fn().mockResolvedValue(null),
        },
        catalogItem: {
            findUnique: vi.fn(),
        },
    },
}));

import { calculateBOM } from '@/lib/bom-engine';
import { prisma } from '@/lib/prisma';

const mockFindUnique = prisma.catalogItem.findUnique as ReturnType<typeof vi.fn>;

function makeItem(overrides: Record<string, any> = {}) {
    return {
        id: 'item-1',
        sku: 'TEST-001',
        name: 'Test Item',
        type: 'MANAGED_SERVICE',
        pricing: [],
        childDependencies: [],
        attributes: [],
        ...overrides,
    };
}

function makePricing(overrides: Record<string, any> = {}) {
    return {
        id: 'price-1',
        pricingModel: 'FLAT',
        priceNrc: 500,
        priceMrc: 100,
        costNrc: 400,
        costMrc: 80,
        termMonths: null,
        context: null,
        minQuantity: 1,
        maxQuantity: null,
        effectiveDate: new Date('2000-01-01'),
        expirationDate: null,
        tiers: [],
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('calculateBOM', () => {
    it('returns empty result for empty skuIds', async () => {
        const result = await calculateBOM([]);
        expect(result.lineItems).toHaveLength(0);
        expect(result.totals.totalNrc).toBe(0);
        expect(result.totals.totalMrc).toBe(0);
        expect(result.warnings).toHaveLength(0);
    });

    it('warns and skips items not found in catalog', async () => {
        mockFindUnique.mockResolvedValue(null);
        const result = await calculateBOM(['nonexistent-id']);
        expect(result.lineItems).toHaveLength(0);
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toMatch(/not found/i);
    });

    it('calculates flat pricing correctly', async () => {
        mockFindUnique.mockResolvedValue(
            makeItem({ pricing: [makePricing({ priceNrc: 1000, priceMrc: 200 })] })
        );

        const result = await calculateBOM(['item-1']);
        expect(result.lineItems).toHaveLength(1);
        expect(result.totals.totalNrc).toBe(1000);
        expect(result.totals.totalMrc).toBe(200);
    });

    it('multiplies pricing by quantity', async () => {
        mockFindUnique.mockResolvedValue(
            makeItem({ pricing: [makePricing({ priceNrc: 500, priceMrc: 100 })] })
        );

        // Inject quantity via a dependency chain by calling with quantity multiplier
        // We test direct quantity via parentDependencies loop
        const childItem = makeItem({
            id: 'child-1',
            sku: 'CHILD-001',
            pricing: [makePricing({ priceNrc: 50, priceMrc: 10 })],
            childDependencies: [],
        });

        const parentItem = makeItem({
            id: 'parent-1',
            sku: 'PARENT-001',
            pricing: [makePricing({ priceNrc: 500, priceMrc: 100 })],
            childDependencies: [{ childId: 'child-1', quantityMultiplier: 3 }],
        });

        mockFindUnique
            .mockResolvedValueOnce(parentItem)
            .mockResolvedValueOnce(childItem);

        const result = await calculateBOM(['parent-1']);
        const child = result.lineItems.find(l => l.id === 'child-1');
        expect(child).toBeDefined();
        expect(child!.quantity).toBe(3);
        expect(child!.pricing.nrc).toBe(150); // 50 * 3
        expect(child!.pricing.mrc).toBe(30);  // 10 * 3
    });

    it('computes TCV when termMonths is set', async () => {
        mockFindUnique.mockResolvedValue(
            makeItem({ pricing: [makePricing({ priceNrc: 0, priceMrc: 100 })] })
        );

        const result = await calculateBOM(['item-1'], { termMonths: 36 });
        expect(result.totals.totalTcv).toBe(3600); // 0 + 100 * 36
        expect(result.termMonths).toBe(36);
    });

    it('prefers term-matched pricing over generic', async () => {
        const genericPricing = makePricing({ id: 'generic', priceMrc: 100, termMonths: null });
        const termPricing = makePricing({ id: 'term', priceMrc: 80, termMonths: 36 });

        mockFindUnique.mockResolvedValue(
            makeItem({ pricing: [genericPricing, termPricing] })
        );

        const result = await calculateBOM(['item-1'], { termMonths: 36 });
        expect(result.totals.totalMrc).toBe(80);
    });

    it('deduplicates items appearing multiple times', async () => {
        const item = makeItem({ pricing: [makePricing({ priceNrc: 100, priceMrc: 50 })] });
        // Same item referenced by two parents — simulate by calling with same id twice
        const parent1 = makeItem({
            id: 'p1',
            sku: 'P1',
            pricing: [],
            childDependencies: [{ childId: 'item-1', quantityMultiplier: 1 }],
        });
        const parent2 = makeItem({
            id: 'p2',
            sku: 'P2',
            pricing: [],
            childDependencies: [{ childId: 'item-1', quantityMultiplier: 1 }],
        });

        mockFindUnique
            .mockResolvedValueOnce(parent1)
            .mockResolvedValueOnce(parent2)
            .mockResolvedValue(item);

        const result = await calculateBOM(['p1', 'p2']);
        const duped = result.lineItems.filter(l => l.id === 'item-1');
        expect(duped).toHaveLength(1);
        expect(duped[0].quantity).toBe(2); // merged
    });

    it('assigns PRIMARY/SECONDARY role based on primaryServiceId', async () => {
        const svc1 = makeItem({ id: 'svc-1', sku: 'SVC-1', type: 'MANAGED_SERVICE', pricing: [makePricing()] });
        const svc2 = makeItem({ id: 'svc-2', sku: 'SVC-2', type: 'MANAGED_SERVICE', pricing: [makePricing()] });

        mockFindUnique
            .mockResolvedValueOnce(svc1)
            .mockResolvedValueOnce(svc2);

        const result = await calculateBOM(['svc-1', 'svc-2'], { primaryServiceId: 'svc-1' });
        const primary = result.lineItems.find(l => l.id === 'svc-1');
        const secondary = result.lineItems.find(l => l.id === 'svc-2');
        expect(primary?.role).toBe('PRIMARY');
        expect(secondary?.role).toBe('SECONDARY');
    });

    it('caps recursion at MAX_DEPTH and emits a warning', async () => {
        // Create a chain deeper than 7 by making each item include the next
        let callCount = 0;
        mockFindUnique.mockImplementation(async ({ where }: any) => {
            callCount++;
            return makeItem({
                id: where.id,
                childDependencies: [{ childId: `deep-${callCount}`, quantityMultiplier: 1 }],
            });
        });

        const result = await calculateBOM(['deep-0']);
        expect(result.warnings.some(w => w.includes('Maximum dependency depth'))).toBe(true);
    });
});

describe('selectPricingWithContext (via calculateBOM)', () => {
    it('returns zero pricing when no matching pricing records exist', async () => {
        // minQuantity higher than 1 means no eligible record
        const pricingWithHighMin = makePricing({ minQuantity: 5 });
        mockFindUnique.mockResolvedValue(makeItem({ pricing: [pricingWithHighMin] }));

        const result = await calculateBOM(['item-1']);
        expect(result.totals.totalNrc).toBe(0);
        expect(result.totals.totalMrc).toBe(0);
    });

    it('skips expired pricing records', async () => {
        const expired = makePricing({
            expirationDate: new Date('2000-01-02'), // in the past
            priceMrc: 999,
        });
        mockFindUnique.mockResolvedValue(makeItem({ pricing: [expired] }));

        const result = await calculateBOM(['item-1']);
        expect(result.totals.totalMrc).toBe(0);
    });
});
