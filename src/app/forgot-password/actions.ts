'use server';

/**
 * Forgot Password Server Action
 *
 * requestPasswordReset'ı çağırır + dış dünyaya enumeration-safe yanıt döner.
 * Kullanıcı her durumda aynı "kontrol et" ekranını görür (response object).
 */

import { requestPasswordReset } from '@/lib/auth/forgot-password';
import { db } from '@/lib/db/client';

export interface ForgotPasswordState {
  /** Form'un submit edilip backend'in döndüğünü gösterir. */
  submitted: boolean;
  /** Generic mesaj — enumeration sızdırmaz, her durumda aynı. */
  message: string;
  /** Yalnızca validation hatası varsa input alanına banner. */
  validationError: string | null;
  /** İçinde gizli kullandığımız submitted email (frontend göstermek için, gerçekten gönderildi mi info değil). */
  email: string | null;
}

const GENERIC_MESSAGE =
  'Eğer bu e-posta kayıtlıysa, şifre sıfırlama bağlantısı gönderildi. Spam klasörünü de kontrol et.';

export async function forgotPasswordAction(
  _prevState: ForgotPasswordState | null,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = formData.get('email');

  if (typeof email !== 'string' || email.length === 0) {
    return {
      submitted: false,
      message: '',
      validationError: 'E-posta zorunlu',
      email: null,
    };
  }

  const result = await requestPasswordReset({ email }, db);

  if (result.validationIssue) {
    return {
      submitted: false,
      message: '',
      validationError: result.validationIssue,
      email,
    };
  }

  // Her durumda aynı mesaj — enumeration koruma
  return {
    submitted: true,
    message: GENERIC_MESSAGE,
    validationError: null,
    email,
  };
}
