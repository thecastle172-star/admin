import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

const convexUrl = import.meta.env.VITE_CONVEX_URL
// The one-time setup credential is compiled only by the local development server.
// Production builds never receive or contain this value.
const setupToken = import.meta.env.DEV ? import.meta.env.VITE_ADMIN_TOKEN : undefined
const client = convexUrl ? new ConvexHttpClient(convexUrl) : null
const sessionKey = 'castle-admin-session-v1'

export const isConvexReady = Boolean(client)
export const canSetupAdmin = Boolean(client && setupToken)

function requireClient() {
  if (!client) throw new Error('إعداد Convex غير مكتمل في هذا الجهاز.')
  return client
}

export function getStoredSession() {
  try { return localStorage.getItem(sessionKey) ?? '' } catch { return '' }
}

export function storeSession(token: string) {
  try { localStorage.setItem(sessionKey, token) } catch { throw new Error('تعذر حفظ جلسة الدخول على هذا الجهاز.') }
}

export function clearStoredSession() {
  try { localStorage.removeItem(sessionKey) } catch { /* The expired token is harmless if storage is unavailable. */ }
}

function requireSession() {
  const sessionToken = getStoredSession()
  if (!sessionToken) throw new Error('سجّل الدخول أولًا.')
  return { client: requireClient(), sessionToken }
}

export async function hasAdminAccount() {
  return requireClient().query(api.content.hasAdmin, {})
}

export async function setupAdminAccount(email: string, password: string) {
  if (!setupToken) throw new Error('إنشاء الحساب متاح فقط من جهاز الإعداد المحلي.')
  await requireClient().mutation(api.content.setupAdmin, { adminToken: setupToken, email, password })
}

export async function loginAdmin(email: string, password: string) {
  const result = await requireClient().mutation(api.content.login, { email, password })
  storeSession(result.token)
  return result
}

export async function logoutAdmin() {
  const sessionToken = getStoredSession()
  clearStoredSession()
  if (sessionToken) await requireClient().mutation(api.content.logout, { sessionToken })
}

export async function getAdminContent() {
  const connection = requireSession()
  return connection.client.query(api.content.getAdmin, { sessionToken: connection.sessionToken })
}

export async function uploadOptimizedImage(blob: Blob) {
  const connection = requireSession()
  const uploadUrl = await connection.client.mutation(api.content.generateUploadUrl, { sessionToken: connection.sessionToken })
  const response = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': 'image/webp' }, body: blob })
  if (!response.ok) throw new Error('فشل رفع الصورة إلى التخزين. حاول مرة أخرى.')
  const result = await response.json() as { storageId: Id<'_storage'> }
  return result.storageId
}

export async function deleteUploadedImageRemote(storageId: Id<'_storage'>) {
  const connection = requireSession()
  await connection.client.mutation(api.content.deleteUploadedImage, { sessionToken: connection.sessionToken, storageId })
}

type PropertyInput = {
  id?: number | string; title: string; location: string; price: string; type: 'للبيع' | 'للإيجار';
  image: string; imageStorageId?: string; description: string; beds: number; baths: number; area: number; published: boolean
}

export async function savePropertyRemote(property: PropertyInput, newStorageId?: Id<'_storage'>) {
  const connection = requireSession()
  return connection.client.mutation(api.content.saveProperty, {
    sessionToken: connection.sessionToken,
    id: typeof property.id === 'string' ? property.id as Id<'properties'> : undefined,
    title: property.title, location: property.location, price: property.price, type: property.type,
    imageStorageId: newStorageId ?? property.imageStorageId as Id<'_storage'> | undefined,
    imageFallback: newStorageId ? undefined : property.image.startsWith('data:') ? undefined : property.image,
    description: property.description, beds: property.beds, baths: property.baths, area: property.area, published: property.published,
  })
}

type BannerInput = { id?: number | string; title: string; eyebrow: string; copy: string; image: string; imageStorageId?: string; active: boolean }
export async function saveBannerRemote(banner: BannerInput, newStorageId?: Id<'_storage'>) {
  const connection = requireSession()
  return connection.client.mutation(api.content.saveBanner, {
    sessionToken: connection.sessionToken,
    id: typeof banner.id === 'string' ? banner.id as Id<'banners'> : undefined,
    title: banner.title, eyebrow: banner.eyebrow, copy: banner.copy,
    imageStorageId: newStorageId ?? banner.imageStorageId as Id<'_storage'> | undefined,
    imageFallback: newStorageId ? undefined : banner.image.startsWith('data:') ? undefined : banner.image,
    active: banner.active,
  })
}

export async function deletePropertyRemote(id: string) { const connection = requireSession(); await connection.client.mutation(api.content.deleteProperty, { sessionToken: connection.sessionToken, id: id as Id<'properties'> }) }
export async function deleteBannerRemote(id: string) { const connection = requireSession(); await connection.client.mutation(api.content.deleteBanner, { sessionToken: connection.sessionToken, id: id as Id<'banners'> }) }
export async function saveSettingsRemote(whatsapp: string) { const connection = requireSession(); await connection.client.mutation(api.content.saveSettings, { sessionToken: connection.sessionToken, whatsapp }) }
