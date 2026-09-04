import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  properties: defineTable({
    title: v.string(),
    location: v.string(),
    price: v.string(),
    type: v.union(v.literal('للبيع'), v.literal('للإيجار')),
    imageStorageId: v.optional(v.id('_storage')),
    imageFallback: v.optional(v.string()),
    description: v.string(),
    beds: v.number(),
    baths: v.number(),
    area: v.number(),
    published: v.boolean(),
    updatedAt: v.number(),
  }).index('by_updated_at', ['updatedAt']),
  banners: defineTable({
    title: v.string(),
    eyebrow: v.string(),
    copy: v.string(),
    imageStorageId: v.optional(v.id('_storage')),
    imageFallback: v.optional(v.string()),
    active: v.boolean(),
    updatedAt: v.number(),
  }).index('by_updated_at', ['updatedAt']),
  settings: defineTable({
    whatsapp: v.string(),
    contentVersion: v.number(),
    updatedAt: v.number(),
  }),
  admins: defineTable({
    email: v.string(),
    passwordSalt: v.string(),
    passwordHash: v.string(),
    createdAt: v.number(),
  }).index('by_email', ['email']),
  adminSessions: defineTable({
    adminId: v.id('admins'),
    tokenHash: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index('by_token_hash', ['tokenHash']),
})
