const prisma = require("../db/db");

class OrderItem {
  static async getAll() {
    return prisma.orderItem.findMany();
  }

  static async create({ orderId, productId, quantity, price }) {
    return prisma.orderItem.create({
      data: { orderId, productId, quantity, price },
    });
  }
}

module.exports = OrderItem;
