// cron/transactionReturnExpiry.cron.js
import cron from "node-cron";
import eventBus from "./eventBus.js";
import { EVENT_TYPES } from "./events.js";
import Transaction from "../models/FinanceModals/TransactionModel.js"; // Transactions model

// Run every 5 minutes: This is for the returns
cron.schedule("*/5 * * * *", async () => {
  try {
    console.log("⏰ Checking expired transaction returns...");

    const now = new Date();
    const intervalMinutes = 10; // check last X minutes
    const pastTime = new Date(now.getTime() - intervalMinutes * 60 * 1000);

    // Fetch transactions whose returnExpiryDate is past and expiryReached is false
    const expiredTransactions = await Transaction.find({
      "orderDetails.returnExpiryDate": { $gte: pastTime, $lt: now },
      "orderDetails.expiryReached": false,
    }).limit(100); // batch limit

    if (!expiredTransactions.length) {
      console.log("No expired transactions found in this interval.");
      return;
    }

    console.log(`Found ${expiredTransactions.length} expired transactions.`);

    // Process in batches
    const batchSize = 50;
    for (let i = 0; i < expiredTransactions.length; i += batchSize) {
      const batch = expiredTransactions.slice(i, i + batchSize);

      for (const txn of batch) {
        // Emit notification
        eventBus.emit(EVENT_TYPES.ORDER_RETURN_EXPIRED, {
          orderId: txn.orderDetails.orderId,
          transactionId: txn._id,
          sellerId: txn.sellerId,
          amount: txn.amount,
          actionUrl: `/transactions/${txn._id}`,
          description: "Transaction return expired — ready for commission report",
        });

        // Mark as expired
        txn.orderDetails.expiryReached = true;
        await txn.save();
      }
    }

    console.log("✅ Expired transaction notifications processed.");
  } catch (err) {
    console.error("❌ Error checking expired transactions:", err);
  }
});
