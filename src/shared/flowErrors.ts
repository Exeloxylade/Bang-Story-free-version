export class FlowSetupError extends Error {}

/** Only known codes become UI messages; upstream bodies can contain credentials. */
export function flowFailure(value: unknown): Error {
  const message = typeof value === 'string' ? value : value && typeof value === 'object' && 'message' in value && typeof value.message === 'string' ? value.message : ''
  const matched = /\[(captcha|rpc)\/([a-z_]+)\]/i.exec(message)
  if (matched?.[1]?.toLowerCase() === 'captcha' || /reCAPTCHA|CAPTCHA|captcha token/i.test(message)) {
    const code = matched?.[2] ?? 'captcha_provider_failed'
    const known = ['captcha_script_failed', 'captcha_script_policy', 'captcha_library_unavailable', 'captcha_timeout', 'captcha_rejected', 'captcha_unavailable', 'request_failed', 'captcha_provider_failed']
    return new FlowSetupError(`Verifikasi CAPTCHA Flow gagal (${known.includes(code) ? code : 'captcha_provider_failed'}). Pekerjaan Flow yang belum mulai dibatalkan. Periksa metode CAPTCHA di panel Flow2API sebelum mencoba lagi.`)
  }
  if (/paired Flow (?:browser|tab).*offline|paired Flow tab disconnected/i.test(message) || matched && ['authentication_required', 'account_mismatch', 'page_not_ready'].includes(matched[2])) {
    return new FlowSetupError('Koneksi akun Flow belum siap. Pekerjaan Flow yang belum mulai dibatalkan. Buka studio akun yang sesuai dan periksa koneksinya sebelum mencoba lagi.')
  }
  return new Error('Flow2API gagal membuat media. Periksa rincian permintaan di panel Flow2API.')
}
