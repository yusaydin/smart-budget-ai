import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const settingsStartIndex = content.indexOf('function SettingsView({');
if (settingsStartIndex === -1) {
    console.error("SettingsView not found");
    process.exit(1);
}

// Find the end of SettingsView
const settingsEndIndex = content.indexOf('function AddExpenseModal', settingsStartIndex);
if (settingsEndIndex === -1) {
    console.error("AddExpenseModal not found");
    process.exit(1);
}

const newSettingsView = `function SettingsView({
  profile,
  toggleCorporate,
}: {
  profile: UserProfile | null;
  toggleCorporate: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="pb-24 pt-2 px-4 max-w-lg mx-auto w-full bg-[#f8fafc] min-h-[calc(100vh-60px)] font-sans"
    >
      {/* Profile Image & Name */}
      <div className="flex flex-col items-center pt-6 pb-6">
        <div className="w-[88px] h-[88px] rounded-full overflow-hidden mb-3 shadow-[0px_4px_16px_rgba(13,71,161,0.15)] border-2 border-white bg-slate-100 relative">
          {profile?.photoURL ? (
            <img
              src={profile.photoURL}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="material-symbols-outlined text-[64px] text-slate-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              account_circle
            </span>
          )}
        </div>
        <h2 className="text-[17px] font-bold text-[#1e293b] mb-[2px]">
          {profile?.displayName || "Ahmet Yılmaz"}
        </h2>
        <p className="text-[13px] text-slate-500 font-normal">
          Member since Jan 2023
        </p>
      </div>

      <div className="space-y-[18px]">
        {/* PERSONAL INFORMATION */}
        <section className="bg-white rounded-[12px] p-5 shadow-[0px_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/80">
          <h3 className="text-[11px] font-bold text-[#0D47A1] uppercase tracking-[0.08em] mb-[18px]">
            Personal Information
          </h3>
          <div className="space-y-0">
            <div className="flex justify-between items-center pb-[14px] mb-[14px] border-b border-slate-100/80">
              <div>
                <p className="text-[12px] text-slate-800 mb-[2px] font-normal">Full Name</p>
                <p className="text-[14px] font-normal text-slate-600">{profile?.displayName || "Ahmet Yılmaz"}</p>
              </div>
              <span className="material-symbols-outlined text-[#0D47A1] text-[18px]">edit</span>
            </div>
            
            <div className="flex justify-between items-center pb-[14px] mb-[14px] border-b border-slate-100/80">
              <div>
                <p className="text-[12px] text-slate-800 mb-[2px] font-normal">Email</p>
                <p className="text-[14px] font-normal text-slate-600">{profile?.email || "ahmet.yilmaz@example.com"}</p>
              </div>
              <span className="material-symbols-outlined text-[#0D47A1] text-[18px]">edit</span>
            </div>

            <div className="flex justify-between items-center">
              <div className="w-full">
                <p className="text-[12px] text-slate-800 mb-[2px] font-normal">Phone</p>
                <p className="text-[14px] font-normal text-slate-600">+90 555 123 4567</p>
              </div>
              <span className="material-symbols-outlined text-[#0D47A1] text-[18px]">edit</span>
            </div>
          </div>
        </section>

        {/* ACTIVE GOAL */}
        <section className="bg-white rounded-[12px] p-[18px] shadow-[0px_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/80">
          <h3 className="flex items-center gap-[6px] text-[11px] font-bold text-[#0D47A1] uppercase tracking-[0.08em] mb-[14px]">
            <span className="material-symbols-outlined text-[16px] -mt-[1px]">flag</span>
            Active Goal
          </h3>
          <div className="bg-[#f8fafc] rounded-[8px] p-[14px] border border-slate-200/60 shadow-[inset_0px_1px_2px_rgba(0,0,0,0.02)]">
             <div className="flex justify-between items-center mb-1">
                <p className="font-[500] text-[15px] text-slate-900">Emergency Fund</p>
             </div>
             <div className="flex justify-between items-baseline mb-[14px]">
                <p className="text-[12px] text-slate-600 font-normal">₺15,000 / ₺20,000</p>
                <p className="text-[11px] font-semibold text-[#0D47A1]">75%</p>
             </div>
             <div className="w-full h-[6px] bg-slate-200/80 rounded-full overflow-hidden mb-[10px]">
                <div className="h-full bg-[#0D47A1] rounded-full" style={{ width: '75%' }}></div>
             </div>
             <p className="text-[12px] text-slate-600 font-normal text-center">On track to complete by Dec 2024</p>
          </div>
        </section>

        {/* PREFERENCES */}
        <section className="bg-white rounded-[12px] p-5 shadow-[0px_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/80">
          <h3 className="text-[11px] font-bold text-[#0D47A1] uppercase tracking-[0.08em] mb-[18px]">
            Preferences
          </h3>
          <div className="space-y-[20px]">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-[14px]">
                <span className="material-symbols-outlined text-slate-800 text-[20px] font-light">dark_mode</span>
                <span className="text-[14px] text-slate-800 font-normal">Dark Mode</span>
              </div>
              <button className="w-11 h-6 bg-[#1e293b] rounded-full relative transition-colors focus:outline-none">
                <div className="w-[18px] h-[18px] bg-[#cbd5e1] rounded-full absolute right-1 top-0.5 shadow-[0px_1px_2px_rgba(0,0,0,0.2)]"></div>
              </button>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-[14px]">
                <span className="material-symbols-outlined text-slate-800 text-[20px] font-light">notifications_active</span>
                <span className="text-[14px] text-slate-800 font-normal">Push Notifications</span>
              </div>
              <button className="w-11 h-6 bg-[#0D47A1] rounded-full relative transition-colors focus:outline-none">
                <div className="w-[18px] h-[18px] bg-white rounded-full absolute right-1 top-0.5 shadow-sm"></div>
              </button>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-[14px]">
                <span className="material-symbols-outlined text-slate-800 text-[20px] font-light">fingerprint</span>
                <span className="text-[14px] text-slate-800 font-normal">Biometric Login</span>
              </div>
              <button className="w-11 h-6 bg-[#0D47A1] rounded-full relative transition-colors focus:outline-none">
                <div className="w-[18px] h-[18px] bg-white rounded-full absolute right-1 top-0.5 shadow-sm"></div>
              </button>
            </div>
          </div>
        </section>

        {/* SECURITY */}
        <section className="bg-white rounded-[12px] p-5 shadow-[0px_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/80">
          <h3 className="text-[11px] font-bold text-[#0D47A1] uppercase tracking-[0.08em] mb-[16px]">
            Security
          </h3>
          <div className="space-y-1">
            <button className="w-full flex justify-between items-center py-[10px]">
              <div className="flex items-center gap-[14px]">
                <span className="material-symbols-outlined text-slate-800 text-[20px] font-light">lock_outline</span>
                <span className="text-[14px] text-slate-800 font-normal">Change Password</span>
              </div>
              <span className="material-symbols-outlined text-slate-800 text-[20px] font-light">chevron_right</span>
            </button>
            <div className="w-full h-px bg-slate-100/80 my-1"></div>
            
            <button className="w-full flex justify-between items-center py-[10px]">
              <div className="flex items-center gap-[14px]">
                <span className="material-symbols-outlined text-slate-800 text-[20px] font-light">shield</span>
                <span className="text-[14px] text-slate-800 font-normal">Data Privacy</span>
              </div>
              <span className="material-symbols-outlined text-slate-800 text-[20px] font-light">chevron_right</span>
            </button>
            <div className="w-full h-px bg-slate-100/80 my-1"></div>

            <button className="w-full flex justify-between items-center py-[10px]">
              <div className="flex items-center gap-[14px]">
                <span className="material-symbols-outlined text-slate-800 text-[20px] font-light">link</span>
                <span className="text-[14px] text-slate-800 font-normal">Linked Accounts</span>
              </div>
              <span className="material-symbols-outlined text-slate-800 text-[20px] font-light">chevron_right</span>
            </button>
          </div>
        </section>

        {/* SUPPORT */}
        <section className="bg-white rounded-[12px] p-5 shadow-[0px_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/80 mb-6">
          <h3 className="text-[11px] font-bold text-[#0D47A1] uppercase tracking-[0.08em] mb-[16px]">
            Support
          </h3>
          <div className="space-y-1">
            <button className="w-full flex justify-between items-center py-[10px]">
              <div className="flex items-center gap-[14px]">
                <span className="material-symbols-outlined text-slate-800 text-[20px] font-light">help_outline</span>
                <span className="text-[14px] text-slate-800 font-normal">Help Center</span>
              </div>
              <span className="material-symbols-outlined text-slate-800 text-[20px] font-light">chevron_right</span>
            </button>
            <div className="w-full h-px bg-slate-100/80 my-1"></div>

            <button className="w-full flex justify-between items-center py-[10px] pb-4">
              <div className="flex items-center gap-[14px]">
                <span className="material-symbols-outlined text-slate-800 text-[20px] font-light">description</span>
                <span className="text-[14px] text-slate-800 font-normal">Terms of Service</span>
              </div>
              <span className="material-symbols-outlined text-slate-800 text-[20px] font-light">chevron_right</span>
            </button>

            <button
              onClick={logout}
              className="mt-[6px] w-full flex items-center justify-center gap-2 py-[12px] bg-[#ffe4e4] text-[#A11D1D] font-semibold text-[15px] rounded-[8px] transition-colors hover:bg-red-100"
            >
              <span className="material-symbols-outlined font-normal text-[20px]">logout</span>
              Logout
            </button>
          </div>
        </section>
      </div>
    </motion.div>
  );
}
`;

fs.writeFileSync('src/App.tsx', content.substring(0, settingsStartIndex) + newSettingsView + content.substring(settingsEndIndex));
console.log("Written!");
