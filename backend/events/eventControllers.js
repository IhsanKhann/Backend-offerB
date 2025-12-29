// controllers/order.controller.js
import eventBus from "./eventBus.js";
import { EVENT_TYPES } from "./events.js";
import Order from "../models/FinanceModals/OrdersModel.js"; // does this have the returnTimeExpiry

// controllers/transaction.controller.js
import eventBus from "./eventBus.js";
import { EVENT_TYPES } from "./events.js";
import Transaction from "../models/FinanceModals/TransactionModel.js";

export const markReturnExpiredManually = async (req, res) => {
  const { transactionId } = req.body;

  try {
    const txn = await Transaction.findById(transactionId);
    if (!txn) return res.status(404).json({ error: "Transaction not found" });

    // Check if already expired
    if (!txn.orderDetails.expiryReached) {
      txn.orderDetails.expiryReached = true;
      await txn.save();

      eventBus.emit(EVENT_TYPES.ORDER_RETURN_EXPIRED, {
        orderId: txn.orderDetails.orderId,
        transactionId: txn._id,
        sellerId: txn.sellerId,
        amount: txn.amount,
        actionUrl: `/transactions/${txn._id}`,
        description: "Transaction return expired — ready for commission report",
      });
    }

    res.json({ success: true, message: "Transaction marked as expired" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
