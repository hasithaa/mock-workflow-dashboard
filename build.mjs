// Bundles src/ into one HTML document and encrypts it into index.html, which decrypts in the browser.
// Usage: STORYBOARD_PASSWORD=... node build.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { pbkdf2Sync, randomBytes, createCipheriv } from "node:crypto";

const password = process.env.STORYBOARD_PASSWORD;
if (!password) {
  console.error("set STORYBOARD_PASSWORD");
  process.exit(1);
}
const ITERATIONS = 300000;

const page = readFileSync("src/index.html", "utf8")
  .replace('<link rel="stylesheet" href="styles.css">', `<style>\n${readFileSync("src/styles.css", "utf8")}\n</style>`)
  .replace('<script src="app.js"></script>', `<script>\n${readFileSync("src/app.js", "utf8")}\n</script>`);

const salt = randomBytes(16);
const iv = randomBytes(12);
const key = pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
const cipher = createCipheriv("aes-256-gcm", key, iv);
const body = Buffer.concat([cipher.update(page, "utf8"), cipher.final(), cipher.getAuthTag()]);
const payload = JSON.stringify({ salt: salt.toString("base64"), iv: iv.toString("base64"), data: body.toString("base64"), iterations: ITERATIONS });

writeFileSync("index.html", `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Workflow portals storyboard</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f6f7f9; color: #1f2328; font: 15px/1.45 ui-sans-serif, system-ui, sans-serif; }
  form { background: #fff; border: 1.5px dashed #8a919c; border-radius: 10px; padding: 1.5rem 1.75rem; width: min(360px, calc(100vw - 32px)); }
  h1 { font-size: 1.1rem; margin: 0 0 .25rem; }
  p { margin: 0 0 1rem; color: #6b7280; font-size: .9rem; }
  input { width: 100%; box-sizing: border-box; font: inherit; padding: .5rem .6rem; border: 1px solid #c9ced6; border-radius: 6px; margin-bottom: .75rem; }
  button { font: inherit; padding: .45rem .9rem; border-radius: 6px; border: 1px solid #1f2328; background: #1f2328; color: #fff; cursor: pointer; }
  .err { color: #7a1f1f; font-size: .85rem; margin-top: .6rem; min-height: 1.2em; }
</style>
</head>
<body>
<form id="f">
  <h1>Workflow portals storyboard</h1>
  <p>This page is encrypted. Enter the password to open it in your browser.</p>
  <input id="p" type="password" autocomplete="current-password" autofocus placeholder="Password">
  <button type="submit">Open</button>
  <div class="err" id="e"></div>
</form>
<script id="payload" type="application/json">${payload}</script>
<script>
(function () {
  var payload = JSON.parse(document.getElementById("payload").textContent);
  var b64 = function (s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); };
  var form = document.getElementById("f"), err = document.getElementById("e");
  function open(password) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"])
      .then(function (km) {
        return crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64(payload.salt), iterations: payload.iterations, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
      })
      .then(function (key) { return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64(payload.iv) }, key, b64(payload.data)); })
      .then(function (plain) {
        try { sessionStorage.setItem("storyboard-password", password); } catch (e) {}
        var hash = location.hash;
        document.open();
        document.write(new TextDecoder().decode(plain));
        document.close();
        if (hash) location.hash = hash;
      });
  }
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    err.textContent = "";
    open(document.getElementById("p").value).catch(function () { err.textContent = "Wrong password."; });
  });
  try {
    var saved = sessionStorage.getItem("storyboard-password");
    if (saved) open(saved).catch(function () { sessionStorage.removeItem("storyboard-password"); });
  } catch (e) {}
})();
</script>
</body>
</html>
`);
console.log("wrote index.html (" + body.length + " bytes of ciphertext)");
