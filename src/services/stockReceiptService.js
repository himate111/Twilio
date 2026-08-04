const inventoryService = require("./inventoryService");

async function recordReceipt(input){

    return inventoryService.receiveStock(input);

}

async function batchExists(productId,batchNumber){

    const rows =
        await inventoryService.findBatchByMedicineAndBatch(
            productId,
            batchNumber,
            input.facilityId
        );

    return rows.length > 0;

}

module.exports={
    recordReceipt,
    batchExists
};