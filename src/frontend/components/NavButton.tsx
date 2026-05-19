

export function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col flex-1 items-center justify-center py-2 hover:bg-surface-container-low transition-all active:scale-90 duration-200 ${active ? "text-primary bg-secondary-container/20 rounded-xl" : "text-on-surface-variant"}`}
    >
      <span
        className={`material-symbols-outlined text-[24px] ${active ? "filled" : ""}`}
      >
        {icon}
      </span>
      <span className="font-label-md text-label-md mt-1">{label}</span>
    </button>
  );
}