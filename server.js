const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const multer = require("multer");
const XLSX = require("xlsx");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PRODUCTS_JSON = path.join(__dirname, "products.json");

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
    return next();
  }

  return sendAuthChallenge(res);
}

app.use((req, res, next) => {
  if (req.path === "/admin.html") {
    return adminAuth(req, res, next);
  }
  return next();
});

app.use(express.static(path.join(__dirname)));

app.post(
  "/api/upload",
  adminAuth,
  upload.single("productFile"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    try {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

      if (!rows.length) {
        return res.status(400).json({ error: "The spreadsheet is empty." });
      }

      const headerMap = {};
      Object.keys(rows[0]).forEach((key) => {
        headerMap[key.trim().toLowerCase()] = key;
      });

      const requiredHeaders = [
        "id",
        "category",
        "title",
        "description",
        "price",
        "imageurl",
        "whatsapptext",
      ];
      const missing = requiredHeaders.filter((name) => !headerMap[name]);
      if (missing.length) {
        return res
          .status(400)
          .json({ error: `Missing columns: ${missing.join(", ")}.` });
      }

      const products = rows
        .map((row) => {
          const id = row[headerMap.id];
          const category = row[headerMap.category];
          const title = row[headerMap.title];
          const description = row[headerMap.description];
          const price = row[headerMap.price];
          const imageUrl = row[headerMap.imageurl];
          const whatsappText = row[headerMap.whatsapptext];

          if (
            !id ||
            !category ||
            !title ||
            !description ||
            !price ||
            !imageUrl ||
            !whatsappText
          ) {
            return null;
          }

          const featured =
            String(row[headerMap.featured] || "false").toLowerCase() === "true";
          const meta = [];
          for (let i = 1; i <= 4; i += 1) {
            const value = row[headerMap[`meta${i}`]];
            if (value) {
              meta.push(String(value));
            }
          }

          const mini1 = {
            title: String(row[headerMap.mini1_title] || "Style Details"),
            desc: String(row[headerMap.mini1_desc] || ""),
          };
          const mini2 = {
            title: String(row[headerMap.mini2_title] || "Perfect For"),
            desc: String(row[headerMap.mini2_desc] || ""),
          };

          return {
            id: String(id).trim(),
            category: String(category).trim(),
            title: String(title).trim(),
            description: String(description).trim(),
            price: String(price).trim(),
            imageUrl: String(imageUrl).trim(),
            href: `product.html?id=${encodeURIComponent(String(id).trim())}`,
            whatsappText: String(whatsappText).trim(),
            featured,
            meta,
            mini1,
            mini2,
          };
        })
        .filter((item) => item !== null);

      if (!products.length) {
        return res
          .status(400)
          .json({ error: "No valid products found in the spreadsheet." });
      }

      await fs.writeFile(
        PRODUCTS_JSON,
        JSON.stringify(products, null, 2),
        "utf8",
      );
      return res.json({ success: true, count: products.length });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to process file." });
    }
  },
);

const PORT = process.env.PORT || 3000;
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
