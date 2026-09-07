const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const multer = require("multer");
const XLSX = require("xlsx");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PRODUCTS_JSON = path.join(__dirname, "products.json");
const PENDING_PRODUCTS_JSON = path.join(__dirname, "pending-products.json");
const PRODUCT_SHEET_URL =
  process.env.PRODUCT_SHEET_URL ||
  "https://docs.google.com/spreadsheets/d/10lGrIsydahiEa-gT517X_FH5_nKTNz3zbE5XADAQItE/export?format=csv&gid=2077942493";

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin123";

function sendAuthChallenge(res) {
  res.set("WWW-Authenticate", 'Basic realm="Admin Area"');
  res.status(401).send("Authentication required.");
}

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return sendAuthChallenge(res);
  }

  const credentials = Buffer.from(authHeader.slice(6), "base64").toString(
    "utf8",
  );
  const [username, password] = credentials.split(":");

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    // attach the username to the request for audit logging
    req.adminUser = username;
    return next();
  }

  return sendAuthChallenge(res);
}

function normalizeHeaderName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeCategory(value) {
  const category = String(value || "").trim().toLowerCase();
  if (!category) return "uncategorized";
  if (category.includes("dress")) return "dresses";
  if (category.includes("bag") || category.includes("tote") || category.includes("purse")) {
    return "bags";
  }
  return category.replace(/\s+/g, "-");
}

function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

async function ensureJsonFile(filePath, fallbackValue) {
  try {
    await fs.access(filePath);
  } catch (error) {
    await fs.writeFile(filePath, JSON.stringify(fallbackValue, null, 2), "utf8");
  }
}

async function readJsonFile(filePath, fallbackValue) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    if (!content.trim()) {
      return fallbackValue;
    }
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : fallbackValue;
  } catch (error) {
    return fallbackValue;
  }
}

function buildProductFromRow(row, headerMap) {
  const id = cleanText(row[headerMap.id]);
  const category = normalizeCategory(row[headerMap.category]);
  const title = cleanText(row[headerMap.title]);
  const description = cleanText(row[headerMap.description]);
  const price = cleanText(row[headerMap.price]);
  const imageUrl = cleanText(row[headerMap.imageurl] || row[headerMap.image]);
  const whatsappText = cleanText(
    row[headerMap.whatsapptext] || row[headerMap.whatsapp_text] || row[headerMap.whatsapp],
  );

  if (!id || !category || !title || !description || !price || !imageUrl || !whatsappText) {
    return null;
  }

  const featuredRaw = cleanText(row[headerMap.featured] || row[headerMap.featuredflag]);
  const featured = /^(true|yes|1)$/i.test(featuredRaw);
  const meta = [];
  for (let index = 1; index <= 4; index += 1) {
    const key = `meta${index}`;
    const value = cleanText(row[headerMap[key]]);
    if (value) {
      meta.push(value);
    }
  }

  const mini1Title = cleanText(row[headerMap.mini1title] || row[headerMap.mini1_title] || "Style Details");
  const mini1Desc = cleanText(row[headerMap.mini1desc] || row[headerMap.mini1_desc] || "");
  const mini2Title = cleanText(row[headerMap.mini2title] || row[headerMap.mini2_title] || "Perfect For");
  const mini2Desc = cleanText(row[headerMap.mini2desc] || row[headerMap.mini2_desc] || "");

  return {
    id: id,
    category,
    title,
    description,
    price,
    imageUrl,
    href: `product.html?id=${encodeURIComponent(id)}`,
    whatsappText,
    featured,
    meta,
    mini1: { title: mini1Title, desc: mini1Desc },
    mini2: { title: mini2Title, desc: mini2Desc },
  };
}

app.use(express.json());

app.use((req, res, next) => {
  if (req.path === "/admin.html") {
    return adminAuth(req, res, next);
  }
  return next();
});

app.use(express.static(path.join(__dirname), {
  setHeaders: (response) => {
    response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  }
}));

app.get("/api/products", async (req, res) => {
  const products = await readJsonFile(PRODUCTS_JSON, []);
  res.json(products);
});

app.get("/api/pending-products", adminAuth, async (req, res) => {
  const pending = await readJsonFile(PENDING_PRODUCTS_JSON, []);
  res.json(pending);
});

async function syncPendingProductsFromList(products) {
  await ensureJsonFile(PENDING_PRODUCTS_JSON, []);
  const pendingProducts = await readJsonFile(PENDING_PRODUCTS_JSON, []);
  const merged = [...pendingProducts];

  products.forEach((product) => {
    const existingIndex = merged.findIndex((item) => item.id === product.id);
    if (existingIndex >= 0) {
      merged[existingIndex] = product;
    } else {
      merged.push(product);
    }
  });

  await fs.writeFile(PENDING_PRODUCTS_JSON, JSON.stringify(merged, null, 2), "utf8");
  return merged.length;
}

// Utility: append an audit entry to audit-log.json
const AUDIT_LOG_JSON = path.join(__dirname, "audit-log.json");
const ARCHIVED_PRODUCTS_JSON = path.join(__dirname, "archived-products.json");

async function appendAuditEntry(entry) {
  try {
    await ensureJsonFile(AUDIT_LOG_JSON, []);
    const log = await readJsonFile(AUDIT_LOG_JSON, []);
    log.push(entry);
    await fs.writeFile(AUDIT_LOG_JSON, JSON.stringify(log, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to append audit entry", err);
  }
}


function validateProductRecord(product) {
  const required = ["id", "category", "title", "description", "price", "imageUrl", "whatsappText"];
  const missing = required.filter((k) => !product.hasOwnProperty(k) || String(product[k]).trim() === "");
  return missing;
}

app.post(
  "/api/upload",
  adminAuth,
  upload.single("productFile"),
  async (req, res) => {
    // Accept either a JSON file upload (productFile) or a JSON body array
    let products = null;
    const errors = [];

    try {
      if (req.file && req.file.buffer) {
        const text = req.file.buffer.toString("utf8");
        products = JSON.parse(text);
      } else if (Array.isArray(req.body)) {
        products = req.body;
      } else if (req.body && req.body.products && Array.isArray(req.body.products)) {
        products = req.body.products;
      }
    } catch (err) {
      console.error(err);
      return res.status(400).json({ error: "Uploaded file is not valid JSON." });
    }

    if (!Array.isArray(products)) {
      return res.status(400).json({ error: "Expected a JSON array of product objects." });
    }

    // Validate each product and collect errors
    const validProducts = [];
    products.forEach((p, idx) => {
      const missing = validateProductRecord(p);
      if (missing.length) {
        errors.push({ index: idx, id: p.id || null, missingFields: missing });
      } else {
        // normalize category, ensure href
        const prod = Object.assign({}, p);
        prod.category = normalizeCategory(prod.category);
        prod.href = `product.html?id=${encodeURIComponent(String(prod.id))}`;
        validProducts.push(prod);
      }
    });

    if (errors.length) {
      return res.status(400).json({ error: "Validation failed.", details: errors });
    }

    try {
      const pendingCount = await syncPendingProductsFromList(validProducts);
      return res.json({ success: true, count: validProducts.length, pendingCount });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to save pending products." });
    }
  },
);


app.post("/api/products/approve", adminAuth, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (!ids.length) {
    return res.status(400).json({ error: "Select at least one product to approve." });
  }

  try {
    await ensureJsonFile(PRODUCTS_JSON, []);
    await ensureJsonFile(PENDING_PRODUCTS_JSON, []);
    const currentProducts = await readJsonFile(PRODUCTS_JSON, []);
    const pendingProducts = await readJsonFile(PENDING_PRODUCTS_JSON, []);
    const approvedProducts = pendingProducts.filter((product) => ids.includes(product.id));
    const remainingPending = pendingProducts.filter((product) => !ids.includes(product.id));

    const mergedProducts = [...currentProducts];
    approvedProducts.forEach((product) => {
      const index = mergedProducts.findIndex((item) => item.id === product.id);
      if (index >= 0) {
        mergedProducts[index] = product;
      } else {
        mergedProducts.push(product);
      }
    });

    await fs.writeFile(PRODUCTS_JSON, JSON.stringify(mergedProducts, null, 2), "utf8");
    await fs.writeFile(PENDING_PRODUCTS_JSON, JSON.stringify(remainingPending, null, 2), "utf8");

    // Audit
    await appendAuditEntry({ action: 'approve', ids, by: req.adminUser || null, at: new Date().toISOString() });

    return res.json({ success: true, approved: approvedProducts.length, pendingCount: remainingPending.length });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to approve products." });
  }
});

app.post("/api/products/delete", adminAuth, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const archive = Boolean(req.body?.archive);
  if (!ids.length) {
    return res.status(400).json({ error: "Select at least one product to delete." });
  }

  try {
    await ensureJsonFile(PRODUCTS_JSON, []);
    const currentProducts = await readJsonFile(PRODUCTS_JSON, []);

    const toRemove = currentProducts.filter((p) => ids.includes(p.id));
    const remaining = currentProducts.filter((p) => !ids.includes(p.id));

    // write remaining products
    await fs.writeFile(PRODUCTS_JSON, JSON.stringify(remaining, null, 2), "utf8");

    let archivedCount = 0;
    if (archive && toRemove.length) {
      await ensureJsonFile(ARCHIVED_PRODUCTS_JSON, []);
      const archived = await readJsonFile(ARCHIVED_PRODUCTS_JSON, []);
      const now = new Date().toISOString();
      const toArchive = toRemove.map((p) => ({ ...p, archivedAt: now, archivedBy: req.adminUser || null }));
      const mergedArchived = archived.concat(toArchive);
      await fs.writeFile(ARCHIVED_PRODUCTS_JSON, JSON.stringify(mergedArchived, null, 2), "utf8");
      archivedCount = toArchive.length;
    }

    // Also remove from pending if present
    await ensureJsonFile(PENDING_PRODUCTS_JSON, []);
    const pendingProducts = await readJsonFile(PENDING_PRODUCTS_JSON, []);
    const remainingPending = pendingProducts.filter((product) => !ids.includes(product.id));
    await fs.writeFile(PENDING_PRODUCTS_JSON, JSON.stringify(remainingPending, null, 2), "utf8");

    // Audit
    await appendAuditEntry({ action: archive ? 'archive' : 'delete', ids, by: req.adminUser || null, at: new Date().toISOString(), archivedCount });

    return res.json({ success: true, removed: toRemove.length, archived: archivedCount, pendingCount: remainingPending.length });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to delete products." });
  }
});

const PORT = process.env.PORT || 3000;
(async () => {
  await ensureJsonFile(PRODUCTS_JSON, []);
  await ensureJsonFile(PENDING_PRODUCTS_JSON, []);
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (process.env.ADMIN_USER || process.env.ADMIN_PASS) {
      console.log("Admin auth enabled via environment variables.");
    } else {
      console.log("Admin auth default credentials: admin / admin123");
      console.log(
        "Set ADMIN_USER and ADMIN_PASS environment variables before production.",
      );
    }
  });
})();
