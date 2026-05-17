const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const port = Number(process.env.ORDER_TABLE_PRINT_AGENT_PORT || 17777);
const host = "127.0.0.1";

const browserCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
].filter(Boolean);

const server = http.createServer(async (request, response) => {
  setCors(response);
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method !== "POST" || request.url !== "/print-html") {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  try {
    const body = await readJson(request);
    if (!body.html || typeof body.html !== "string") {
      sendJson(response, 400, { error: "Missing html" });
      return;
    }

    const browser = findBrowser();
    if (!browser) {
      sendJson(response, 500, { error: "Chrome or Edge not found. Set CHROME_PATH." });
      return;
    }

    const outputDir = path.join(os.tmpdir(), "ordertable-print-agent");
    fs.mkdirSync(outputDir, { recursive: true });
    const fileName = `${safeName(body.title || "ordertable-slip")}-${Date.now()}.html`;
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, prepareHtml(body.html, body.sourceUrl), "utf8");

    const child = spawn(browser, [
      "--kiosk-printing",
      "--disable-print-preview",
      "--no-first-run",
      "--disable-default-apps",
      filePath
    ], {
      detached: true,
      stdio: "ignore"
    });
    child.unref();

    setTimeout(() => {
      fs.unlink(filePath, () => undefined);
    }, 120000);

    sendJson(response, 200, { ok: true });
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : "Print failed" });
  }
});

server.listen(port, host, () => {
  console.log(`OrderTable local print agent running at http://${host}:${port}`);
  console.log("Set the thermal printer as the default printer for silent printing.");
});

function setCors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Private-Network", "true");
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 6_000_000) {
        request.destroy();
        reject(new Error("Print payload too large"));
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    request.on("error", reject);
  });
}

function findBrowser() {
  return browserCandidates.find((candidate) => candidate && fs.existsSync(candidate));
}

function prepareHtml(html, sourceUrl) {
  const baseTag = sourceUrl ? `<base href="${escapeHtml(new URL(sourceUrl).origin)}/">` : "";
  const printScript = `
    <script>
      window.addEventListener("load", function () {
        setTimeout(function () {
          window.focus();
          window.print();
          setTimeout(function () { window.close(); }, 1800);
        }, 500);
      });
    </script>
  `;
  const withBase = html.includes("<head>")
    ? html.replace("<head>", `<head>${baseTag}`)
    : `${baseTag}${html}`;
  return withBase.includes("</body>")
    ? withBase.replace("</body>", `${printScript}</body>`)
    : `${withBase}${printScript}`;
}

function safeName(value) {
  return String(value).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "ordertable-slip";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}
