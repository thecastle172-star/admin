/// <reference types="node" />
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { v } from 'convex/values'

const propertyData = {
  title: v.string(), location: v.string(), price: v.string(),
  type: v.union(v.literal('للبيع'), v.literal('للإيجار')),
  imageStorageId: v.optional(v.id('_storage')), imageFallback: v.optional(v.string()),
  description: v.string(), beds: v.number(), baths: v.number(), area: v.number(), published: v.boolean(),
}
const bannerData = {
  title: v.string(), eyebrow: v.string(), copy: v.string(),
  imageStorageId: v.optional(v.id('_storage')), imageFallback: v.optional(v.string()), active: v.boolean(),
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function randomHex(bytes: number) {
  const data = new Uint8Array(bytes)
  crypto.getRandomValues(data)
  return Array.from(data, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function passwordHash(password: string, salt: string) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 180_000 }, material, 256)
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function assertAdmin(adminToken: string) {
  const expectedHash = process.env.ADMIN_TOKEN_HASH
  if (!expectedHash || await sha256(adminToken) !== expectedHash) throw new Error('غير مصرح بتنفيذ هذا الإجراء.')
}

async function assertSession(ctx: QueryCtx | MutationCtx, sessionToken: string) {
  const tokenHash = await sha256(sessionToken)
  const session = await ctx.db.query('adminSessions').withIndex('by_token_hash', (q) => q.eq('tokenHash', tokenHash)).unique()
  if (!session || session.expiresAt <= Date.now()) throw new Error('انتهت جلسة الدخول. سجّل الدخول مرة أخرى.')
  return session.adminId
}

async function imageUrl(ctx: QueryCtx, storageId?: string, fallback?: string) {
  if (storageId) return await ctx.storage.getUrl(storageId as never) ?? fallback ?? ''
  return fallback ?? ''
}

async function getContent(ctx: QueryCtx, includeDrafts: boolean) {
  const propertyDocs = await ctx.db.query('properties').withIndex('by_updated_at').order('desc').collect()
  const bannerDocs = await ctx.db.query('banners').withIndex('by_updated_at').order('desc').collect()
  const settings = (await ctx.db.query('settings').first()) ?? { whatsapp: '+964 774 228 0870', contentVersion: 0, updatedAt: 0 }
  return {
    properties: await Promise.all(propertyDocs.filter((item) => includeDrafts || item.published).map(async (item) => ({ ...item, image: await imageUrl(ctx, item.imageStorageId, item.imageFallback) }))),
    banners: await Promise.all(bannerDocs.filter((item) => includeDrafts || item.active).map(async (item) => ({ ...item, image: await imageUrl(ctx, item.imageStorageId, item.imageFallback) }))),
    whatsapp: settings.whatsapp,
    contentVersion: settings.contentVersion,
  }
}

export const getPublic = query({ args: {}, handler: (ctx) => getContent(ctx, false) })
export const hasAdmin = query({ args: {}, handler: async (ctx) => Boolean(await ctx.db.query('admins').first()) })
export const setupAdmin = mutation({
  args: { adminToken: v.string(), email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    await assertAdmin(args.adminToken)
    if (await ctx.db.query('admins').first()) throw new Error('تم تأسيس حساب الإدارة مسبقًا.')
    const email = args.email.trim().toLowerCase()
    if (!email.includes('@')) throw new Error('عنوان البريد الإلكتروني غير صالح.')
    if (args.password.length < 10) throw new Error('كلمة المرور يجب ألا تقل عن 10 أحرف.')
    const salt = randomHex(16)
    await ctx.db.insert('admins', { email, passwordSalt: salt, passwordHash: await passwordHash(args.password, salt), createdAt: Date.now() })
  },
})
export const login = mutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase()
    const admin = await ctx.db.query('admins').withIndex('by_email', (q) => q.eq('email', email)).unique()
    if (!admin || await passwordHash(args.password, admin.passwordSalt) !== admin.passwordHash) throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.')
    const token = randomHex(32)
    await ctx.db.insert('adminSessions', { adminId: admin._id, tokenHash: await sha256(token), expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, createdAt: Date.now() })
    return { token, email: admin.email }
  },
})
export const logout = mutation({ args: { sessionToken: v.string() }, handler: async (ctx, args) => { const tokenHash = await sha256(args.sessionToken); const session = await ctx.db.query('adminSessions').withIndex('by_token_hash', (q) => q.eq('tokenHash', tokenHash)).unique(); if (session) await ctx.db.delete(session._id) } })

export const getAdmin = query({ args: { sessionToken: v.string() }, handler: async (ctx, args) => { await assertSession(ctx, args.sessionToken); return getContent(ctx, true) } })
export const generateUploadUrl = mutation({ args: { sessionToken: v.string() }, handler: async (ctx, args) => { await assertSession(ctx, args.sessionToken); return ctx.storage.generateUploadUrl() } })
export const deleteUploadedImage = mutation({ args: { sessionToken: v.string(), storageId: v.id('_storage') }, handler: async (ctx, args) => { await assertSession(ctx, args.sessionToken); await ctx.storage.delete(args.storageId) } })

async function bumpVersion(ctx: MutationCtx) {
  const settings = await ctx.db.query('settings').first()
  const now = Date.now()
  if (settings) await ctx.db.patch(settings._id, { contentVersion: settings.contentVersion + 1, updatedAt: now })
  else await ctx.db.insert('settings', { whatsapp: '+964 774 228 0870', contentVersion: 1, updatedAt: now })
}

export const saveProperty = mutation({
  args: { sessionToken: v.string(), id: v.optional(v.id('properties')), ...propertyData },
  handler: async (ctx, args) => {
    await assertSession(ctx, args.sessionToken)
    const { sessionToken: _sessionToken, id, ...data } = args
    if (id) {
      const existing = await ctx.db.get(id)
      if (!existing) throw new Error('العقار غير موجود.')
      if (existing.imageStorageId && data.imageStorageId && existing.imageStorageId !== data.imageStorageId) await ctx.storage.delete(existing.imageStorageId)
      await ctx.db.patch(id, { ...data, updatedAt: Date.now() })
      await bumpVersion(ctx)
      return id
    }
    const newId = await ctx.db.insert('properties', { ...data, updatedAt: Date.now() })
    await bumpVersion(ctx)
    return newId
  },
})

export const deleteProperty = mutation({ args: { sessionToken: v.string(), id: v.id('properties') }, handler: async (ctx, args) => { await assertSession(ctx, args.sessionToken); const item = await ctx.db.get(args.id); if (item?.imageStorageId) await ctx.storage.delete(item.imageStorageId); if (item) await ctx.db.delete(args.id); await bumpVersion(ctx) } })
export const saveBanner = mutation({
  args: { sessionToken: v.string(), id: v.optional(v.id('banners')), ...bannerData },
  handler: async (ctx, args) => {
    await assertSession(ctx, args.sessionToken)
    const { sessionToken: _sessionToken, id, ...data } = args
    if (id) {
      const existing = await ctx.db.get(id)
      if (!existing) throw new Error('البنر غير موجود.')
      if (existing.imageStorageId && data.imageStorageId && existing.imageStorageId !== data.imageStorageId) await ctx.storage.delete(existing.imageStorageId)
      await ctx.db.patch(id, { ...data, updatedAt: Date.now() })
      await bumpVersion(ctx)
      return id
    }
    const newId = await ctx.db.insert('banners', { ...data, updatedAt: Date.now() })
    await bumpVersion(ctx)
    return newId
  },
})
export const deleteBanner = mutation({ args: { sessionToken: v.string(), id: v.id('banners') }, handler: async (ctx, args) => { await assertSession(ctx, args.sessionToken); const item = await ctx.db.get(args.id); if (item?.imageStorageId) await ctx.storage.delete(item.imageStorageId); if (item) await ctx.db.delete(args.id); await bumpVersion(ctx) } })
export const saveSettings = mutation({ args: { sessionToken: v.string(), whatsapp: v.string() }, handler: async (ctx, args) => { await assertSession(ctx, args.sessionToken); const item = await ctx.db.query('settings').first(); const now = Date.now(); if (item) await ctx.db.patch(item._id, { whatsapp: args.whatsapp, contentVersion: item.contentVersion + 1, updatedAt: now }); else await ctx.db.insert('settings', { whatsapp: args.whatsapp, contentVersion: 1, updatedAt: now }) } })
