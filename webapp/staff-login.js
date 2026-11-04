const loginForm = document.querySelector("#staff-login-form");
const loginStatus = document.querySelector("#staff-login-status");
const loginButton = document.querySelector("#staff-login-button");
const setupNotice = document.querySelector("#staff-login-setup");
const setupCopy = document.querySelector("#staff-login-setup-copy");

const authConfig = window.BEC_SUPABASE_CONFIG;
const authConfigured = Boolean(authConfig?.url && authConfig?.publishableKey);
const supabaseReady = Boolean(window.supabase?.createClient);
const loginClient = authConfigured && supabaseReady
  ? window.supabase.createClient(authConfig.url, authConfig.publishableKey)
  : null;

function showLoginStatus(message, isError = false) {
  loginStatus.textContent = message;
  loginStatus.classList.toggle("status-error", isError);
}

if (!authConfigured || !supabaseReady) {
  loginForm.hidden = true;
  setupNotice.hidden = false;
  setupCopy.textContent = !authConfigured
    ? "An administrator must configure the Supabase project URL and publishable key before staff can sign in."
    : "The secure sign-in service could not be loaded. Check the connection and reload this page.";
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!loginClient) return;

  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  loginButton.disabled = true;
  showLoginStatus("Signing in…");

  const { data, error } = await loginClient.auth.signInWithPassword({ email, password });
  if (error) {
    showLoginStatus(error.message, true);
    loginButton.disabled = false;
    return;
  }

  if (data.user?.app_metadata?.role !== "bec_staff") {
    const { error: signOutError } = await loginClient.auth.signOut();
    showLoginStatus(signOutError
      ? "This account does not have BEC staff access. Sign out from the Supabase project and contact a BEC administrator."
      : "This account does not have BEC staff access. Contact a BEC administrator.", true);
    loginButton.disabled = false;
    return;
  }

  window.location.assign("./staff.html");
});

if (loginClient) {
  loginClient.auth.getSession().then(({ data, error }) => {
    if (error) {
      showLoginStatus(`Could not check the current sign-in: ${error.message}`, true);
      return;
    }
    if (data.session?.user.app_metadata?.role === "bec_staff") {
      window.location.replace("./staff.html");
    } else if (data.session) {
      showLoginStatus("This account does not have BEC staff access.", true);
    }
  });
}
