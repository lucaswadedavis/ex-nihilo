export function parseDirtyJSON(input: string) {
  const noNewlines = input.replace(/\n/g, "");
  const escapedQuotes = noNewlines.replace(
    /"content":\s*"(.*?)"/,
    function (_, content) {
      const escapedContent = content.replace(/"/g, '\\"');
      return `"content": "${escapedContent}"`;
    }
  );
  return JSON.parse(escapedQuotes);
}
