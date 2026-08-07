export function reportActionFailure(code, error) {
  const normalizedCode = String(code || "ACTION_FAILED").replace(/[^A-Z0-9_]/gi, "_").toUpperCase().slice(0, 80);
  const category = error instanceof TypeError ? "TypeError" : error instanceof RangeError ? "RangeError" : "Error";
  console.error("WelcomeFlow action failed", { code: normalizedCode, category });
}

export function safeActionFailure(code, safeMessage, error) {
  reportActionFailure(code, error);
  return String(safeMessage || "WelcomeFlow could not complete that action safely.");
}
