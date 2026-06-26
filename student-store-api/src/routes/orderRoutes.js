const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

router.get("/", orderController.getOrders);
router.get("/:order_id", orderController.getOrder);
router.post("/", orderController.createOrder);
router.put("/:order_id", orderController.updateOrder);
router.delete("/:order_id", orderController.deleteOrder);

module.exports = router;
