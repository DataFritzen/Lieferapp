import nacl from 'tweetnacl'
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util'

const schluessel = decodeBase64(import.meta.env.VITE_ENCRYPTION_KEY)

export function verschluesseln(daten) {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength)
  const nachrichtStr = JSON.stringify(daten)
  const nachricht = new TextEncoder().encode(nachrichtStr)
  const verschluesselt = nacl.secretbox(nachricht, nonce, schluessel)
  return encodeBase64(nonce) + '.' + encodeBase64(verschluesselt)
}

export function entschluesseln(text) {
  try {
    const [nonce64, daten64] = text.split('.')
    const nonce = decodeBase64(nonce64)
    const daten = decodeBase64(daten64)
    const entschluesselt = nacl.secretbox.open(daten, nonce, schluessel)
    if (!entschluesselt) return null
    return JSON.parse(new TextDecoder().decode(entschluesselt))
  } catch {
    return null
  }
}