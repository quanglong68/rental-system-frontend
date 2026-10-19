function resolveApiUrl(value: string | undefined): string {
  const candidate = (value?.trim() || "http://localhost:8080").replace(/\/$/, "");
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("VITE_API_URL phải là một URL tuyệt đối hợp lệ.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("VITE_API_URL chỉ hỗ trợ HTTP hoặc HTTPS.");
  }
  return candidate;
}

export const env = {
  apiUrl: resolveApiUrl(import.meta.env.VITE_API_URL),
};
