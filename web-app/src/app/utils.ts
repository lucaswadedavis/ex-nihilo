function cleanUpHtmlString(input: string): string {
  // Remove unnecessary escape characters
  let cleaned = input.replace(/\\(\s+)/g, "");
  return cleaned.trim();
}

export function parseDirtyJSON(input: string) {
  function customReviver(key: string, value: any) {
    if (key === "content") {
      return String(value);
    }
    if (key === "suggestions") {
      return Array.isArray(value) ? value.map(String) : [];
    }
    return value;
  }
  const parsed = JSON.parse(input, customReviver);
  parsed.content = cleanUpHtmlString(parsed.content);
  return parsed;
}
