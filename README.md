# JUM Collection Store Overhaul

This project is a small storefront and product management system for a clothing boutique. It uses Google Sheets as the only product source of truth:

1. Paste the Google Sheets CSV export URL in the admin panel.
2. Sync the spreadsheet into the pending products list.
3. Review pending products in the admin panel.
4. Approve selected products.
5. The approved items appear in the storefront automatically.
6. Product detail and ordering links open a WhatsApp order summary for the store.

## Root causes found

### 1) Header and category navigation were structurally weak
The site header used a simple nav block with no responsive rules, so on smaller screens it collapsed awkwardly and appeared uneven. The UI was not designed mobile-first, which made category links look crowded and inconsistent.

### 2) Mobile layout and button behavior were broken
The buttons were styled only for desktop and did not have responsive behavior for narrow screens. On mobile, flex layouts and widths were not constrained, causing buttons to stretch, stack incorrectly, or appear broken.

### 3) Product data flow was disconnected from the storefront
The site was reading static data from `products.json` in some places and not reliably syncing with spreadsheet uploads. The admin upload route existed, but there was no proper pending/approval workflow, so uploaded products did not reliably become live catalog items. Category names were also inconsistent and not normalized, which caused products to fail to match category pages.

### 4) The product approval flow was missing
The admin upload logic wrote products directly into the storefront catalog without review. That meant the system could not support a safe approval workflow or a clean one-stop stock management flow.

### 5) Ordering was not tied to a consistent product and WhatsApp summary flow
The product detail page had raw WhatsApp links but no clean summary generation for the selected product and product category. This made order placement unreliable and made the buying journey feel unfinished.

## Solution architecture

The app now follows a cleaner flow:

- `server.js` acts as the API and static frontend server.
- Google Sheets data is fetched via a CSV export link and parsed through `xlsx`.
- New products are saved to `pending-products.json` for review.
- Admin approves or rejects products.
- Approved products are written to `products.json` and become live storefront data.
- Frontend pages fetch `/api/products` instead of reading the static file directly.
- Product pages generate a dedicated WhatsApp message containing the product and order details.

## Approved product workflow

- Paste the Google Sheets export URL into `/admin.html`
- Required columns: `id`, `category`, `title`, `description`, `price`, `imageUrl`, `whatsappText`
- Optional columns: `featured`, `mini1_title`, `mini1_desc`, `mini2_title`, `mini2_desc`, `meta1`-`meta4`
- Synced products appear in "Pending products" in the admin panel
- Admin selects products and clicks "Approve selected"
- Approved products are added to the public storefront
- Category and product pages show the approved items automatically

## Catalog and HTML behavior

The storefront pages are now aligned around a common data contract:

- Category pages use `data-category="dresses"` and `data-category="bags"`
- Product category names are normalized so spreadsheet values like `dress`, `dresses`, `bag`, `tote`, etc. resolve correctly
- Product detail pages use the `id` query param and load the live product data from the API
- Product cards and category grids are rendered from live API data and no longer depend on stale static assumptions

## Mobile improvements

- Header wraps more cleanly on small screens
- Navigation links stay readable and evenly spaced
- Buttons stack and stretch appropriately on mobile
- Product grids and detail sections stack into a single-column layout when needed

## Run locally

```bash
npm install
npm start
```

Then open:

- Home: http://localhost:3000/
- Admin: http://localhost:3000/admin.html

Default admin credentials:

- username: `admin`
- password: `admin123`

For production, set these environment variables before deployment:

```bash
export ADMIN_USER=your_admin_user
export ADMIN_PASS=your_secure_password
export PRODUCT_SHEET_URL="https://docs.google.com/spreadsheets/d/your-sheet-id/export?format=csv&gid=0"
```

The app now uses a JSON upload workflow for products.

## JSON template

Upload a JSON file containing an array of product objects. Required fields per product:
- id
- category
- title
- description
- price
- imageUrl
- whatsappText

Example JSON file content:

```json
[
  {
    "id": "sku-100",
    "category": "dresses",
    "title": "Test Dress",
    "description": "Sample dress description",
    "price": "25000",
    "imageUrl": "https://example.com/image.jpg",
    "whatsappText": "Hello I would like to order Test Dress",
    "featured": true
  }
]
```

Use the Admin → Upload products JSON to upload the file. The admin UI validates each object and shows any missing fields so you can correct the file and re-upload.

## Notes

This system is designed to be simple and maintainable. It gives the client a realistic one-stop flow for approving products and pushing them to the live store without manual JSON edits.

## Deployment notes (uploads & nginx)

When deploying to production, a few server and reverse-proxy settings must be configured so JSON uploads work reliably:

- Upload storage and size limit
  - The server now uses disk-backed uploads (multer.diskStorage) to avoid exhausting memory with large JSON files.
  - The maximum accepted upload size is controlled by the environment variable `UPLOAD_MAX_BYTES` (default: 10 * 1024 * 1024 = 10 MB). Increase this if you expect larger files.
  - Example (bash):

    export UPLOAD_MAX_BYTES=52428800   # 50 MB

- Reverse proxy (nginx) configuration
  - If you use nginx (or another reverse proxy) in front of Node, it will commonly reject large requests before they reach Node. Ensure `client_max_body_size` is set to at least the same value as `UPLOAD_MAX_BYTES`.
  - Example nginx snippet (in your server / location block):

    server {
      # ...
      client_max_body_size 50M;   # allow 50 MB uploads
      # ...
    }

- Temporary directory and permissions
  - Multer writes uploads to the OS temporary directory by default (os.tmpdir()). Ensure the process user has write access to that directory and enough free space.
  - If your environment restricts /tmp, set a writable temp path via the `TMPDIR` environment variable or modify the multer destination in `server.js`.

- Handling very large uploads (>100MB)
  - For extremely large product files consider using a streaming JSON parser or chunked upload flow to avoid large intermediate files.
  - Alternatively, upload the file to object storage (S3, GCS) and provide the server a URL to fetch and process asynchronously.

- HTTP error mapping
  - The server returns HTTP 413 when multer rejects an upload due to file size limits. The admin UI shows this as a clear error message when the server responds.

- Environment variables summary
  - ADMIN_USER, ADMIN_PASS — basic-auth for admin routes (set to secure values in production)
  - PRODUCT_SHEET_URL — optional Google Sheets CSV export URL (if used)
  - UPLOAD_MAX_BYTES — maximum upload size in bytes (default 10485760 = 10MB)

- Best practice checklist before deploying
  1. Set ADMIN_USER and ADMIN_PASS to strong credentials.
  2. Configure `UPLOAD_MAX_BYTES` to the desired limit.
  3. Set `client_max_body_size` in nginx to the same or larger value.
  4. Ensure the server process user can write to the temp directory and has sufficient disk space.
  5. Restart the Node server after environment changes.
  6. Monitor `audit-log.json` and `archived-products.json` (or move audit to centralized logging for production use).

If you'd like, I can add a short Kubernetes/NGINX configuration example or a systemd service file to the repo to make deployment smoother.
