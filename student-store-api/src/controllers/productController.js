const Product = require("../models/product");

async function getProducts(req, res) {
  try {
    const { category, sort, order } = req.query;
    const products = await Product.getAll({ category, sort, order });
    res.status(200).json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
}

async function getProduct(req, res) {
  try {
    const product = await Product.getById(Number(req.params.id));
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.status(200).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
}

async function createProduct(req, res) {
  try {
    const { name, description, price, imageUrl, category } = req.body;
    if (name == null || price == null) {
      return res.status(400).json({ error: "Name and price are required" });
    }
    const product = await Product.create({
      name,
      description,
      price,
      imageUrl,
      category,
    });
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create product" });
  }
}

async function updateProduct(req, res) {
  try {
    const product = await Product.update(Number(req.params.id), req.body);
    res.status(200).json(product);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Product not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to update product" });
  }
}

// Cascades to its order items
async function deleteProduct(req, res) {
  try {
    await Product.delete(Number(req.params.id));
    res.status(200).json({ message: "Product deleted" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Product not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to delete product" });
  }
}

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
};
