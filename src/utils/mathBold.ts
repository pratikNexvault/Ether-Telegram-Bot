/**
 * Utility to convert text into Mathematical Bold Serif Unicode (e.g., 𝐗𝐘𝐑𝐎 𝐑𝐎𝐁𝐎𝐓)
 */
export function toMathBold(text: string): string {
  if (!text) return "";
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Uppercase A-Z (65-90)
    if (code >= 65 && code <= 90) {
      result += String.fromCodePoint(0x1d400 + (code - 65));
    }
    // Lowercase a-z (97-122)
    else if (code >= 97 && code <= 122) {
      result += String.fromCodePoint(0x1d41a + (code - 97));
    }
    // Numbers 0-9 (48-57)
    else if (code >= 48 && code <= 57) {
      result += String.fromCodePoint(0x1d7ce + (code - 48));
    }
    else {
      result += text[i];
    }
  }
  return result;
}
