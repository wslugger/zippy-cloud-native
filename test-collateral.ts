import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const item = await prisma.catalogItem.findFirst();
    if (item) {
        console.log("Checking item collateral for item: " + item.id);
    }
}
main().finally(() => prisma.$disconnect());
