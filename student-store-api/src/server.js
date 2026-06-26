const express = require("express");
const cors = require("cors");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.use("/products", productRoutes);
app.use("/orders", orderRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
