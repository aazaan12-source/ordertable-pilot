# OrderTable Manager Desktop

This folder contains the installable Windows desktop version of the manager dashboard.

The desktop app is intentionally separate from the web platform code. It validates a license key against the online OrderTable API, then opens the same live manager dashboard in a desktop window so orders, billing, menu updates, and reports stay synchronized with the online platform.

## Build

```powershell
npm install
npm run dist
```

The installer is created in:

```text
Software Ordertable/dist/OrderTable-Manager-Setup-1.0.0.exe
```

## License Flow

1. Super Admin creates a license key in `/admin/software`.
2. Customer installs the desktop app.
3. Customer enters the key.
4. The app validates the key against `/api/software/validate`.
5. If active and within the device limit, the dashboard opens.

## Release Flow

Publish installer metadata in `/admin/software`. The public homepage shows the download link only when a release is published.

