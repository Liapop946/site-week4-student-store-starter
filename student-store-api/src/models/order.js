const prisma = require("../db/db");

class ProductNotFoundError extends Error {
  constructor(productId) {
    super(`Product with id ${productId} not found`);
    this.name = "ProductNotFoundError";
    this.productId = productId;
  }
}

class Order {
  static async getAll() {
    return prisma.order.findMany();
  }

  static async getById(id) {
    return prisma.order.findUnique({
      where: { id },
      include: { orderItems: true },
    });
  }

  // Creates the order and its items atomically. `items` is [{ productId, quantity }];
  // prices and total are computed server-side. Throws ProductNotFoundError before
  // opening the transaction if any productId is missing.
  static async create({ customerId, status, items }) {
    // --- Resolve products and build line items ---
    const productIds = items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const productsById = new Map(products.map((p) => [p.id, p]));

    const lineItems = items.map((item) => {
      const product = productsById.get(item.productId);
      if (!product) {
        throw new ProductNotFoundError(item.productId);
      }
      return {
        productId: item.productId,
        quantity: item.quantity,
        price: product.price,
      };
    });

    const totalPrice = lineItems.reduce(
      (sum, line) => sum + line.price * line.quantity,
      0
    );

    // --- Atomic write: order + its items ---
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: { customerId, status, totalPrice },
      });
      await tx.orderItem.createMany({
        data: lineItems.map((line) => ({ ...line, orderId: order.id })),
      });
      return tx.order.findUnique({
        where: { id: order.id },
        include: { orderItems: true },
      });
    });
  }

  static async update(id, data) {
    return prisma.order.update({ where: { id }, data });
  }

  static async delete(id) {
    return prisma.order.delete({ where: { id } });
  }
}

module.exports = Order;
module.exports.ProductNotFoundError = ProductNotFoundError;
