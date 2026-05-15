# Open OrderTable Pilot Demo

## 1. Start The Project

Open PowerShell and run:

```powershell
cd "D:\Codex work\ordertable-pilot"
.\run-platform.ps1
```

Wait until the app starts. It runs on port `3000`.

## 2. Open In Google Chrome

Login page:

```text
http://192.168.18.103:3000/login
```

Manager dashboard:

```text
http://192.168.18.103:3000/dashboard/orders
```

Admin panel:

```text
http://192.168.18.103:3000/admin
```

QR codes page for phone scanning:

```text
http://192.168.18.103:3000/dashboard/qr-codes
```

Customer demo table 1:

```text
http://192.168.18.103:3000/r/demo-restaurant-islamabad/t/1
```

Customer demo table 20:

```text
http://192.168.18.103:3000/r/demo-restaurant-islamabad/t/20
```

## 3. Login Details

Manager login:

```text
Email: manager@demo.com
Password: Manager12345
```

Admin login:

```text
Email: admin@ordertable.pk
Password: Admin12345
```

## 4. Test From Phone With Google Lens

1. Connect your phone to the same Wi-Fi as this computer.
2. Open the manager dashboard on the computer.
3. Login as manager.
4. Open:

```text
http://192.168.18.103:3000/dashboard/qr-codes
```

5. Scan any table QR code using Google Lens.
6. Place an order from the phone.
7. Watch the manager dashboard receive the order automatically.

## 5. Waiter Call Bell / Voice Alert

In the manager dashboard, use the floating button at the bottom-right:

```text
Bell On / Bell Off
```

When a customer presses Call Waiter, the manager dashboard will show a popup and speak:

```text
Call for waiter on table number X
```

If sound does not play, click Bell Off, then Bell On once in Chrome.

## 6. Complete Demo Flow

1. Start project with `.\run-platform.ps1`.
2. Open manager dashboard:

```text
http://192.168.18.103:3000/dashboard/orders
```

3. Login as manager.
4. Open QR codes page:

```text
http://192.168.18.103:3000/dashboard/qr-codes
```

5. Scan a table QR from phone.
6. Add food items to cart.
7. Check estimated bill.
8. Place order.
9. Dashboard receives order automatically.
10. Manager accepts order.
11. Manager prints kitchen slip.
12. Customer asks for bill.
13. Manager prints customer bill.
14. Manager marks order paid.

## 7. If Phone Cannot Open The Link

Check these:

```text
1. Phone and computer must be on the same Wi-Fi.
2. The project must be running.
3. Use the LAN URL, not localhost:
   http://192.168.18.103:3000
4. Windows Firewall may need to allow port 3000.
```
