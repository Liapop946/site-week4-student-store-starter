# Student Store — System Spec (planning.md)

## Section 1: Data Models

Three related models. `OrderItem` is the join/line-item table that holds foreign keys
to **both** `Order` and `Product`, so it sits downstream of two cascade rules at once.

### Product

Represents an individual item available in the store.

| Field         | Prisma type | Required | Default               | DB column     |
| ------------- | ----------- | -------- | --------------------- | ------------- |
| `id`          | `Int`       | required | `autoincrement()`     | `id`          |
| `name`        | `String`    | required | —                     | `name`        |
| `description` | `String?`   | optional | —                     | `description` |
| `price`       | `Float`     | required | —                     | `price`       |
| `imageUrl`    | `String?`   | optional | —                     | `image_url`   |
| `category`    | `String?`   | optional | —                     | `category`    |

- **Primary key:** `id` (auto-increments via `@default(autoincrement())`).
- **Relationships:** one Product to many `OrderItem` records.
- **Cascade behavior:** When a Product is deleted, every `OrderItem` that references it is also deleted (`onDelete: Cascade` is declared on the `OrderItem` side of the relation).
- **Naming:** Prisma fields are camelCase (`imageUrl`); the underlying column keeps snake_case (`image_url`) via `@map`. The table is mapped to `products` via `@@map`. API request/response bodies use the camelCase `imageUrl`.

### Order

Represents a single customer order

| Field        | Prisma type | Required | Default           | DB column     |
| ------------ | ----------- | -------- | ----------------- | ------------- |
| `id`         | `Int`       | required | `autoincrement()` | `id`          |
| `customerId` | `String`    | required | —                 | `customer_id` |
| `totalPrice` | `Float`     | required | `0`               | `total_price` |
| `status`     | `String`    | required | `"pending"`       | `status`      |
| `createdAt`  | `DateTime`  | required | `now()`           | `created_at`  |

- **Primary key:** `id` (auto-increments).
- **Relationships:** one Order to many `OrderItem` records.
- **Cascade behavior:** When an Order is deleted, every `OrderItem` that references it is also deleted (`onDelete: Cascade` on the `OrderItem` to `Order` relation).
- **Naming:** same convention as Product — camelCase Prisma fields, snake_case columns via `@map`, table mapped to `orders` via `@@map`. API bodies use camelCase. `customerId` is a `String` even though the seed data supplies an integer, so the seed coerces it with `String()`.
- **`createdAt`:** server-populated via `@default(now())`; never accepted from the client.

### OrderItem

Represents a single line within an order — one product, at a quantity, at a captured price.

| Field       | Prisma type | Required | Default           | DB column    | Notes                            |
| ----------- | ----------- | -------- | ----------------- | ------------ | -------------------------------- |
| `id`        | `Int`       | required | `autoincrement()` | `id`         |                                  |
| `orderId`   | `Int`       | required | —                 | `order_id`   | **FK → `Order.id`**              |
| `productId` | `Int`       | required | —                 | `product_id` | **FK → `Product.id`**            |
| `quantity`  | `Int`       | required | `1`               | `quantity`   |                                  |
| `price`     | `Float`     | required | —                 | `price`      | snapshot of the product price    |

- **Primary key:** `id` (auto-increments).
- **Relationships:** declared with `@relation` on the FK fields; the `order` and `product` relation fields point back to `Order` and `Product`, which each hold an `orderItems OrderItem[]` back-relation.
  - `OrderItem.orderId` → `Order.id` — `onDelete: Cascade`
  - `OrderItem.productId` → `Product.id` — `onDelete: Cascade`
- **Cascade behavior:** an `OrderItem` is deleted automatically when either its parent
  `Order` or its referenced `Product` is deleted.
- **Naming:** same convention as the other models — camelCase fields, snake_case columns via `@map`, table mapped to `order_items` via `@@map`.

#### Why `price` is stored on `OrderItem` (and not just read from `Product`)

`OrderItem.price` shows the product's price at purchase time and the total price including the quantity of the same product. If a product's price later changes, historical orders must still reflect what the customer actually paid.
Reading `Product.price` live would retroactively rewrite past order totals wrong. Additionally, it would need to reflect the total price of `Product` multiplies by it's quantity

#### Cascade reasoning: OrderItem at the intersection of two delete rules

`OrderItem` is downstream of two cascade rules simultaneously. The interesting edge case
the spec calls out: **what if a Product is deleted while an active Order still contains it?**

- **Decision:** the `OrderItem` rows referencing that product are deleted (per the required
  cascade rule), but the parent `Order` row **survives**. Deleting a product does **not**
  delete orders — it only removes the line items pointing at that product.
- **Consequence:** an order can be left with fewer line items than it originally had, and its
  stored `total_price` will no longer equal the sum of its remaining items.
- **Why accept this:** the required features mandate the product→OrderItem cascade, and it's
  the simplest behavior that satisfies the spec. `total_price` is treated as a historical
  record of what was charged, not a live recomputation.

---

## Section 2: API Contract

**Base URL:** `http://localhost:3000`

**CORS:** the API enables the `cors` middleware (`app.use(cors())`) so the frontend on `http://localhost:5173` can call it cross-origin. `express.json()` parses JSON request bodies.

**Consistent error shape (entire API):**

```json
{ "error": "Error message" }
```

**Standard status codes used:**

| Code | Meaning                                              |
| ---- | ---------------------------------------------------- |
| 200  | OK — successful GET / PUT / DELETE                   |
| 201  | Created — successful POST                            |
| 400  | Bad Request — missing/invalid body fields           |
| 404  | Not Found — resource doesn't exist                  |
| 500  | Internal Server Error — unexpected failure          |

### Product Endpoints

#### `GET /products`
Fetch all products.

- **Request:** no body. Optional query params for filtering/sorting — see below.
- **Success — `200`:**
  ```json
  [
    { "id": 1, "name": "Hoodie", "description": "Cozy", "price": 39.99, "imageUrl": "hoodie.jpg", "category": "clothing" }
  ]
  ```
- **Error — `500`:** `{ "error": "Failed to fetch products" }`

##### Query Parameters

All optional and combinable. Filtering uses Prisma's `where`; sorting uses `orderBy`.

| Param      | Allowed values   | Example                | Behavior                                          |
| ---------- | ---------------- | ---------------------- | ------------------------------------------------- |
| `category` | any string       | `?category=clothing`   | Filter to products whose `category` matches exactly |
| `sort`     | `price`, `name`  | `?sort=price`          | Field to sort by                                  |
| `order`    | `asc`, `desc`    | `?sort=price&order=desc` | Sort direction; applies only when `sort` is set |

- **Default (no params):** return all products, unordered.
- **`order` default:** `asc` when `sort` is provided without `order` (or with an unrecognized `order`).
- **Unknown `category`** (no matches): `200` with an empty array `[]`.
- **Invalid `sort` value:** ignored — the param is dropped and all products are returned unordered (no `400`). This keeps the endpoint forgiving for the frontend.
- **Combining:** `category` + `sort` apply together, e.g. `?category=Apparel&sort=price&order=desc`.

#### `GET /products/:id`
Fetch one product by ID.

- **Request:** route param `id` (integer).
- **Success — `200`:** single product object.
- **Error — `404`:** `{ "error": "Product not found" }`

#### `POST /products`
Add a new product.

- **Request body:**
  ```json
  { "name": "Hoodie", "description": "Cozy", "price": 39.99, "imageUrl": "hoodie.jpg", "category": "clothing" }
  ```
  (`name` and `price` required; others optional.)
- **Success — `201`:** the created product object (including its new `id`).
- **Error — `400`:** `{ "error": "Name and price are required" }`

#### `PUT /products/:id`
Update an existing product.

- **Request:** route param `id`; body contains any subset of updatable fields.
- **Success — `200`:** the updated product object.
- **Error — `404`:** `{ "error": "Product not found" }`

#### `DELETE /products/:id`
Remove a product. **Cascade:** also deletes any `OrderItem` rows referencing it.

- **Request:** route param `id`.
- **Success — `200`:** `{ "message": "Product deleted" }` (or `204` no content).
- **Error — `404`:** `{ "error": "Product not found" }`

### Order Endpoints

#### `GET /orders`
Fetch all orders.

- **Success — `200`:** array of order objects.
- **Error — `500`:** `{ "error": "Failed to fetch orders" }`

#### `GET /orders/:order_id`
Fetch one order **including its order items**.

- **Request:** route param `order_id`.
- **Success — `200`:**
  ```json
  {
    "id": 1,
    "customerId": "student@codepath.org",
    "totalPrice": 79.98,
    "status": "pending",
    "createdAt": "2026-06-22T10:00:00.000Z",
    "orderItems": [
      { "id": 1, "orderId": 1, "productId": 1, "quantity": 2, "price": 39.99 }
    ]
  }
  ```
- **Error — `404`:** `{ "error": "Order not found" }`
- The order is returned with its `orderItems` array via Prisma's `include` (added in Milestone 4).

#### `POST /orders`
Create an order **and its items** atomically. See Section 3 for the full flow.

- **Request body:**
  ```json
  {
    "customerId": "student@codepath.org",
    "status": "pending",
    "items": [
      { "productId": 1, "quantity": 2 },
      { "productId": 3, "quantity": 1 }
    ]
  }
  ```
  - `customerId` required; `status` optional (defaults to `"pending"`).
  - `items` required, must be a non-empty array of `{ productId, quantity }`.
  - The client sends `productId` + `quantity` only — the server looks up the price and
    computes `totalPrice`. It does **not** trust a client-supplied price or total.
- **Success — `201`:** the created order with its `orderItems` array included (same shape as `GET /orders/:order_id`).
- **Error cases:**
  - `400` — missing `customerId`, or `items` empty/missing: `{ "error": "customerId and a non-empty items array are required" }`
  - `404` — an item references a non-existent product: `{ "error": "Product with id 99 not found" }` (and **no** partial order is created — see Section 3).

#### `PUT /orders/:order_id`
Update an order (e.g. change `status`).

- **Request:** route param `order_id`; body e.g. `{ "status": "shipped" }`.
- **Success — `200`:** the updated order object.
- **Error — `404`:** `{ "error": "Order not found" }`

#### `DELETE /orders/:order_id`
Remove an order. **Cascade:** also deletes its `OrderItem` rows.

- **Request:** route param `order_id`.
- **Success — `200`:** `{ "message": "Order deleted" }`
- **Error — `404`:** `{ "error": "Order not found" }`

### Stretch Endpoints *(not required — documented for later)*

- `GET /order-items` — fetch all order items.
- `POST /orders/:order_id/items` — add an item to an existing order.

---

## Section 3: Transactional Flow — `POST /orders`

`POST /orders` is the most architecturally significant endpoint. It writes to two tables
and must be **atomic**: either the order and all its items are created, or nothing is.

### Request body

```json
{
  "customerId": "student@codepath.org",
  "status": "pending",
  "items": [
    { "productId": 1, "quantity": 2 },
    { "productId": 3, "quantity": 1 }
  ]
}
```

### Step-by-step data-layer flow

1. **Validate input (before any DB write).**
   - `customerId` present? `items` an array with at least one element? If not → respond `400`,
     no DB calls made.

2. **Look up every referenced product.**
   - Query `Product` for all `productId`s in `items` via `findMany({ where: { id: { in: [...] } } })`,
     then index them in a `Map` by id.
   - If any `productId` in the request has no matching product → throw `ProductNotFoundError`,
     which the route maps to `404` (`"Product with id N not found"`). This happens **before**
     opening the transaction, so no partial records exist.

3. **Compute line prices and the order total.**
   - For each item, capture the product's current `price` as the `OrderItem.price` snapshot.
   - `totalPrice = Σ (product.price × item.quantity)`.

4. **Open a Prisma transaction (`prisma.$transaction(async (tx) => …)`).** Inside it, in order:
   1. **Create the `Order`** with `customerId`, `status` (default `"pending"`),
      `totalPrice` (from step 3), and `createdAt` (auto `now()`).
   2. **Create the `OrderItem` rows** with a single `tx.orderItem.createMany`, each linked to
      the new order's id with the captured `productId`, `quantity`, and snapshot `price`.
   3. **Re-fetch the order** with `include: { orderItems: true }` and return it.
   - Atomicity: if **any** operation inside the transaction throws, Prisma **rolls back the
     entire transaction** — the order and any already-created items are discarded. The
     database is never left with an order that's missing its items (or vice versa).

### Response

- **Success — `201`:** the created order plus its `orderItems` array (shape matches `GET /orders/:order_id`).
- **Failure:**
  - Bad input → `400`, nothing written.
  - Non-existent `productId` → `404`, nothing written (caught in step 2, before the transaction).
  - Unexpected DB error mid-transaction → transaction rolls back, respond `500`, nothing written.

### Implementation note

`POST /orders` uses the **interactive transaction** form, `prisma.$transaction(async (tx) => { ... })`,
rather than the array form `prisma.$transaction([...])`. The array form runs independent operations,
but each `OrderItem` needs the new order's id — which isn't known until the order is created inside
the transaction — so the interactive form is the natural fit. Product existence is validated *before*
the transaction opens, so an invalid `productId` never creates a partial order.

---

## Decisions Log

## Decisions Log — Product Model

- **Schema translation that went smoothly**: `price` as `Float` and the optional fields (`description`, `imageUrl`, `category`) as `String?` mapped directly from the spec to Prisma with no friction. `id` as `Int @id @default(autoincrement())` matched the spec's auto-increment primary key one-to-one.

- **Field decision I made during implementation that wasn't in the original spec**: Used camelCase Prisma field `imageUrl` with `@map("image_url")` (and `@@map("products")` on the model) instead of a raw `image_url` field. The starter `seed.js` already reads `imageUrl`, so this keeps the model, the seed script, and the JSON API bodies consistent while leaving the DB column snake_case. Updated the spec's Data Models and API Contract to use `imageUrl`.

- **Route behavior that needed a spec update**: No behavioral change needed. For `PUT` and `DELETE` on a missing id, I rely on Prisma throwing `P2025` ("record not found") and map it to the spec's `404 { "error": "Product not found" }` rather than doing a separate existence check first — confirmed in Postman/curl that both return 404 as specified.

### Decisions Log — Order Creation Transaction

- **What my Transactional Flow spec got right**: The sequence held up exactly — validate, look up all products in one query, compute the total from snapshot prices, then create the order and its items inside `$transaction`. Validating product existence *before* opening the transaction (rather than letting a FK error roll it back) made the 404 path clean and kept the rollback purely for unexpected failures.

- **What the spec missed that I discovered during implementation**: The spec validated "items non-empty" but didn't pin down the exact 400 message or that `customerId` and `items` share one validation branch. I consolidated them into a single check returning `"customerId and a non-empty items array are required"` and updated the contract to match. I also switched item creation from a per-item loop to a single `createMany`, which is fewer round-trips for the same result.

- **How the transaction error handling works**: `prisma.$transaction(async (tx) => …)` runs every `tx.*` call against one connection inside a real DB transaction. If any awaited operation throws, Prisma issues a `ROLLBACK`, so nothing the callback wrote is persisted and the thrown error propagates out. Verified directly: a request with one valid and one nonexistent `productId` returned 404 and left the `orders` / `order_items` counts unchanged.

- **One thing I'd design differently if starting over**: I'd represent `status` as a Prisma enum instead of a free-form `String`, so invalid statuses are rejected at the schema level rather than silently stored.

## Spec Reconciliation — Milestone 4 (Schema Audit)

### Schema vs. spec gaps found
- The spec's OrderItem table used snake_case field names (`order_id`, `product_id`) while the other two models had already moved to camelCase fields + `@map`. Updated the OrderItem table to match the established convention — no DB-level change, the columns are still `order_id` / `product_id`.
- Added the `orderItems OrderItem[]` back-relation to both `Product` and `Order`. The spec described these one-to-many relationships in prose but didn't list the back-relation field; Prisma requires it on both sides. Documented it in the OrderItem relationships bullet.
- No other gaps — field types, the two foreign keys, and both cascade rules matched the spec exactly.

### Cascade delete verification
- Deleting a Product removes associated OrderItems: ✅ tested (2 items: 1 after deleting one referenced product; parent order survived, confirming the documented "order survives a product delete" decision)
- Deleting an Order removes associated OrderItems: ✅ tested (remaining item: 0 after deleting the order)

## Final Spec Reconciliation: Project Complete

### Full-system audit result
- All product and order endpoints match the API contract. A full checkout — `GET /products` on load → add to cart → `POST /orders` → `201` with the order and its items — works end-to-end with the frontend on `:5173` and the API on `:3000`.
- Found: the spec didn't document CORS. The frontend runs on a different origin (`:5173`) than the API (`:3000`), so the browser blocks requests without it. Enabled the `cors` middleware (`app.use(cors())`) and added this note.
- Found: the starter `seed.js` read data from `../data` (wrong — the files live in `./data`) and created products without explicit ids, so order_item references broke. Fixed the path and seeded products with their JSON ids, then bumped the autoincrement sequence past them.

### Gaps resolved during frontend integration
- **`image_url` vs `imageUrl`**: the frontend (`ProductCard`, `ProductDetail`) read `product.image_url`, but the API returns `imageUrl`. Resolved by updating the two frontend references to `imageUrl`, keeping the API consistently camelCase.
- **Order request shape**: the frontend builds `items` as `[{ productId, quantity }]` and sends `customerId` — matching the camelCase contract. The cart (`{ [productId]: quantity }`) is mapped to that array in `handleOnCheckout`, coercing the productId key to a `Number`.
- **No fetching in the starter UI**: the starter imported axios but never called the API. Wired `GET /products` on mount in `App`, `GET /products/:id` in `ProductDetail`, and the `POST /orders` checkout — none of these changed the contract, they consume it.

### What the spec enabled during this project
- Because the request/response shapes and error cases were written down first, each milestone was mostly transcription rather than design, and the frontend integration came down to a single field-name mismatch (`image_url`) instead of a shape-by-shape debugging session — the contract told both sides exactly what to expect.
