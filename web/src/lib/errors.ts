// Turns the API's UserError (a stable code plus details) into a message in the reader's language.
// Every ErrorCode has an err_<code> message in EN, SI and TA (a test checks this).
type Translate = (key: string, values?: Record<string, string | number>) => string;

export type UserErrorLike = {
  code: string;
  remainingAttempts?: number | null;
  retryAfterSeconds?: number | null;
};

export function errorMessage(t: Translate, error: UserErrorLike | null | undefined): string {
  if (!error) return t("err_generic");
  const key = `err_${error.code.toLowerCase()}`;
  try {
    return t(key, {
      remaining: error.remainingAttempts ?? 0,
      seconds: error.retryAfterSeconds ?? 60,
      taken: 0,
      max_mb: 5,
      email: "",
    });
  } catch {
    return t("err_generic");
  }
}
