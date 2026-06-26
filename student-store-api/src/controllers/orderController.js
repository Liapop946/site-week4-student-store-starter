const Order = require("../models/order");

async function getOrders(req, res) {
  try {
    const orders = await Order.getAll();
    res.status(200).json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
}

async function getOrder(req, res) {
  try {
    const order = await Order.getById(Number(req.params.order_id));
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.status(200).json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
}

async function createOrder(req, res) {
  try {
    const { customerId, status, items } = req.body;
    if (customerId == null || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: "customerId and a non-empty items array are required" });
    }
    const order = await Order.create({ customerId, status, items });
    res.status(201).json(order);
  } catch (err) {
    if (err instanceof Order.ProductNotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create order" });
  }
}

async function updateOrder(req, res) {
  try {
    const order = await Order.update(Number(req.params.order_id), req.body);
    res.status(200).json(order);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Order not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to update order" });
  }
}

// Cascades to its order items
async function deleteOrder(req, res) {
  try {
    await Order.delete(Number(req.params.order_id));
    res.status(200).json({ message: "Order deleted" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Order not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to delete order" });
  }
}

module.exports = {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
};
