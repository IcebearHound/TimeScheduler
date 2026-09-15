const DATABASE = 'time-scheduler-private'
const STORE = 'vault'
let database: Promise<IDBDatabase> | undefined

function db() {
  return database ||= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => { database = undefined; reject(new Error('浏览器无法保存登录状态，请允许网站使用本地存储')) }
  })
}
async function read<T>(name: string): Promise<T | undefined> {
  const connection = await db()
  return new Promise((resolve, reject) => {
    const tx = connection.transaction(STORE, 'readonly'), request = tx.objectStore(STORE).get(name)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function write(name: string, value?: unknown) {
  const connection = await db()
  return new Promise<void>((resolve, reject) => {
    const tx = connection.transaction(STORE, 'readwrite')
    if (value === undefined) tx.objectStore(STORE).delete(name)
    else tx.objectStore(STORE).put(value, name)
    tx.oncomplete = () => resolve()
    tx.onabort = tx.onerror = () => reject(new Error('登录状态保存失败，请检查浏览器存储空间'))
  })
}
async function key(): Promise<CryptoKey> {
  const existing = await read<CryptoKey>('device-key')
  if (existing) return existing
  const generated = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  const connection = await db()
  // Creation is a read-modify-write transaction: concurrent tabs must share one key.
  return new Promise((resolve, reject) => {
    const tx = connection.transaction(STORE, 'readwrite'), store = tx.objectStore(STORE), request = store.get('device-key')
    let selected = generated
    request.onsuccess = () => { if (request.result) selected = request.result; else store.put(generated, 'device-key') }
    tx.oncomplete = () => resolve(selected)
    tx.onabort = tx.onerror = () => reject(new Error('无法创建本机加密密钥'))
  })
}
export const browserVault = {
  async get<T>(name: string): Promise<T | undefined> {
    const record = await read<{ iv: Uint8Array; data: ArrayBuffer }>(name)
    if (!record) return undefined
    try {
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.iv as BufferSource, additionalData: new TextEncoder().encode(name) }, await key(), record.data)
      return JSON.parse(new TextDecoder().decode(plain)) as T
    } catch { throw new Error('本机登录状态无法解密，请退出后重新登录') }
  },
  async set(name: string, value: unknown) {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(name) }, await key(), new TextEncoder().encode(JSON.stringify(value)))
    await write(name, { iv, data })
  },
  remove: (name: string) => write(name),
}
