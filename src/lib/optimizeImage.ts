export type ImagePreset = 'property' | 'banner'

export type OptimizedImage = {
  blob: Blob
  dataUrl: string
  width: number
  height: number
  originalBytes: number
  optimizedBytes: number
  fileName: string
}

const MAX_INPUT_BYTES = 20 * 1024 * 1024

const presets = {
  property: { maxWidth: 1600, maxHeight: 1600, targetBytes: 650 * 1024 },
  banner: { maxWidth: 1880, maxHeight: 1000, targetBytes: 800 * 1024 },
} as const

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('تعذر تحويل الصورة إلى WebP.')),
      'image/webp',
      quality,
    )
  })
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('تعذرت قراءة الصورة بعد المعالجة.'))
    reader.readAsDataURL(blob)
  })
}

export async function optimizeImage(file: File, presetName: ImagePreset): Promise<OptimizedImage> {
  if (!file.type.startsWith('image/')) throw new Error('اختر ملف صورة صالحًا.')
  if (file.size > MAX_INPUT_BYTES) throw new Error('حجم الصورة الأصلية يجب ألا يتجاوز 20 ميغابايت.')

  const preset = presets[presetName]
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, preset.maxWidth / bitmap.width, preset.maxHeight / bitmap.height)
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) {
    bitmap.close()
    throw new Error('المتصفح لا يدعم معالجة الصور المطلوبة.')
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  let quality = 0.92
  let blob = await canvasToBlob(canvas, quality)
  while (blob.size > preset.targetBytes && quality > 0.72) {
    quality = Math.max(0.72, quality - 0.04)
    blob = await canvasToBlob(canvas, quality)
  }

  // Detailed photos can remain too large even at the minimum quality.
  // Reduce dimensions as well, so the upload size limit is actually enforced.
  while (blob.size > preset.targetBytes && Math.max(canvas.width, canvas.height) > 320) {
    const resized = document.createElement('canvas')
    resized.width = Math.max(1, Math.round(canvas.width * 0.8))
    resized.height = Math.max(1, Math.round(canvas.height * 0.8))
    const resizedContext = resized.getContext('2d', { alpha: false })
    if (!resizedContext) throw new Error('تعذر تصغير الصورة إلى الحجم المطلوب.')
    resizedContext.imageSmoothingEnabled = true
    resizedContext.imageSmoothingQuality = 'high'
    resizedContext.drawImage(canvas, 0, 0, resized.width, resized.height)
    canvas.width = resized.width
    canvas.height = resized.height
    context.drawImage(resized, 0, 0)
    blob = await canvasToBlob(canvas, quality)
  }
  if (blob.size > preset.targetBytes) throw new Error('تعذر ضغط الصورة إلى الحجم المسموح. اختر صورة أصغر.')

  const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'image'
  return {
    blob,
    dataUrl: await blobToDataUrl(blob),
    width: canvas.width,
    height: canvas.height,
    originalBytes: file.size,
    optimizedBytes: blob.size,
    fileName: `${safeBase}.webp`,
  }
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} بايت`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} كيلوبايت`
  return `${(bytes / 1024 / 1024).toFixed(1)} ميغابايت`
}
