/**
 * Cloudflare Turnstile Server-Side Validation Module
 * Tuân thủ tài liệu Cloudflare Turnstile & thiết kế mục 6.2
 * PRF-01: Xóa bỏ mọi nhánh bypass production, fail-closed an toàn, inject fetch cho tests.
 */

import { AppError, BadRequestError } from '../errors.ts';

export class CaptchaError extends BadRequestError {
  constructor(message = 'Xác minh CAPTCHA không thành công.', code = 'CAPTCHA_VERIFICATION_FAILED') {
    super(message, code);
    this.name = 'CaptchaError';
  }
}

export class CaptchaProviderError extends AppError {
  constructor(message = 'Dịch vụ xác thực CAPTCHA không phản hồi hoặc gặp sự cố.', code = 'CAPTCHA_PROVIDER_ERROR') {
    super(message, 503, code);
    this.name = 'CaptchaProviderError';
  }
}

export interface TurnstileVerifyResult {
  success: boolean;
  errorCodes?: string[];
  challengeTs?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

export interface TurnstileVerifyOptions {
  expectedHostname?: string;
  expectedAction?: string;
}

/**
 * Xác thực token Cloudflare Turnstile phía máy chủ (Server-side siteverify)
 * - Fail-closed: Nếu thiếu cấu hình secret hoặc token trống -> Từ chối ngay.
 * - Hỗ trợ timeout hữu hạn (5000ms) chống treo tiến trình.
 * - Hỗ trợ mock fetchFn để kiểm thử unit độc lập không cần mạng thật.
 * - TUYỆT ĐỐI KHÔNG BYPASS: Mọi token đều phải qua xác thực thực tế.
 */
export async function verifyTurnstileToken(
  token: string,
  clientIp?: string,
  secretKey?: string,
  fetchFn: typeof fetch = fetch,
  options?: TurnstileVerifyOptions
): Promise<TurnstileVerifyResult> {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    throw new CaptchaError('Thiếu mã xác minh CAPTCHA (token is required).', 'CAPTCHA_TOKEN_MISSING');
  }

  const secret = secretKey || (typeof process !== 'undefined' ? process.env.TURNSTILE_SECRET_KEY : undefined);
  if (!secret) {
    throw new CaptchaProviderError(
      'Hệ thống chưa cấu hình TURNSTILE_SECRET_KEY phía máy chủ (Fail-closed).',
      'CAPTCHA_CONFIG_MISSING'
    );
  }

  const formData = new URLSearchParams();
  formData.append('secret', secret);
  formData.append('response', token.trim());
  if (clientIp) {
    formData.append('remoteip', clientIp);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {

    const res = await fetchFn('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new CaptchaProviderError(
        `Cloudflare Turnstile trả về mã lỗi HTTP ${res.status}.`,
        'CAPTCHA_PROVIDER_HTTP_ERROR'
      );
    }

    const data = (await res.json()) as any;
    const isSuccess = data.success === true;
    const errorCodes = Array.isArray(data['error-codes']) ? data['error-codes'] : undefined;

    // Kiểm tra tính hợp lệ bổ sung nếu cấu hình hostname/action
    if (isSuccess && options?.expectedHostname && data.hostname !== options.expectedHostname) {
      return {
        success: false,
        errorCodes: ['invalid-hostname'],
        challengeTs: data.challenge_ts,
        hostname: data.hostname,
        action: data.action,
        cdata: data.cdata,
      };
    }

    if (isSuccess && options?.expectedAction && data.action !== options.expectedAction) {
      return {
        success: false,
        errorCodes: ['invalid-action'],
        challengeTs: data.challenge_ts,
        hostname: data.hostname,
        action: data.action,
        cdata: data.cdata,
      };
    }

    return {
      success: isSuccess,
      errorCodes,
      challengeTs: data.challenge_ts,
      hostname: data.hostname,
      action: data.action,
      cdata: data.cdata,
    };
  } catch (err: any) {
    if (err instanceof CaptchaProviderError || err instanceof CaptchaError) {
      throw err;
    }
    if (err?.name === 'AbortError') {
      throw new CaptchaProviderError(
        'Quá thời gian kết nối đến dịch vụ CAPTCHA (Timeout 5s).',
        'CAPTCHA_PROVIDER_TIMEOUT'
      );
    }
    throw new CaptchaProviderError(
      `Không thể kết nối đến máy chủ CAPTCHA: ${err?.message || 'Lỗi mạng không xác định'}`,
      'CAPTCHA_NETWORK_ERROR'
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
