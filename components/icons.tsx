const P = {
  home: <path d="M2.5 7 8 2.5 13.5 7v6.5h-11Z" />,
  bell: <path d="M4 11V7a4 4 0 0 1 8 0v4l1.2 1.5H2.8Z" />,
  cal: <><rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></>,
  msg: <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2Z" />,
  money: <><rect x="2" y="4" width="12" height="8.5" rx="2" /><path d="M2 7h12" /></>,
  plug: <><path d="M6 2v3M10 2v3M4.5 5h7v2.5a3.5 3.5 0 0 1-7 0Z" /><path d="M8 11v3" /></>,
  chart: <path d="M2.5 13.5V8M6.5 13.5V3M10.5 13.5V6M14 13.5H2" />,
  people: <><circle cx="6" cy="6" r="2.5" /><path d="M1.8 13c.6-2.2 2.2-3.3 4.2-3.3s3.6 1.1 4.2 3.3M10.5 4.2a2.3 2.3 0 0 1 0 4.4M12 9.9c1.2.4 2 1.4 2.3 3.1" /></>,
  plus: <path d="M8 3v10M3 8h10" />,
  gear: <><circle cx="8" cy="8" r="2.2" /><path d="M8 1.8v1.8M8 12.4v1.8M1.8 8h1.8M12.4 8h1.8M3.6 3.6l1.3 1.3M11.1 11.1l1.3 1.3M3.6 12.4l1.3-1.3M11.1 4.9l1.3-1.3" /></>,
  book: <path d="M3 2.5h7.5a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2Zm0 9a2 2 0 0 1 2-2h7.5" />,
  grid: <><rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="9" y="2.5" width="4.5" height="4.5" rx="1" /><rect x="2.5" y="9" width="4.5" height="4.5" rx="1" /><rect x="9" y="9" width="4.5" height="4.5" rx="1" /></>,
  menu: <path d="M2 4h12M2 8h12M2 12h12" />,
  out: <path d="M6 2.5H3.5v11H6M10 5l3 3-3 3M13 8H6" />,
  chev: <path d="m4 6 4 4 4-4" />,
};
export type IconName = keyof typeof P;

export function Icon({ name, size = 16, className = 'ico' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      {P[name]}
    </svg>
  );
}
