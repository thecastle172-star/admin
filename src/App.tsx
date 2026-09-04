import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { formatBytes, optimizeImage } from './lib/optimizeImage'
import type { ImagePreset, OptimizedImage } from './lib/optimizeImage'
import { canSetupAdmin, clearStoredSession, deleteBannerRemote, deletePropertyRemote, deleteUploadedImageRemote, getAdminContent, getStoredSession, hasAdminAccount, isConvexReady, loginAdmin, logoutAdmin, saveBannerRemote, savePropertyRemote, saveSettingsRemote, setupAdminAccount, uploadOptimizedImage } from './lib/convexContent'
import './App.css'

type Tab = 'dashboard' | 'properties' | 'banners' | 'settings'
type Property = { id: number | string; title: string; location: string; price: string; type: 'للبيع' | 'للإيجار'; image: string; imageStorageId?: string; description: string; beds: number; baths: number; area: number; published: boolean }
type Banner = { id: number | string; title: string; eyebrow: string; copy: string; image: string; imageStorageId?: string; active: boolean }

const seedProperties: Property[] = [
  { id: 1, title: 'فيلا عصرية بحديقة خاصة', location: 'بغداد، حي اليرموك', price: '480,000,000 د.ع', type: 'للبيع', image: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1100&q=85', description: 'فيلا واسعة بتصميم عصري وتشطيبات عالية الجودة، تقع في شارع هادئ وقريب من الخدمات.', beds: 5, baths: 4, area: 420, published: true },
  { id: 2, title: 'شقة مفروشة بإطلالة مفتوحة', location: 'بغداد، الجادرية', price: '1,800,000 د.ع / شهر', type: 'للإيجار', image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1100&q=85', description: 'شقة مفروشة بالكامل ومناسبة للعائلة وجاهزة للسكن الفوري.', beds: 3, baths: 2, area: 185, published: true },
  { id: 3, title: 'منزل هادئ بتصميم أنيق', location: 'بغداد، المنصور', price: '365,000,000 د.ع', type: 'للبيع', image: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1100&q=85', description: 'منزل عائلي بتوزيع عملي وغرف رحبة وقريب من المدارس والأسواق.', beds: 4, baths: 3, area: 310, published: false },
]
const seedBanners: Banner[] = [
  { id: 1, title: 'بيوت تليق بتفاصيل حياتك', eyebrow: 'فرصة هذا الأسبوع', copy: 'مجموعة مختارة من العقارات الحديثة في أفضل أحياء بغداد', image: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1800&q=88', active: true },
  { id: 2, title: 'إطلالة تبدأ منها الحكاية', eyebrow: 'سكن فاخر', copy: 'شقق وفلل بمواصفات استثنائية وخيارات دفع مرنة', image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=88', active: true },
  { id: 3, title: 'استثمر في المكان الصحيح', eyebrow: 'اختيار موثوق', copy: 'عقارات موثقة ومراجعة بعناية قبل عرضها', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=88', active: true },
]
const propertyBlank: Omit<Property, 'id'> = { title: '', location: '', price: '', type: 'للبيع', image: '', description: '', beds: 1, baths: 1, area: 100, published: true }
const bannerBlank: Omit<Banner, 'id'> = { title: '', eyebrow: '', copy: '', image: '', active: true }

function loadStored<T>(key: string, fallback: T): T { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback } catch { return fallback } }
function saveStored(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Convex remains the source of truth if local storage is full. */ } }

function Icon({ name }: { name: 'home' | 'building' | 'image' | 'settings' | 'plus' | 'edit' | 'trash' | 'menu' | 'search' | 'eye' | 'close' }) {
  const paths = {
    home: <><path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>, building: <><path d="M4 21V4h11v17M15 9h5v12M8 8h3m-3 4h3m-3 4h3M2 21h20"/></>, image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-4-4L5 20"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, edit: <><path d="m4 16-1 5 5-1L19 9l-4-4L4 16Z"/><path d="m13 7 4 4"/></>, trash: <><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/></>, menu: <path d="M4 7h16M4 12h16M4 17h16"/>, search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>, eye: <><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></>, close: <path d="m6 6 12 12M18 6 6 18"/>,
  }
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}
const tabs: { id: Tab; label: string; icon: 'home' | 'building' | 'image' | 'settings' }[] = [{ id: 'dashboard', label: 'الرئيسية', icon: 'home' }, { id: 'properties', label: 'العقارات', icon: 'building' }, { id: 'banners', label: 'البنرات', icon: 'image' }, { id: 'settings', label: 'الإعدادات', icon: 'settings' }]

function App() {
  const [authState, setAuthState] = useState<'checking' | 'setup' | 'login' | 'authenticated'>('checking')
  const [adminEmail, setAdminEmail] = useState('thecastle172@gmail.com')
  const expireSession = useCallback(() => { clearStoredSession(); setAuthState('login') }, [])
  const endSession = useCallback(async () => { await logoutAdmin().catch(() => undefined); setAuthState('login') }, [])

  useEffect(() => {
    let cancelled = false
    void hasAdminAccount().then((exists) => {
      if (!cancelled) setAuthState(exists ? (getStoredSession() ? 'authenticated' : 'login') : 'setup')
    }).catch(() => { if (!cancelled) setAuthState('login') })
    return () => { cancelled = true }
  }, [])

  if (authState === 'checking') return <AuthShell><div className="auth-loading"><span/><p>جاري تجهيز لوحة الإدارة…</p></div></AuthShell>
  if (authState === 'setup' || authState === 'login') return <AuthScreen mode={authState} initialEmail={adminEmail} onAuthenticated={(email) => { setAdminEmail(email); setAuthState('authenticated') }} onSetupComplete={() => setAuthState('login')}/>
  return <AdminPanel adminEmail={adminEmail} onAuthExpired={expireSession} onLogout={endSession}/>
}

function AdminPanel({ adminEmail, onAuthExpired, onLogout }: { adminEmail: string; onAuthExpired: () => void; onLogout: () => Promise<void> }) {
  const [tab, setTab] = useState<Tab>('dashboard'), [drawerOpen, setDrawerOpen] = useState(false)
  const [properties, setProperties] = useState<Property[]>(() => loadStored('castle-admin-properties', seedProperties)), [banners, setBanners] = useState<Banner[]>(() => loadStored('castle-admin-banners', seedBanners)), [whatsapp, setWhatsapp] = useState(() => loadStored('castle-admin-whatsapp', '+964 774 228 0870'))
  const [search, setSearch] = useState(''), [propertyForm, setPropertyForm] = useState<(Omit<Property, 'id'> & { id?: number | string }) | null>(null), [bannerForm, setBannerForm] = useState<(Omit<Banner, 'id'> & { id?: number | string }) | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'property' | 'banner'; id: number | string; name: string } | null>(null), [toast, setToast] = useState('')
  const [imageInfo, setImageInfo] = useState<OptimizedImage | null>(null), [isOptimizing, setIsOptimizing] = useState(false), [isSaving, setIsSaving] = useState(false)
  const [syncState, setSyncState] = useState<'loading' | 'online' | 'local' | 'error'>(isConvexReady ? 'loading' : 'local')
  useEffect(() => saveStored('castle-admin-properties', properties), [properties]); useEffect(() => saveStored('castle-admin-banners', banners), [banners]); useEffect(() => saveStored('castle-admin-whatsapp', whatsapp), [whatsapp])
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 2800); return () => window.clearTimeout(timer) }, [toast])
  useEffect(() => {
    if (!isConvexReady) return
    let cancelled = false
    const hydrate = async () => {
      try {
        let content = await getAdminContent()
        if (content.properties.length === 0 && content.banners.length === 0) {
          await Promise.all(seedProperties.map((item) => savePropertyRemote(item)))
          await Promise.all(seedBanners.map((item) => saveBannerRemote(item)))
          await saveSettingsRemote('+964 774 228 0870')
          content = await getAdminContent()
        }
        if (cancelled) return
        setProperties(content.properties.map((item) => ({ id: item._id, title: item.title, location: item.location, price: item.price, type: item.type, image: item.image, imageStorageId: item.imageStorageId, description: item.description, beds: item.beds, baths: item.baths, area: item.area, published: item.published })))
        setBanners(content.banners.map((item) => ({ id: item._id, title: item.title, eyebrow: item.eyebrow, copy: item.copy, image: item.image, imageStorageId: item.imageStorageId, active: item.active })))
        setWhatsapp(content.whatsapp)
        setSyncState('online')
      } catch (error) {
        const message = error instanceof Error ? error.message : ''
        if (!cancelled && (message.includes('جلسة') || message.includes('الدخول'))) onAuthExpired()
        else if (!cancelled) { setSyncState('error'); setToast('تعذر الاتصال بقاعدة البيانات؛ عُرضت النسخة المحلية.') }
      }
    }
    void hydrate()
    return () => { cancelled = true }
  }, [onAuthExpired])
  const filteredProperties = useMemo(() => properties.filter((item) => `${item.title} ${item.location} ${item.price}`.includes(search.trim())), [properties, search]), title = tabs.find((item) => item.id === tab)?.label
  const chooseTab = (next: Tab) => { setTab(next); setDrawerOpen(false) }
  const refreshRemote = async () => {
    const content = await getAdminContent()
    setProperties(content.properties.map((item) => ({ id: item._id, title: item.title, location: item.location, price: item.price, type: item.type, image: item.image, imageStorageId: item.imageStorageId, description: item.description, beds: item.beds, baths: item.baths, area: item.area, published: item.published })))
    setBanners(content.banners.map((item) => ({ id: item._id, title: item.title, eyebrow: item.eyebrow, copy: item.copy, image: item.image, imageStorageId: item.imageStorageId, active: item.active })))
    setWhatsapp(content.whatsapp)
  }
  const saveProperty = async (event: FormEvent) => {
    event.preventDefault(); if (!propertyForm || isSaving) return
    const wasEditing = Boolean(propertyForm.id); let storageId: Awaited<ReturnType<typeof uploadOptimizedImage>> | undefined; setIsSaving(true)
    try {
      if (isConvexReady) { storageId = imageInfo ? await uploadOptimizedImage(imageInfo.blob) : undefined; await savePropertyRemote(propertyForm, storageId); await refreshRemote() }
      else if (propertyForm.id) setProperties((items) => items.map((item) => item.id === propertyForm.id ? propertyForm as Property : item))
      else setProperties((items) => [{ ...propertyForm, id: Date.now() }, ...items])
      setPropertyForm(null); setImageInfo(null); setToast(wasEditing ? 'تم تعديل العقار وحفظه' : 'تم رفع الصورة وإضافة العقار')
    } catch (error) { if (storageId) void deleteUploadedImageRemote(storageId).catch(() => undefined); setToast(error instanceof Error ? error.message : 'تعذر حفظ العقار') } finally { setIsSaving(false) }
  }
  const saveBanner = async (event: FormEvent) => {
    event.preventDefault(); if (!bannerForm || isSaving) return
    const wasEditing = Boolean(bannerForm.id); let storageId: Awaited<ReturnType<typeof uploadOptimizedImage>> | undefined; setIsSaving(true)
    try {
      if (isConvexReady) { storageId = imageInfo ? await uploadOptimizedImage(imageInfo.blob) : undefined; await saveBannerRemote(bannerForm, storageId); await refreshRemote() }
      else if (bannerForm.id) setBanners((items) => items.map((item) => item.id === bannerForm.id ? bannerForm as Banner : item))
      else setBanners((items) => [{ ...bannerForm, id: Date.now() }, ...items])
      setBannerForm(null); setImageInfo(null); setToast(wasEditing ? 'تم تعديل البنر وحفظه' : 'تم رفع الصورة وإضافة البنر')
    } catch (error) { if (storageId) void deleteUploadedImageRemote(storageId).catch(() => undefined); setToast(error instanceof Error ? error.message : 'تعذر حفظ البنر') } finally { setIsSaving(false) }
  }
  const chooseImage = async (event: ChangeEvent<HTMLInputElement>, preset: ImagePreset) => {
    const file = event.target.files?.[0]
    if (!file) return
    setIsOptimizing(true)
    try {
      const optimized = await optimizeImage(file, preset)
      setImageInfo(optimized)
      if (preset === 'property') setPropertyForm((current) => current ? { ...current, image: optimized.dataUrl } : current)
      else setBannerForm((current) => current ? { ...current, image: optimized.dataUrl } : current)
      setToast('تم تحويل الصورة إلى WebP وتقليل حجمها')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'تعذرت معالجة الصورة')
      event.target.value = ''
    } finally {
      setIsOptimizing(false)
    }
  }
  const confirmDelete = async () => {
    if (!deleteTarget || isSaving) return
    setIsSaving(true)
    try {
      if (isConvexReady && typeof deleteTarget.id === 'string') { if (deleteTarget.kind === 'property') await deletePropertyRemote(deleteTarget.id); else await deleteBannerRemote(deleteTarget.id) }
      if (deleteTarget.kind === 'property') setProperties((items) => items.filter((item) => item.id !== deleteTarget.id)); else setBanners((items) => items.filter((item) => item.id !== deleteTarget.id))
      setDeleteTarget(null); setToast('تم الحذف من قاعدة البيانات')
    } catch (error) { setToast(error instanceof Error ? error.message : 'تعذر الحذف') } finally { setIsSaving(false) }
  }

  return <div className="admin-app" dir="rtl">
    <aside className={`sidebar ${drawerOpen ? 'open' : ''}`}><div className="brand"><span>ق</span><div><strong>قلعة عقارات الدورة</strong><small>لوحة الإدارة</small></div></div><nav aria-label="تبويبات لوحة الإدارة">{tabs.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => chooseTab(item.id)} type="button"><Icon name={item.icon}/><span>{item.label}</span></button>)}</nav><div className={`storage-note ${syncState}`}><span>{syncState === 'online' ? 'متصل بقاعدة البيانات' : syncState === 'loading' ? 'جاري الاتصال' : syncState === 'error' ? 'تعذر الاتصال' : 'حفظ محلي'}</span><p>{syncState === 'online' ? 'الصور والبيانات تُرفع إلى Convex بعد التحسين.' : 'تُستخدم النسخة المحلية الاحتياطية على هذا الجهاز.'}</p></div></aside>
    {drawerOpen && <button className="drawer-backdrop" aria-label="إغلاق القائمة" onClick={() => setDrawerOpen(false)}/>}<div className="workspace"><header className="topbar"><button className="menu-button" type="button" onClick={() => setDrawerOpen(true)} aria-label="فتح القائمة"><Icon name="menu"/></button><div><p>لوحة الإدارة</p><h1>{title}</h1></div><div className="admin-profile"><span>م</span><div><strong>{adminEmail}</strong><small>متصل الآن</small></div><button className="logout-button" type="button" onClick={() => void onLogout()}>تسجيل الخروج</button></div></header><main>
      {tab === 'dashboard' && <Dashboard properties={properties} banners={banners} onGo={chooseTab}/>} 
      {tab === 'properties' && <section className="page-section"><PageHeading title="إدارة العقارات" copy="أضف العقارات وعدّل تفاصيلها وحالة عرضها." action="إضافة عقار" onAction={() => { setImageInfo(null); setPropertyForm({ ...propertyBlank }) }}/><div className="toolbar"><label className="search"><Icon name="search"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث بالعنوان أو الموقع أو السعر"/></label><span>{filteredProperties.length} عقار</span></div><div className="cards-list">{filteredProperties.map((property) => <article className="manage-card" key={property.id}><img src={property.image} alt={property.title}/><div className="card-body"><div className="card-tags"><span className={property.published ? 'status published' : 'status draft'}>{property.published ? 'منشور' : 'مسودة'}</span><span>{property.type}</span></div><h3>{property.title}</h3><p>{property.location}</p><strong>{property.price}</strong><div className="details"><span>{property.beds} غرف</span><span>{property.baths} حمام</span><span>{property.area} م²</span></div></div><div className="card-actions"><button type="button" onClick={() => { setImageInfo(null); setPropertyForm({ ...property }) }}><Icon name="edit"/>تعديل</button><button className="danger" type="button" onClick={() => setDeleteTarget({ kind: 'property', id: property.id, name: property.title })}><Icon name="trash"/>حذف</button></div></article>)}</div>{filteredProperties.length === 0 && <Empty text="لا توجد عقارات تطابق البحث."/>}</section>}
      {tab === 'banners' && <section className="page-section"><PageHeading title="إدارة البنرات" copy="تحكّم بإعلانات الواجهة وترتيب المحتوى الظاهر." action="إضافة بنر" onAction={() => { setImageInfo(null); setBannerForm({ ...bannerBlank }) }}/><div className="cards-list banner-list">{banners.map((banner) => <article className="manage-card banner-card" key={banner.id}><img src={banner.image} alt={banner.title}/><div className="card-body"><div className="card-tags"><span className={banner.active ? 'status published' : 'status draft'}>{banner.active ? 'فعّال' : 'متوقف'}</span><span>نسبة 2.35:1</span></div><small>{banner.eyebrow}</small><h3>{banner.title}</h3><p>{banner.copy}</p></div><div className="card-actions"><button type="button" onClick={() => { setImageInfo(null); setBannerForm({ ...banner }) }}><Icon name="edit"/>تعديل</button><button className="danger" type="button" onClick={() => setDeleteTarget({ kind: 'banner', id: banner.id, name: banner.title })}><Icon name="trash"/>حذف</button></div></article>)}</div>{banners.length === 0 && <Empty text="لم تتم إضافة أي بنر بعد."/>}</section>}
      {tab === 'settings' && <section className="page-section"><PageHeading title="إعدادات التواصل" copy="عدّل رقم واتساب الذي سيظهر للزوار."/><form className="settings-card" onSubmit={async (event) => { event.preventDefault(); if (isSaving) return; setIsSaving(true); try { if (isConvexReady) await saveSettingsRemote(whatsapp); setToast('تم حفظ الإعدادات في قاعدة البيانات') } catch (error) { setToast(error instanceof Error ? error.message : 'تعذر حفظ الإعدادات') } finally { setIsSaving(false) } }}><div className="settings-icon"><Icon name="settings"/></div><div><h2>رقم واتساب</h2><p>اكتب الرقم بصيغة دولية ليعمل زر الاستفسار بصورة صحيحة.</p></div><label><span>رقم التواصل</span><input dir="ltr" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} required placeholder="+964 7XX XXX XXXX"/></label><button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? 'جاري الحفظ…' : 'حفظ الإعدادات'}</button></form></section>}
    </main></div>
    {propertyForm && <Modal title={propertyForm.id ? 'تعديل العقار' : 'إضافة عقار جديد'} onClose={() => { setPropertyForm(null); setImageInfo(null) }}><form className="modal-form" onSubmit={saveProperty}><div className="form-grid"><Field label="عنوان العقار"><input value={propertyForm.title} onChange={(e) => setPropertyForm({ ...propertyForm, title: e.target.value })} required/></Field><Field label="الموقع"><input value={propertyForm.location} onChange={(e) => setPropertyForm({ ...propertyForm, location: e.target.value })} required/></Field><Field label="السعر"><input value={propertyForm.price} onChange={(e) => setPropertyForm({ ...propertyForm, price: e.target.value })} required/></Field><Field label="نوع العرض"><select value={propertyForm.type} onChange={(e) => setPropertyForm({ ...propertyForm, type: e.target.value as Property['type'] })}><option>للبيع</option><option>للإيجار</option></select></Field><ImagePicker image={propertyForm.image} info={imageInfo} busy={isOptimizing} onChange={(event) => chooseImage(event, 'property')} hint="تُحوّل إلى WebP بوضوح عالٍ وبحد أقصى 1600px و650KB."/><Field label="الوصف" wide><textarea rows={4} value={propertyForm.description} onChange={(e) => setPropertyForm({ ...propertyForm, description: e.target.value })} required/></Field><Field label="غرف النوم"><input type="number" min="0" value={propertyForm.beds} onChange={(e) => setPropertyForm({ ...propertyForm, beds: Number(e.target.value) })} required/></Field><Field label="الحمامات"><input type="number" min="0" value={propertyForm.baths} onChange={(e) => setPropertyForm({ ...propertyForm, baths: Number(e.target.value) })} required/></Field><Field label="المساحة م²"><input type="number" min="1" value={propertyForm.area} onChange={(e) => setPropertyForm({ ...propertyForm, area: Number(e.target.value) })} required/></Field><label className="toggle-field"><span>نشر العقار</span><input type="checkbox" checked={propertyForm.published} onChange={(e) => setPropertyForm({ ...propertyForm, published: e.target.checked })}/><i/></label></div><ModalActions onCancel={() => { setPropertyForm(null); setImageInfo(null) }} disabled={isOptimizing || isSaving || !propertyForm.image} saving={isSaving}/></form></Modal>}
    {bannerForm && <Modal title={bannerForm.id ? 'تعديل البنر' : 'إضافة بنر جديد'} onClose={() => { setBannerForm(null); setImageInfo(null) }}><form className="modal-form" onSubmit={saveBanner}><div className="form-grid"><Field label="النص الصغير"><input value={bannerForm.eyebrow} onChange={(e) => setBannerForm({ ...bannerForm, eyebrow: e.target.value })} required/></Field><Field label="عنوان البنر"><input value={bannerForm.title} onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })} required/></Field><Field label="الوصف" wide><textarea rows={3} value={bannerForm.copy} onChange={(e) => setBannerForm({ ...bannerForm, copy: e.target.value })} required/></Field><ImagePicker image={bannerForm.image} info={imageInfo} busy={isOptimizing} onChange={(event) => chooseImage(event, 'banner')} hint="أفضل نتيجة بنسبة 2.35:1؛ WebP حتى 1880px و800KB."/><label className="toggle-field"><span>تفعيل البنر</span><input type="checkbox" checked={bannerForm.active} onChange={(e) => setBannerForm({ ...bannerForm, active: e.target.checked })}/><i/></label></div><ModalActions onCancel={() => { setBannerForm(null); setImageInfo(null) }} disabled={isOptimizing || isSaving || !bannerForm.image} saving={isSaving}/></form></Modal>}
    {deleteTarget && <Modal title="تأكيد الحذف" onClose={() => setDeleteTarget(null)} small><div className="delete-dialog"><span className="delete-icon"><Icon name="trash"/></span><p>هل تريد حذف <strong>«{deleteTarget.name}»</strong>؟ لا يمكن التراجع عن هذا الإجراء.</p><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setDeleteTarget(null)}>إلغاء</button><button type="button" className="delete-button" onClick={confirmDelete}>نعم، احذف</button></div></div></Modal>}{toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
  </div>
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return <main className="auth-page" dir="rtl"><section className="auth-card"><div className="auth-brand"><span>ق</span><div><strong>قلعة عقارات الدورة</strong><small>لوحة الإدارة الآمنة</small></div></div>{children}</section></main>
}

function AuthScreen({ mode, initialEmail, onAuthenticated, onSetupComplete }: { mode: 'setup' | 'login'; initialEmail: string; onAuthenticated: (email: string) => void; onSetupComplete: () => void }) {
  const [email, setEmail] = useState(initialEmail), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const isSetup = mode === 'setup'
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return
    setError('')
    if (isSetup && password !== confirmation) { setError('كلمتا المرور غير متطابقتين.'); return }
    setBusy(true)
    try {
      if (isSetup) { await setupAdminAccount(email, password); onSetupComplete() }
      else { const result = await loginAdmin(email, password); onAuthenticated(result.email) }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذر إكمال العملية.') }
    finally { setBusy(false) }
  }
  return <AuthShell><div className="auth-heading"><span>{isSetup ? 'الإعداد الأول' : 'مرحبًا بعودتك'}</span><h1>{isSetup ? 'إنشاء حساب مدير' : 'تسجيل الدخول'}</h1><p>{isSetup ? 'أنشئ كلمة مرور جديدة وخاصة بهذه اللوحة. لا تستخدم كلمة مرور حساب Google أو GitHub.' : 'أدخل بيانات حساب المدير للوصول إلى العقارات والبنرات.'}</p></div>{isSetup && !canSetupAdmin ? <div className="auth-error">إنشاء الحساب متاح فقط من جهاز الإعداد المحلي.</div> : <form className="auth-form" onSubmit={submit}><label><span>البريد الإلكتروني</span><input dir="ltr" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required/></label><label><span>كلمة المرور</span><input dir="ltr" type="password" autoComplete={isSetup ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} required/></label>{isSetup && <label><span>تأكيد كلمة المرور</span><input dir="ltr" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={10} required/></label>}{error && <div className="auth-error" role="alert">{error}</div>}<button className="primary-button" type="submit" disabled={busy}>{busy ? 'جاري الحفظ…' : isSetup ? 'إنشاء الحساب' : 'دخول آمن'}</button></form>}<p className="auth-note">الاتصال مشفّر، وكلمة المرور لا تُحفظ داخل ملفات الموقع.</p></AuthShell>
}

function Dashboard({ properties, banners, onGo }: { properties: Property[]; banners: Banner[]; onGo: (tab: Tab) => void }) {
  const stats = [{ label: 'إجمالي العقارات', value: properties.length, sub: `${properties.filter((item) => item.published).length} منشور`, icon: 'building' as const }, { label: 'البنرات الفعّالة', value: banners.filter((item) => item.active).length, sub: `من أصل ${banners.length}`, icon: 'image' as const }, { label: 'عقارات للبيع', value: properties.filter((item) => item.type === 'للبيع').length, sub: 'ضمن القائمة الحالية', icon: 'home' as const }]
  return <section className="page-section dashboard"><div className="welcome"><div><span>صباح الخير 👋</span><h2>أهلاً بك في قلعة العقارات</h2><p>راجع المحتوى وأدر عروضك من مكان واحد.</p></div><button className="primary-button" onClick={() => onGo('properties')}><Icon name="plus"/>إضافة عقار</button></div><div className="stats-grid">{stats.map((stat) => <article key={stat.label}><span className="stat-icon"><Icon name={stat.icon}/></span><div><p>{stat.label}</p><strong>{stat.value}</strong><small>{stat.sub}</small></div></article>)}</div><div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><h3>أحدث العقارات</h3><p>آخر العناصر المضافة</p></div><button onClick={() => onGo('properties')}>عرض الكل</button></div>{properties.slice(0, 4).map((property) => <div className="recent-row" key={property.id}><img src={property.image} alt=""/><div><strong>{property.title}</strong><small>{property.location}</small></div><span className={property.published ? 'status published' : 'status draft'}>{property.published ? 'منشور' : 'مسودة'}</span></div>)}{properties.length === 0 && <Empty text="لا توجد عقارات."/>}</section><section className="panel quick-panel"><div className="panel-heading"><div><h3>إدارة سريعة</h3><p>اختصارات للمهام اليومية</p></div></div><button onClick={() => onGo('properties')}><span><Icon name="building"/></span><div><strong>إدارة العقارات</strong><small>إضافة وتعديل وحذف العقارات</small></div>←</button><button onClick={() => onGo('banners')}><span><Icon name="image"/></span><div><strong>إدارة البنرات</strong><small>تحكّم بإعلانات الواجهة</small></div>←</button><button onClick={() => onGo('settings')}><span><Icon name="settings"/></span><div><strong>رقم واتساب</strong><small>تحديث وسيلة التواصل</small></div>←</button></section></div></section>
}
function PageHeading({ title, copy, action, onAction }: { title: string; copy: string; action?: string; onAction?: () => void }) { return <div className="page-heading"><div><h2>{title}</h2><p>{copy}</p></div>{action && <button className="primary-button" onClick={onAction}><Icon name="plus"/>{action}</button>}</div> }
function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={wide ? 'wide' : ''}><span>{label}</span>{children}</label> }
function ModalActions({ onCancel, disabled = false, saving = false }: { onCancel: () => void; disabled?: boolean; saving?: boolean }) { return <div className="modal-actions"><button className="secondary-button" type="button" onClick={onCancel} disabled={saving}>إلغاء</button><button className="primary-button" type="submit" disabled={disabled}>{saving ? 'جاري الرفع والحفظ…' : 'حفظ التغييرات'}</button></div> }
function ImagePicker({ image, info, busy, hint, onChange }: { image: string; info: OptimizedImage | null; busy: boolean; hint: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <div className="image-picker wide">
    <span>صورة من الاستوديو</span>
    <label className={`upload-zone ${busy ? 'busy' : ''}`}>
      <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={onChange} disabled={busy}/>
      {image ? <img src={image} alt="معاينة الصورة المختارة"/> : <span className="upload-placeholder"><Icon name="image"/><strong>{busy ? 'جاري تحسين الصورة…' : 'اضغط لاختيار صورة'}</strong><small>JPG أو PNG أو WebP — حتى 20MB</small></span>}
      {image && <span className="replace-image">{busy ? 'جاري التحويل…' : 'تغيير الصورة'}</span>}
    </label>
    <small className="upload-hint">{hint}</small>
    {info && <div className="image-result"><b>WebP جاهزة</b><span>{info.width}×{info.height}</span><span>{formatBytes(info.originalBytes)} ← {formatBytes(info.optimizedBytes)}</span></div>}
  </div>
}
function Modal({ title, onClose, children, small }: { title: string; onClose: () => void; children: React.ReactNode; small?: boolean }) { return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className={`modal ${small ? 'small' : ''}`} role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="إغلاق"><Icon name="close"/></button></header>{children}</section></div> }
function Empty({ text }: { text: string }) { return <div className="empty"><Icon name="eye"/><p>{text}</p></div> }
export default App
