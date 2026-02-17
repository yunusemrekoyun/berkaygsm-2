const MIN_PASSWORD_LENGTH = 8;
const UPPERCASE_REGEX = /[A-Z]/;
const SPECIAL_CHAR_REGEX = /[^A-Za-z0-9]/;

export function validatePasswordPolicy(value) {
  const password = String(value || "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`,
    };
  }
  if (!UPPERCASE_REGEX.test(password)) {
    return {
      ok: false,
      message: "Şifre en az bir büyük harf içermelidir.",
    };
  }
  if (!SPECIAL_CHAR_REGEX.test(password)) {
    return {
      ok: false,
      message: "Şifre en az bir özel karakter içermelidir.",
    };
  }
  return { ok: true, message: "" };
}

export function getPasswordPolicyHint() {
  return "Şifre en az 8 karakter, en az 1 büyük harf ve 1 özel karakter içermelidir.";
}
