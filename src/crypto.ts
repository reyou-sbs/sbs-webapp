export async function pbkdf2Hash(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits','deriveKey'])
  const key = await crypto.subtle.deriveKey({ name:'PBKDF2', salt: enc.encode(salt), iterations: 100_000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, true, ['encrypt','decrypt'])
  const raw = await crypto.subtle.exportKey('raw', key)
  return btoa(String.fromCharCode(...new Uint8Array(raw)))
}

export function randomSalt(len=16) {
  const arr = new Uint8Array(len)
  crypto.getRandomValues(arr)
  return btoa(String.fromCharCode(...arr))
}

export async function hashPassword(password: string) {
  const salt = randomSalt()
  const hash = await pbkdf2Hash(password, salt)
  return `${salt}$${hash}`
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split('$')
  const h = await pbkdf2Hash(password, salt)
  return h === hash
}

export async function signJWT(payload: any, secret: string, expSec = 3600) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now = Math.floor(Date.now()/1000)
  const body = { ...payload, iat: now, exp: now + expSec }
  function b64url(obj:any){
    const s = typeof obj==='string'?obj:JSON.stringify(obj)
    return btoa(s).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_')
  }
  const enc = new TextEncoder()
  const data = `${b64url(header)}.${b64url(body)}`
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  const sigb64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_')
  return `${data}.${sigb64}`
}

export async function verifyJWT(token: string, secret: string) {
  const enc = new TextEncoder()
  const [h,p,s] = token.split('.')
  const data = `${h}.${p}`
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['verify'])
  const sig = Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0))
  const ok = await crypto.subtle.verify('HMAC', key, sig, enc.encode(data))
  if(!ok) return null
  const payload = JSON.parse(atob(p))
  if (payload.exp && Date.now()/1000 > payload.exp) return null
  return payload
}
