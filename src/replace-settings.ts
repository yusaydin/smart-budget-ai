import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const settingsStartIndex = content.indexOf('function SettingsView({ profile, toggleCorporate }');
if (settingsStartIndex === -1) {
    console.error("SettingsView not found");
    process.exit(1);
}

const settingsEndIndex = content.indexOf('function AddExpenseModal', settingsStartIndex);
if (settingsEndIndex === -1) {
    console.error("AddExpenseModal not found");
    process.exit(1);
}

const newSettingsView = `function SettingsView({ profile, toggleCorporate }: { profile: UserProfile | null, toggleCorporate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-lg pt-4"
    >
      {/* Header: Profile Picture & Basic Info */}
      <section className="flex flex-col items-center pt-lg">
        <div className="w-24 h-24 rounded-full overflow-hidden mb-4 shadow-[0px_4px_12px_rgba(49,124,184,0.08)] bg-surface-container border-4 border-surface relative">
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-[64px] text-surface-dim absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              account_circle
            </span>
          )}
        </div>
        <h2 className="font-headline-md text-headline-md text-on-surface mb-1">{profile?.displayName || 'Kullanıcı'}</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">{profile?.email}</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-lg pb-10">
        {/* Left Column */}
        <div className="space-y-lg">
          {/* Personal Information */}
          <section className="bg-surface-container-lowest rounded-xl p-lg shadow-[0px_4px_12px_rgba(49,124,184,0.08)]">
            <h3 className="font-label-md text-label-md text-primary mb-md uppercase tracking-wider">Kişisel Bilgiler</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-surface-variant last:border-0">
                <div>
                  <p className="font-label-md text-label-md text-on-surface-variant">Ad Soyad</p>
                  <p className="font-body-md text-body-md text-on-surface">{profile?.displayName || 'Belirtilmemiş'}</p>
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-surface-variant last:border-0">
                <div>
                  <p className="font-label-md text-label-md text-on-surface-variant block mb-1">Aylık Gelir</p>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number"
                      defaultValue={profile?.monthlyIncome || ''}
                      onBlur={async (e) => {
                        const val = parseFloat(e.target.value);
                        if (profile && !isNaN(val)) await setDoc(doc(db, 'users', profile.uid), { ...profile, monthlyIncome: val });
                      }}
                      className="bg-transparent font-body-md text-on-surface outline-none w-24 border-b border-transparent focus:border-primary transition-colors hover:border-surface-variant"
                      placeholder="0"
                    />
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">edit</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-surface-variant last:border-0">
                <div className="w-full">
                  <p className="font-label-md text-label-md text-on-surface-variant block mb-1">Para Birimi</p>
                  <div className="flex items-center justify-between">
                    <select 
                      value={profile?.currency || 'TRY'}
                      onChange={async (e) => {
                        const val = e.target.value;
                        if (profile) await setDoc(doc(db, 'users', profile.uid), { ...profile, currency: val });
                      }}
                      className="w-full bg-transparent font-body-md text-on-surface outline-none transition-colors appearance-none cursor-pointer"
                    >
                      {COMMON_CURRENCIES.map(c => (
                        <option className="text-on-surface" key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant pointer-events-none">expand_more</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Preferences */}
          <section className="bg-surface-container-lowest rounded-xl p-lg shadow-[0px_4px_12px_rgba(49,124,184,0.08)]">
            <h3 className="font-label-md text-label-md text-primary mb-md uppercase tracking-wider">Tercihler</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-surface-variant">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-tertiary">business_center</span>
                  <div>
                    <span className="font-body-md text-body-md text-on-surface block">Kurumsal Hesap</span>
                    <span className="font-label-md text-on-surface-variant text-[11px] block">Vergi optimizasyonu & gider takibi</span>
                  </div>
                </div>
                <button 
                  onClick={toggleCorporate}
                  className={\`w-12 h-6 rounded-full relative transition-colors focus:outline-none \${profile?.isCorporate ? 'bg-primary' : 'bg-surface-variant'}\`}
                >
                  <div className={\`w-5 h-5 rounded-full absolute top-0.5 shadow-sm transition-transform \${profile?.isCorporate ? 'bg-on-primary right-0.5 translate-x-0' : 'bg-on-surface left-0.5 translate-x-0'}\`}></div>
                </button>
              </div>
              <div className="flex justify-between items-center py-2 border-surface-variant">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-on-surface-variant">dark_mode</span>
                  <span className="font-body-md text-body-md text-on-surface">Karanlık Mod (Sistem)</span>
                </div>
                <button className="w-12 h-6 bg-primary rounded-full relative transition-colors opacity-60 cursor-default">
                  <div className="w-5 h-5 bg-on-primary rounded-full absolute right-0.5 top-0.5 shadow-sm"></div>
                </button>
              </div>
            </div>
          </section>

          {/* Financial Goals Placeholder */}
          <section className="bg-surface-container-lowest rounded-xl p-lg shadow-[0px_4px_12px_rgba(49,124,184,0.08)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-secondary-container/30 rounded-bl-full -z-10"></div>
            <h3 className="font-label-md text-label-md text-primary mb-md uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">flag</span> Aktif Hedef (Örnek)
            </h3>
            <div className="bg-surface-container-low p-md rounded-lg border border-surface-variant">
              <div className="flex justify-between items-end mb-sm">
                <div>
                  <p className="font-headline-md text-headline-md text-on-surface">Acil Durum Fonu</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">₺15,000 / ₺20,000</p>
                </div>
                <p className="font-label-md text-label-md text-primary">75%</p>
              </div>
              <div className="w-full bg-surface-variant rounded-full h-2 mb-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '75%' }}></div>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant text-right">Aralık 2026'da tamamlanacak</p>
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="space-y-lg">
          {/* Categories & Budgets */}
          <section className="bg-surface-container-lowest rounded-xl p-lg shadow-[0px_4px_12px_rgba(49,124,184,0.08)]">
            <h3 className="font-label-md text-label-md text-primary mb-md uppercase tracking-wider">Kategoriler & Bütçeler</h3>
            <div className="space-y-3 mb-6">
               {(profile?.categories || DEFAULT_CATEGORIES).map((cat, i) => (
                 <div key={i} className="flex flex-col gap-2 w-full border-b border-surface-variant pb-3 last:border-0">
                   <div className="flex justify-between items-center w-full">
                     <div className="flex-1 mr-2">
                       <EditableCategoryBadge 
                         cat={cat} 
                         onDelete={async () => {
                           if (!profile) return;
                           const newCats = (profile.categories || DEFAULT_CATEGORIES).filter((_, idx) => idx !== i);
                           await setDoc(doc(db, 'users', profile.uid), { ...profile, categories: newCats });
                         }}
                         onSave={async (newVal) => {
                           if (!profile || !newVal || newVal === cat) return;
                           const newCats = [...(profile.categories || DEFAULT_CATEGORIES)];
                           if (newCats.includes(newVal)) return;
                           newCats[i] = newVal;
                           const newBudgets = { ...(profile.budgets || {}) };
                           if (newBudgets[cat]) {
                             newBudgets[newVal] = newBudgets[cat];
                             delete newBudgets[cat];
                           }
                           await setDoc(doc(db, 'users', profile.uid), { ...profile, categories: newCats, budgets: newBudgets });
                         }}
                       />
                     </div>
                     <div className="flex items-center gap-1 shrink-0">
                       <span className="font-label-md text-on-surface-variant text-[10px]">Bütçe:</span>
                       <input 
                         type="number"
                         placeholder="Lmt Yk"
                         defaultValue={profile?.budgets?.[cat] || ''}
                         onBlur={async (e) => {
                            const val = parseInt(e.target.value);
                            const newBudgets = { ...(profile?.budgets || {}) };
                            if (isNaN(val) || val <= 0) {
                              delete newBudgets[cat];
                            } else {
                              newBudgets[cat] = val;
                            }
                            if (profile) await setDoc(doc(db, 'users', profile.uid), { ...profile, budgets: newBudgets });
                         }}
                         className="w-16 bg-surface-container-low border-b border-transparent focus:border-primary px-1 py-1 font-label-md text-on-surface outline-none text-right transition-colors hover:border-surface-variant rounded-t-sm"
                       />
                     </div>
                   </div>
                 </div>
               ))}
            </div>
            
            <form onSubmit={(e) => {
                 e.preventDefault();
                 const form = e.target as HTMLFormElement;
                 const input = form.elements.namedItem('newCategory') as HTMLInputElement;
                 const val = input.value.trim();
                 if (val && !(profile?.categories || DEFAULT_CATEGORIES).includes(val) && profile) {
                   const newCats = [...(profile.categories || DEFAULT_CATEGORIES), val];
                   setDoc(doc(db, 'users', profile.uid), { ...profile, categories: newCats });
                   input.value = '';
                 }
              }} className="flex gap-2">
              <input 
                name="newCategory" 
                placeholder="Yeni Kategori Ekle..." 
                className="flex-1 bg-surface-container-low border border-surface-variant rounded-md px-3 py-2 font-body-sm outline-none focus:border-primary transition-colors text-on-surface"
              />
              <button type="submit" className="material-symbols-outlined text-primary p-2 hover:bg-surface-container-high rounded-md transition-colors bg-surface-container">add</button>
            </form>
          </section>

          {/* Sync Settings */}
          <section className="bg-surface-container-lowest rounded-xl p-lg shadow-[0px_4px_12px_rgba(49,124,184,0.08)]">
            <h3 className="font-label-md text-label-md text-primary mb-md uppercase tracking-wider">E-posta Senkronizasyonu</h3>
            <div className="space-y-4">
              <div>
                <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Senkronizasyon Sıklığı</label>
                <div className="relative">
                  <select 
                    value={profile?.syncFrequency || '6months'}
                    onChange={async (e) => {
                      if (profile) await setDoc(doc(db, 'users', profile.uid), { ...profile, syncFrequency: e.target.value });
                    }}
                    className="w-full bg-surface-container-low rounded-md px-3 py-2 font-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary appearance-none border border-surface-variant cursor-pointer"
                  >
                    <option className="text-on-surface bg-surface" value="daily">Günlük</option>
                    <option className="text-on-surface bg-surface" value="weekly">Haftalık</option>
                    <option className="text-on-surface bg-surface" value="monthly">Aylık</option>
                    <option className="text-on-surface bg-surface" value="3months">Son 3 Ay (Tam Tarama)</option>
                    <option className="text-on-surface bg-surface" value="6months">Son 6 Ay (Tam Tarama)</option>
                    <option className="text-on-surface bg-surface" value="manual">Sadece Manuel</option>
                  </select>
                  <span className="material-symbols-outlined text-[20px] text-on-surface-variant absolute right-2 top-2 pointer-events-none">expand_more</span>
                </div>
              </div>
              <div>
                <label className="font-label-md text-label-md text-on-surface-variant block mb-1">Özel Etiketler (İsteğe Bağlı)</label>
                <input 
                  type="text"
                  placeholder="Örn: makbuz, fatura"
                  defaultValue={profile?.syncLabels || ''}
                  onBlur={async (e) => {
                    if (profile) await setDoc(doc(db, 'users', profile.uid), { ...profile, syncLabels: e.target.value.trim() });
                  }}
                  className="w-full bg-surface-container-low rounded-md px-3 py-2 font-body-sm text-on-surface outline-none focus:border-primary border border-surface-variant transition-colors"
                />
              </div>
            </div>
          </section>

          {/* Security & Support */}
          <section className="bg-surface-container-lowest rounded-xl p-lg shadow-[0px_4px_12px_rgba(49,124,184,0.08)]">
            <h3 className="font-label-md text-label-md text-primary mb-md uppercase tracking-wider">Güvenlik & Destek</h3>
            <div className="space-y-2 mb-lg">
              <button className="w-full flex justify-between items-center py-3 border-b border-surface-variant hover:bg-surface-container-low transition-colors rounded-md px-2 -mx-2">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-on-surface-variant">lock</span>
                  <span className="font-body-md text-body-md text-on-surface">Şifre Değiştir</span>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
              </button>
              <button className="w-full flex justify-between items-center py-3 border-b border-surface-variant hover:bg-surface-container-low transition-colors rounded-md px-2 -mx-2">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-on-surface-variant">help</span>
                  <span className="font-body-md text-body-md text-on-surface">Yardım Merkezi</span>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
              </button>
              <button 
                onClick={async () => {
                   if (!profile) return;
                   if (!window.confirm("E-postalardan aktarılan tüm harcama kayıtlarını silmek ve e-posta senkronizasyon geçmişini temizlemek istediğinize emin misiniz?")) return;
                   try {
                     const q = query(collection(db, 'expenses'), where('userId', '==', profile.uid));
                     const snapshot = await getDocs(q);
                     const batch = writeBatch(db);
                     let deletedCount = 0;
                     snapshot.docs.forEach((docSnap) => {
                       if (docSnap.data().emailId) {
                         batch.delete(docSnap.ref);
                         deletedCount++;
                       }
                     });
                     if (deletedCount > 0) {
                       await batch.commit();
                     }
                     await setDoc(doc(db, 'users', profile.uid), { ...profile, processedEmailIds: [] });
                     alert('E-posta kaynaklı harcamalar silindi ve e-posta arama geçmişi sıfırlandı.');
                   } catch (err) {
                     handleFirestoreError(err, OperationType.DELETE, 'expenses');
                   }
                }}
                className="w-full flex justify-between items-center py-3 hover:bg-error-container/20 transition-colors rounded-md px-2 -mx-2 text-error"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined">delete_sweep</span>
                  <span className="font-body-md text-body-md">E-posta Geçmişini Sıfırla</span>
                </div>
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
            <button 
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 py-3 bg-error-container text-on-error-container font-headline-md text-headline-md rounded-lg shadow-sm hover:bg-error hover:text-on-error transition-colors"
            >
              <span className="material-symbols-outlined">logout</span>
              Çıkış Yap
            </button>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
\n`;

fs.writeFileSync('src/App.tsx', content.substring(0, settingsStartIndex) + newSettingsView + content.substring(settingsEndIndex));
console.log("SettingsView updated successfully!");
