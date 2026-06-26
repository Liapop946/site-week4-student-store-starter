const prisma = require("../db/db");

class Product {
  // Optional category filter; sort restricted to price | name, order asc | desc
  static async getAll({ category, sort, order } = {}) {
    const where = category ? { category } : undefined;

    const sortable = ["price", "name"];
    const direction = order === "desc" ? "desc" : "asc";
    const orderBy = sortable.includes(sort) ? { [sort]: direction } : undefined;

    return prisma.product.findMany({ where, orderBy });
  }

  static async getById(id) {
    return prisma.product.findUnique({ where: { id } });
  }

  static async create({ name, description, price, imageUrl, category }) {
    return prisma.product.create({
      data: { name, description, price, imageUrl, category },
    });
  }

  static async update(id, data) {
    return prisma.product.update({ where: { id }, data });
  }

  static async delete(id) {
    return prisma.product.delete({ where: { id } });
  }
}

module.exports = Product;
