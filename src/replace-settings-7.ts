import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const settingsStartIndex = content.indexOf('function SettingsView({');
const settingsEndIndex = content.indexOf('function AddExpenseModal', settingsStartIndex);

let settingsView = content.substring(settingsStartIndex, settingsEndIndex);

// Add state for editing currency
settingsView = settingsView.replace(
  '  const [editPhoneValue, setEditPhoneValue] = useState("");',
  `  const [editPhoneValue, setEditPhoneValue] = useState("");

  const [isEditingCurrency, setIsEditingCurrency] = useState(false);
  const [editCurrencyValue, setEditCurrencyValue] = useState("");

  const startEditCurrency = () => {
    setEditCurrencyValue(profile?.currency || "TRY");
    setIsEditingCurrency(true);
  };

  const saveCurrency = async () => {
    setIsEditingCurrency(false);
    if (editCurrencyValue && editCurrencyValue !== profile?.currency && auth.currentUser) {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        currency: editCurrencyValue,
      });
    }
  };

  const toggleAutoConvert = async () => {
    if (auth.currentUser) {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        autoConvertCurrency: profile?.autoConvertCurrency === undefined ? false : !(profile.autoConvertCurrency),
      });
    }
  };`
);

// Add Currency component in Personal Information
const newCurrencySection = `
            <div className="">
              {isEditingCurrency ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[12px] text-slate-800 dark:text-on-surface font-normal">
                    Primary Currency
                  </p>
                  <div className="flex items-center gap-2">
                    <select
                      value={editCurrencyValue}
                      onChange={(e) => setEditCurrencyValue(e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-surface-container-high border border-slate-200 dark:border-surface-variant rounded-md px-2 py-1 text-sm text-slate-800 dark:text-on-surface outline-none focus:border-[#0D47A1] dark:focus:border-primary"
                    >
                      {COMMON_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button
                      onClick={saveCurrency}
                      className="p-1 text-[#0D47A1] dark:text-primary hover:bg-slate-100 dark:hover:bg-surface-variant rounded-md transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        check
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={startEditCurrency}
                  className="flex justify-between items-center cursor-pointer hover:opacity-70 active:scale-[0.98] transition-all"
                >
                  <div className="w-full">
                    <p className="text-[12px] text-slate-800 dark:text-on-surface mb-[2px] font-normal">
                      Primary Currency
                    </p>
                    <p className="text-[14px] font-normal text-slate-600 dark:text-on-surface-variant">
                      {profile?.currency || "TRY"}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-[#0D47A1] dark:text-primary text-[18px]">
                    edit
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>`;

settingsView = settingsView.replace(
  `                  <span className="material-symbols-outlined text-[#0D47A1] dark:text-primary text-[18px]">
                    edit
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>`,
  `                  <span className="material-symbols-outlined text-[#0D47A1] dark:text-primary text-[18px]">
                    edit
                  </span>
                </div>
              )}
            </div>
            
            <div className="w-full h-px bg-slate-100/80 dark:bg-surface-variant my-1"></div>` + newCurrencySection
);

// Add auto currency convert in Preferences
const autoConvertSection = `
            <div
              className="flex justify-between items-center cursor-pointer group"
              onClick={toggleAutoConvert}
            >
              <div className="flex items-center gap-[14px]">
                <span className="material-symbols-outlined text-slate-800 dark:text-on-surface text-[20px] font-light">
                  currency_exchange
                </span>
                <span className="text-[14px] text-slate-800 dark:text-on-surface font-normal">
                  Auto Currency Conversion
                </span>
              </div>
              <button
                className={\`w-11 h-6 rounded-full relative transition-colors focus:outline-none \${(profile?.autoConvertCurrency ?? true) ? "bg-[#0D47A1] dark:bg-primary" : "bg-[#1e293b] dark:bg-surface-variant"}\`}
              >
                <div
                  className={\`w-[18px] h-[18px] rounded-full absolute top-0.5 shadow-sm transition-all \${(profile?.autoConvertCurrency ?? true) ? "bg-white right-1" : "bg-[#cbd5e1] dark:bg-outline left-1"}\`}
                ></div>
              </button>
            </div>
`;

settingsView = settingsView.replace(
  '          <div className="space-y-[20px]">',
  '          <div className="space-y-[20px]">' + autoConvertSection
);

fs.writeFileSync('src/App.tsx', content.substring(0, settingsStartIndex) + settingsView + content.substring(settingsEndIndex));
