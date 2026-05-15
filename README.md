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
