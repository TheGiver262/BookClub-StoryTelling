/**
 * Content Sanitizer & Validator - YSBK
 * Ngăn chặn mã độc XSS, script injection và các liên kết không an toàn.
 */

/**
 * Loại bỏ các thẻ script, iframe, object, embed và các thuộc tính sự kiện độc hại.
 */
export function sanitizeContent(rawText: string): string {
  if (!rawText) return '';

  let sanitized = rawText
    // Bỏ thẻ script và nội dung bên trong
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Bỏ thẻ iframe, object, embed
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    // Bỏ các thuộc tính on* (onclick, onerror, onload, onmouseover, ...)
    .replace(/\bon\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\bon\w+\s*=\s*[^>\s]+/gi, '')
    // Bỏ javascript: và vbscript: protocols
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '');

  return sanitized.trim();
}

/**
 * Kiểm tra tính hợp lệ của đường dẫn URL (chỉ cho phép http, https hoặc đường dẫn nội bộ tương đối)
 */
export function validateUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();

  // URL nội bộ tương đối hợp lệ: bắt đầu bằng '/' nhưng không phải '//'
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Chuẩn hóa slug tiếng Việt phục vụ SEO (URL thân thiện)
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu tiếng Việt
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
