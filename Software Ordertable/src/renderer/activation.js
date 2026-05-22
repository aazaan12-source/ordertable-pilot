const form = document.getElementById("activation-form");
const platformUrl = document.getElementById("platform-url");
const licenseKey = document.getElementById("license-key");
const button = document.getElementById("activate-button");
const message = document.getElementById("message");

window.ordertable.onActivationState((state) => {
  if (state.platformUrl) platformUrl.value = state.platformUrl;
  if (state.licenseKey) licenseKey.value = state.licenseKey;
  if (state.message) {
    message.textContent = state.message;
    message.className = "message error";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "Checking license...";
  message.className = "message";
  button.disabled = true;
  try {
    const payload = await window.ordertable.activateLicense({
      platformUrl: platformUrl.value,
      licenseKey: licenseKey.value
    });
    message.textContent = payload.message || "License activated.";
    message.className = "message success";
  } catch (error) {
    message.textContent = error.message || "Activation failed.";
    message.className = "message error";
  } finally {
    button.disabled = false;
  }
});

