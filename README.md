# OrderTable Pilot

QR-based restaurant table ordering platform for a real restaurant pilot. Customers scan a table QR code, order without logging in, and restaurant staff manage live orders, waiter requests, kitchen slips, and customer bills from a protected dashboard.

## Tech Stack

- Next.js App Router, React, TypeScript
- Tailwind CSS with local UI primitives
- Prisma ORM with PostgreSQL
- NextAuth credentials login
- QR generation with `qrcode`
- Polling-based live updates for orders and waiter requests

## Environment Variables

Create `.env`:

```env
DATABASE_URL="postgresql://postgres@127.0.0.1:5433/ordertable?schema=public"
NEXTAUTH_SECRET="generate-a-long-random-secret"
NEXTAUTH_URL="http://127.0.0.1:3000"
APP_URL="http://127.0.0.1:3000"
```

Use the real public app URL for `APP_URL` in production so QR codes point to the correct domain.

## Database Setup

```bash
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
```

For local development while changing schema:

```bash
npx prisma migrate dev
npm run prisma:seed
```

The seed keeps the demo restaurant active and ordering enabled:

- Restaurant: `Demo Restaurant Islamabad`
- Slug: `demo-restaurant-islamabad`
- Tables: `1` through `20`
- Manager: `manager@demo.com` / `Manager12345`
- Platform admin: `admin@ordertable.pk` / `Admin12345`

## Run

```bash
npm run dev
```

Open:

- Login: `http://localhost:3000/login`
- Manager dashboard: `http://localhost:3000/dashboard/orders`
- Demo QR table 1: `http://localhost:3000/r/demo-restaurant-islamabad/t/1`
- Demo QR table 20: `http://localhost:3000/r/demo-restaurant-islamabad/t/20`

## Pilot Flow

1. Login as manager at `/login`.
2. Open `/dashboard/orders`.
3. Open `/r/demo-restaurant-islamabad/t/1` in another browser tab or phone.
4. Add menu items, edit quantities, add item instructions and an order note.
5. Confirm the estimated bill, then place the order.
6. The customer status page auto-refreshes.
7. The dashboard receives new orders automatically.
8. Manager accepts the order, prints the kitchen slip, and moves it through Preparing, Ready, Served.
9. Customer clicks Ask for Bill after service.
10. Manager prints the customer bill, collects payment, then marks the order Paid.

## Printing

Kitchen slip:

```txt
/dashboard/orders/{orderId}/print/kitchen
```

Customer bill:

```txt
/dashboard/orders/{orderId}/print/bill
```

Both routes require manager login, verify the manager owns the restaurant, record the print event, and auto-open the print dialog. Print CSS is designed for 80mm thermal roll printers while remaining readable on normal printers.

## Operational Features

- Customer cart editing before submit: quantity, remove item, clear cart, item instructions, order note.
- Estimated bill before submit: subtotal, service charges, tax, discount, total.
- Backend recalculates all trusted prices from database menu items.
- Customer order status auto-refreshes every few seconds.
- Customer cancellation is allowed only within the configured time window and before kitchen preparation.
- Default cancellation window is 3 minutes.
- Manager dashboard auto-refreshes orders and waiter requests every few seconds.
- New pending orders show a visual alert and try to play a short browser notification sound.
- Dashboard actions are persisted in PostgreSQL.
- Activity logs are written for order creation, customer cancellation, manager status updates, bill requests, waiter calls, and print actions.

## Troubleshooting Chrome Or Server Issues

- Make sure PostgreSQL is running and reachable through `DATABASE_URL`.
- Run `npx prisma generate` after schema changes.
- Run `npx prisma migrate deploy` after pulling new migrations.
- If Prisma generation fails on Windows with a locked query engine DLL, stop the running Node/Next dev server and run generation again.
- If Chrome shows stale build errors, stop the dev server, delete `.next`, then run `npm run dev` again.
- If dashboard/admin routes are opened while logged out, they should redirect to `/login`.

## Reset Demo Data

```bash
npm run prisma:seed
```

This refreshes demo users, restaurant settings, 20 tables, categories, and menu items without deleting historical orders.

## Deployment

1. Create a PostgreSQL database on Supabase, Neon, Railway, or another provider.
2. Add `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and `APP_URL` to hosting environment variables.
3. Run migrations:

```bash
npx prisma migrate deploy
```

4. Seed pilot data if needed:

```bash
npm run prisma:seed
```

5. Deploy the Next.js app.

## Multi-Restaurant SaaS Admin

Super admin can manage many restaurants from `/admin/restaurants`. Each restaurant has its own slug, manager login, tables, QR URLs, menu categories, menu items, orders, reports, and billing records.

### Add A Restaurant

1. Login as super admin at `/super-admin-login`.
2. Open `/admin/restaurants`.
3. Click `Add New Restaurant`.
4. Complete restaurant details, table count, manager login, and menu setup.
5. Choose empty menu or sample menu.
6. Click `Create Restaurant`.
7. Open the restaurant detail page, then open QR Codes to print/download table QR codes.

The create flow generates table records automatically. A restaurant with slug `cafe-aroma-islamabad` and 15 tables gets QR paths:

```txt
/r/cafe-aroma-islamabad/t/1
/r/cafe-aroma-islamabad/t/15
```

If `APP_URL` or `NEXTAUTH_URL` is configured, QR display uses the full live URL. Otherwise it stores relative paths so the platform is not tied to localhost.

New restaurants can be added dynamically from the Super Admin dashboard after deployment. The platform does not require redeployment for each restaurant because all restaurant data, tables, menus, users, QR URLs, and orders are stored in the database. Every restaurant manager uses the same `/dashboard` interface, but the dashboard loads only that manager's restaurant data.

### Add A Restaurant On Vercel

1. Set `APP_URL` and `NEXTAUTH_URL` to the final live URL in Vercel.
2. Login at `/super-admin-login`.
3. Open `/admin/restaurants`.
4. Click `Add New Restaurant`.
5. Enter restaurant details, confirm the slug, enter table count, and create the manager login.
6. Choose empty or sample menu.
7. Create the restaurant.
8. Open QR Codes and test table 1 plus the last table before printing QR codes.
9. Give the manager `/login` credentials. They will use the same `/dashboard` interface as the demo restaurant.

If a custom domain is added later, update `APP_URL` and `NEXTAUTH_URL` in Vercel, redeploy, then use `Regenerate All QR URLs` from the restaurant QR Codes page before printing final QR codes.

### Edit Table Count

Open `/admin/restaurants/{restaurantId}/tables`.

- Increasing count creates missing tables.
- Reducing count marks extra tables as `INACTIVE`.
- Past order history is not deleted.
- Inactive table QR scans show a friendly inactive-table message.

### Manage Restaurant Menu

Super admin menu pages:

```txt
/admin/restaurants/{restaurantId}/menu/categories
/admin/restaurants/{restaurantId}/menu/items
```

All categories and menu items are scoped to the selected restaurant. The page header shows which restaurant and branch are being managed to prevent accidental edits to the wrong tenant.

### Menu Sorting

Category and menu item display order is controlled by drag-and-drop reorder mode.

Manager dashboard:

```txt
/dashboard/menu/categories
/dashboard/menu/items
```

Super admin:

```txt
/admin/restaurants/{restaurantId}/menu/categories
/admin/restaurants/{restaurantId}/menu/items
```

How to reorder categories:

1. Open the category page.
2. Click `Reorder`.
3. Drag categories by the grip handle.
4. Click `Save Order`.
5. Click `Cancel` to leave reorder mode without saving.

How to reorder menu items:

1. Open the menu item page.
2. In `Arrange Menu Items`, select a category.
3. Click `Reorder`.
4. Drag items by the grip handle.
5. Click `Save Order`.
6. Click `Cancel` to restore the previous order without saving.

Menu item sorting is category-aware. Reordering changes only the selected category's items, so items from different categories are not mixed accidentally. The customer QR menu reads categories by `sortOrder ASC` and items within each category by `sortOrder ASC`, with creation time as the fallback order.

### Manager Login

Open `/admin/restaurants/{restaurantId}/manager` to create, edit, activate/deactivate, or reset the restaurant manager login. Manager users are scoped by `restaurantId` and only see their own dashboard.

### Onboarding Requests

Public request page:

```txt
/request-restaurant
```

Super admin request management:

```txt
/admin/onboarding-requests
```

Super admin can mark requests as contacted/closed and convert a request into a restaurant by opening the pre-filled Add Restaurant form.

### Tenant Isolation Notes

- Super admin can access all restaurants.
- Restaurant managers are restricted to their own `restaurantId`.
- Customer QR pages find restaurants by slug and tables by restaurant/table number.
- Inactive restaurants, disabled ordering, and inactive tables block customer ordering with friendly messages.
- Menu, tables, orders, reports, and dashboard APIs are filtered by restaurant ownership.

## Restaurant Manager Operations

OrderTable can now be used as one order and billing platform for both QR orders and staff-entered orders.

### Manual Orders

Managers can create waiter/cashier orders from:

```txt
/dashboard/orders/new
```

The manual order form lets staff choose a table, select menu items, add quantities, write item instructions, add a custom item, add waiter/customer details, apply a discount, and send the order to the kitchen. Manual orders are saved in the same `Order` and `OrderItem` tables as online QR orders.

Order sources:

- `ONLINE_QR`
- `MANUAL_DASHBOARD`
- `WAITER_ENTRY`

### Order Detail And Editing

Order detail:

```txt
/dashboard/orders/{orderId}
```

Edit order/bill:

```txt
/dashboard/orders/{orderId}/edit
```

Managers can add mid-meal items, edit quantities, remove items by setting quantity to `0`, add custom items, edit notes, update discounts, update payment method/status, and recalculate totals. Paid order edits show a warning and are logged. Cancelled orders cannot be edited.

### Printing

Kitchen slip:

```txt
/dashboard/orders/{orderId}/print/kitchen
```

Added-items-only slip:

```txt
/dashboard/orders/{orderId}/print/kitchen?addedOnly=1
```

Customer bill:

```txt
/dashboard/orders/{orderId}/print/bill
```

Kitchen slips and bills include order source and waiter name when available. Print pages are thermal-printer friendly and use browser print.

### Payments

Managers can mark orders paid from the order card/detail page and select payment method:

- Cash
- Card
- JazzCash
- EasyPaisa
- Bank Transfer
- Other

Payment writes `paymentStatus`, `paymentMethod`, `paidAt`, `amountPaid`, and `balanceDue`.

### Hide / Show Financials

The manager dashboard overview includes `Hide Financials` / `Show Financials`. This stores a local browser preference and masks the dashboard overview revenue card as `Rs. *****`. Customer bills, order bill summaries, table bill amounts, and reports still show the real amounts.

### Silent Thermal Printing

Browser security does not allow a hosted website to print silently to a local thermal printer by itself. For one-click printing, run the local print agent on the restaurant billing PC:

```bash
npm run print-agent
```

Set the thermal printer as the Windows default printer. Dashboard print buttons first send the slip to `http://127.0.0.1:17777` for kiosk printing through Chrome/Edge. If the local agent is not running, the app falls back to the normal browser print flow.

### Monthly Financial Statement

Reports page:

```txt
/dashboard/reports
```

Printable monthly statement:

```txt
/dashboard/reports/monthly/print?month=YYYY-MM
```

Use browser Print and choose Save as PDF. The report includes paid/unpaid/cancelled counts, gross sales, discounts, service charges, tax, net paid sales, sales by payment method, sales by source, top items, daily sales, and table-wise sales.
