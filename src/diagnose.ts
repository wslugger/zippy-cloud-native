import { SignJWT } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "zippy-super-secret-key-for-demo-purposes"
);

async function main() {
    try {
        const token = await new SignJWT({ userId: "admin-id", email: "admin@zippy.com", role: "ADMIN", name: "Admin User" })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("2h")
            .sign(SECRET);

        const body = {
            sku: 'TEST-UI-PAYLOAD-API-2',
            name: 'UI Payload API Test 2',
            shortDescription: '',
            detailedDescription: '',
            type: 'MANAGED_SERVICE',
            constraints: [],
            assumptions: [],
            collaterals: [],
            attributes: [],
            pricing: [{ pricingModel: 'FLAT', costMrc: 0, costNrc: 0 }],
            childDependencies: []
        };

        const res = await fetch('http://localhost:3000/api/admin/catalog/150d1aea-0feb-45e1-afbb-6cb2bd547d73', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `zippy_session=${token}`
            },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        console.log('STATUS:', res.status);
        console.log('RESPONSE:', data);

    } catch (error: any) {
        console.error('DIAGNOSTIC FAILED');
        console.error(error);
    } finally {
        process.exit(0);
    }
}

main();
