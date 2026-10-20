/**
 * YSBK Recruitment PII Masker (Chặng 16)
 * Che giấu thông tin cá nhân nhạy cảm (PII) trong các response công khai hoặc trả về cho khách.
 */

import type {
  RecruitmentResponseDetailDto,
  RecruitmentResponsePublicDto,
} from './recruitment-types.ts';

export function maskEmail(email?: string | null): string {
  if (!email || !email.includes('@')) return '***@***.***';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local}***@${domain}`;
  }
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

export function maskPhone(phone?: string | null): string {
  if (!phone) return '***';
  const clean = phone.replace(/\s+/g, '');
  if (clean.length <= 6) return '090****';
  return `${clean.slice(0, 3)}****${clean.slice(-3)}`;
}

export function maskStudentId(studentId?: string | null): string | null {
  if (!studentId) return null;
  const trimmed = studentId.trim();
  if (trimmed.length <= 4) return '****';
  return `${trimmed.slice(0, 4)}****`;
}

export function maskFullName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    const single = parts[0];
    if (single.length <= 2) return single + '*';
    return single.slice(0, 1) + '*'.repeat(single.length - 2) + single.slice(-1);
  }
  return parts
    .map((p, idx) => {
      if (idx === 0) return p; // Họ giữ nguyên
      if (idx === parts.length - 1) return p.slice(0, 1) + '*'; // Tên rút gọn
      return p.slice(0, 1) + '*'; // Tên đệm
    })
    .join(' ');
}

export function toPublicApplicantView(
  response: RecruitmentResponseDetailDto
): RecruitmentResponsePublicDto {
  return {
    id: response.id,
    formId: response.formId,
    maskedName: maskFullName(response.applicantName),
    maskedStudentId: maskStudentId(response.applicantStudentId),
    maskedEmail: maskEmail(response.applicantEmail),
    aspiration1: response.aspiration1,
    aspiration2: response.aspiration2 || null,
    submissionDate: response.submissionTimestamp.split('T')[0],
    syncStatus: response.syncStatus,
  };
}
