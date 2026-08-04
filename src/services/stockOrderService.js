const db = require("../../postdb");

async function getVendors() {

    return db.query(
        `
        SELECT
            id,
            name,
            code
        FROM "Vendor"
        WHERE "isActive" = true
        ORDER BY name
        `
    );

}

async function findMedicine(query) {

    return db.query(
        `
        SELECT
            id,
            "medicineName" AS name,
            "genericName",
            "dosageForm",
            strength
        FROM "Medicine"
        WHERE LOWER("medicineName") LIKE LOWER($1)
        ORDER BY "medicineName"
        LIMIT 10
        `,
        [`%${query}%`]
    );

}

async function createOrder(input) {

    const orderCode =
        `SO-${Date.now()}`;

    return db.transaction(async (client) => {

        // Create Stock Order
        const orderResult = await client.query(
            `
            INSERT INTO "StockOrder"
            (
                "orderCode",
                "facilityId",
                "vendorId",
                status,
                "orderedById"
            )
            VALUES
            ($1,$2,$3,'SUBMITTED',$4)
            RETURNING id,"orderCode"
            `,
            [
                orderCode,
                input.facilityId,
                input.vendorId,
                input.orderedById
            ]
        );

        const order = orderResult.rows[0];

        // Create Stock Order Lines
        for (const item of input.items) {

            await client.query(
                `
                INSERT INTO "StockOrderLine"
                (
                    "orderId",
                    "medicineId",
                    "quantityOrdered"
                )
                VALUES
                ($1,$2,$3)
                `,
                [
                    order.id,
                    item.medicineId,
                    item.quantity
                ]
            );

        }

        return order;

    });

}

async function getPendingOrders(facilityId) {

}

async function getOrderById(orderId) {

}

async function getOrderItems(orderId) {

}

async function updateOrderStatus(orderId,status) {

}

module.exports = {
    getVendors,
    findMedicine,
    createOrder,
    getPendingOrders,
    getOrderById,
    getOrderItems,
    updateOrderStatus
};