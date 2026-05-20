# QR Customer Order Menu UI Rollback Notes

Date/time: 2026-05-20 22:07:12 +05:00

Branch at backup time: `main`

Backup purpose: original QR customer order menu style before any redesign work.

## QR Menu Related Files

- `app/r/[restaurantSlug]/t/[tableNumber]/page.tsx` - public QR customer menu route.
- `components/customer/order-menu.tsx` - main QR order menu UI, category tabs, item cards, cart controls, customer/waiter mode, active order display.
- `components/customer/request-buttons.tsx` - call waiter and ask for bill actions from customer/order pages.
- `components/customer/recent-order-link.tsx` - recent/running order entry point on QR page.
- `components/customer/order-status-panel.tsx` - customer order status, paid close flow, cancel/edit/status refresh UI.
- `components/customer/order-action-buttons.tsx` - customer order edit/cancel controls.
- `components/customer/feedback-form.tsx` - customer feedback UI connected to customer order flow.
- `app/order/[orderId]/success/page.tsx` - customer success page after QR order placement.
- `app/order/[orderId]/status/page.tsx` - customer order status page.
- `app/order/[orderId]/edit/page.tsx` - customer edit-order page that reuses the order menu flow.
- `app/api/customer/orders/route.ts` - QR order creation API used by customer and waiter-assisted order placement.
- `app/api/customer/orders/[id]/route.ts` - customer order status/edit/cancel API.
- `app/api/customer/waiter-requests/route.ts` - call waiter and bill request API.
- `app/api/customer/feedback/route.ts` - customer feedback API.
- `lib/order-utils.ts` - shared order snapshot/format helpers for customer status and dashboard views.
- `lib/menu-ordering.ts` - category/menu item display ordering used by the QR menu.
- `lib/menu-images.ts` - menu and category image fallback/normalization helpers.
- `components/ui/menu-image.tsx` - menu/category image display component.
- `components/ui/menu-image-picker.tsx` - menu image picker used by menu management pages that feed customer QR images.
- `components/ui/button.tsx` - shared button styling used by QR order UI.
- `components/ui/card.tsx` - shared card styling used by QR order UI.
- `app/globals.css` - global Tailwind/CSS baseline.
- `tailwind.config.ts` - Tailwind design tokens and theme configuration.

## Current Known Working Features

- Public QR route opens by restaurant slug and table number.
- Customer self-ordering mode works with optional customer name.
- Waiter-assisted QR ordering mode works with waiter name selection/manual entry.
- Active waiter list appears on QR order pages.
- Menu categories and menu items display in saved sort order.
- Menu item cards show images, descriptions, prices, and add-to-cart controls.
- Cart supports quantity changes, removal, notes, estimated total, and place order.
- Backend order creation calculates prices from database menu items.
- Successful orders route to customer success/status pages.
- Customer can view active/running order status.
- Customer can call waiter.
- Customer can ask for bill.
- Paid customer order can be closed with the thank-you screen.
- Customer order status page refreshes status updates.
- Existing QR route, cart logic, order placement logic, waiter/customer flow, and dashboard pages are protected from redesign changes at this checkpoint.

## Rollback Note

This checkpoint represents the original working QR customer order menu UI before any redesign of the customer-facing menu page. Future redesign work should happen on `qr-order-menu-ui-redesign` only.
