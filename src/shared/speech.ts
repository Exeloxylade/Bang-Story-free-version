/**
 * Inline vocal tags in narration, written the Gemini TTS way: English words in angle brackets, like
 * <short pause> or <chuckles>. They steer the voice and are never shown in captions.
 */
export const VOICE_TAGS = ['short pause', 'long pause', 'chuckles', 'laugh', 'sigh', 'gasp', 'whispers', 'breath']

const ANGLE = /<[^<>]{1,40}>/g
const SQUARE = /\[[^[\]]{1,40}\]/g

/** The words a listener hears: tags removed, spacing tidied. */
export function stripVoiceTags(text: string): string {
  return text.replace(ANGLE, ' ').replace(SQUARE, ' ').replace(/\s+/g, ' ').trim()
}

export function spokenWords(text: string): string[] {
  return stripVoiceTags(text).split(/\s+/).filter(Boolean)
}

/** A visual scene boundary is not a paragraph or a request for silence. */
export function joinNarrationScenes(lines: readonly string[]): string {
  return lines.map((line) => line.trim()).filter(Boolean).join(' ')
}

/** Extra seconds the pause tags add to a line. */
export function tagPauseSec(text: string): number {
  const short = (text.match(/<short pause>/gi) ?? []).length
  const long = (text.match(/<long pause>/gi) ?? []).length
  return short * 0.4 + long * 1
}

/**
 * The same line for ElevenLabs: v3 models take tags in square brackets; older models only understand
 * <break> pauses, so other tags are dropped there.
 */
export function toElevenLabsText(text: string, model: string): string {
  if (/v3/i.test(model)) return text.replace(/<([^<>]{1,40})>/g, '[$1]')
  return text
    .replace(/<short pause>/gi, '<break time="0.4s" />')
    .replace(/<long pause>/gi, '<break time="1.0s" />')
    .replace(/<(?!break\b)[^<>]{1,40}>/gi, ' ')
    .replace(/\s{2,}/g, ' ')
}

/** True for word tokens that are only tag syntax (e.g. "[laughs]" or parts of a <break> tag). */
export function isTagToken(word: string): boolean {
  return /[<>[\]=]|^\/$/.test(word)
}

/** Reused by script planning and TTS delivery metadata, never spoken as transcript. */
export const CLEAN_NARRATION_STYLE = 'Clear, engaging storytelling narrator at a steady pace. Use natural, silent pauses for punctuation and intentional pause tags. Read continuously across visual scene boundaries; do not add a pause just because the scene changes. No audible breathing, sighs, gasps, whispering, chuckles, laughter, or other non-speech vocal sounds. Keep the same clear speaking voice throughout.'

/** Older scripts can contain performance tags. Keep their words and pause boundaries. */
export function cleanNarrationText(text: string): string {
  return text.replace(/<([^<>]{1,40})>|\[([^\[\]]{1,40})\]/g, (tag, angle: string, square: string) => {
    const effect = (angle ?? square).trim()
    return /\b(breath(?:s|ing)?|breathe|inhale|exhale|sigh(?:s|ing)?|gasp(?:s|ing)?|whisper(?:s|ing)?|chuckle(?:s|ing)?|laugh(?:s|ing|ter)?)\b/i.test(effect) ? '' : tag
  })
}
