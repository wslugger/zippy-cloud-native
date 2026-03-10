const SKU_ID = "b8868bdf-8a05-4aa7-a67d-e6f3787445a4"; // Package ID from seed output

async function testCalculate() {
    console.log("Testing BOM Calculation API...");

    try {
        const response = await fetch("http://localhost:3000/api/bom/calculate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                sku_ids: [SKU_ID],
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API Error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        console.log("Calculation Result:");
        console.log(JSON.stringify(data, null, 2));

        // Verification logic
        const hasPackage = data.lineItems.some((item: any) => item.sku === "PK-SDWAN-SMALL");
        const hasHardware = data.lineItems.some((item: any) => item.sku === "HW-MX64");
        const hasLicense = data.lineItems.some((item: any) => item.sku === "LIC-ADV-SEC-1Y");

        if (hasPackage && hasHardware && hasLicense) {
            console.log("✅ Success: All nested items resolved correctly.");
        } else {
            console.error("❌ Failure: Missing some items in the expanded BOM.");
            if (!hasPackage) console.error("- Missing Package");
            if (!hasHardware) console.error("- Missing Hardware");
            if (!hasLicense) console.error("- Missing License");
        }

        if (data.totals.totalNrc === 1700 && data.totals.totalMrc === 140) {
            console.log("✅ Success: Pricing totals are correct.");
        } else {
            console.error(`❌ Failure: Totals mismatch. Expected NRC 1700, MRC 140. Got NRC ${data.totals.totalNrc}, MRC ${data.totals.totalMrc}`);
        }

    } catch (error) {
        console.error("Test failed:", error);
    }
}

testCalculate();
