/** 24-px stroke icons for the navigation (menu sheet and phone tab bar). */
const S = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

export const NavIcon = {
  home: () => <S d="M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5M10 20v-5h4v5" />,
  learn: () => <S d="M3 6.5C5.5 5 8.5 5 12 7c3.5-2 6.5-2 9-.5V19c-2.5-1.5-5.5-1.5-9 .5-3.5-2-6.5-2-9-.5zM12 7v12.5" />,
  system: () => <S d="M12 3 3 7.5l9 4.5 9-4.5zM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5" />,
  usecases: () => <S d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 9h17M3.5 15h17M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z" />,
  bench: () => <S d="M9 3h6M10 3v6.5L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9.5V3M7.5 14.5h9" />,
  lab: () => <S d="M2.5 12h3l2-6 3.5 12 3-9 2 3h5.5" />,
  library: () => <S d="M5 4h3v16H5zM10 4h3v16h-3zM15.2 4.6l2.9-.8 4 15.4-2.9.8z" />,
  glossary: () => <S d="M4 19 9 5h1l5 14M6 14h7M16 9h4M16 13h4M16 17h4" />,
  contribute: () => <S d="M6 3v12M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9c0 5-6 4-12 6" />,
  suggest: () => <S d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />,
  github: () => <S d="M9 19c-4 1.3-4-2-6-2.5m12 5v-3.4a3 3 0 0 0-.8-2.3c2.7-.3 5.5-1.3 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.7 11.7 0 0 0-6.2 0C6.3 2.1 5.3 2.4 5.3 2.4a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 3.9 8.8c0 4.6 2.8 5.7 5.5 6a3 3 0 0 0-.8 2.3V21" />,
  more: () => <S d="M4 6h16M4 12h16M4 18h16" />,
  close: () => <S d="M6 6l12 12M18 6 6 18" />,
  search: () => <S d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" />,
};
