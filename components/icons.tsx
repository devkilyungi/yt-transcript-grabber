// Line icons, drawn on a 24-unit grid with round caps.

import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 16, strokeWidth = 2, children, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

export const LogoIcon = (p: IconProps) => <Icon strokeWidth={2.4} {...p}><path d="M4 7h16M4 12h10M4 17h13" /></Icon>;

export const LinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </Icon>
);

export const SunIcon = (p: IconProps) => (
  <Icon size={14} className="sun" {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);

export const MoonIcon = (p: IconProps) => (
  <Icon size={14} className="moon" {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></Icon>
);

export const BookmarkIcon = (p: IconProps) => (
  <Icon size={18} {...p}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></Icon>
);

export const PlayIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
);

export const ExternalIcon = (p: IconProps) => (
  <Icon size={13} {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></Icon>
);

export const SparkleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
    <path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z" />
  </Icon>
);

export const CopyIcon = (p: IconProps) => (
  <Icon size={15} {...p}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></Icon>
);

export const CheckIcon = (p: IconProps) => <Icon strokeWidth={2.5} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Icon>;

export const DownloadIcon = (p: IconProps) => (
  <Icon size={15} {...p}><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></Icon>
);

export const BackIcon = (p: IconProps) => <Icon {...p}><path d="M15 18l-6-6 6-6" /></Icon>;

export const SearchIcon = (p: IconProps) => (
  <Icon size={15} {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Icon>
);

export const CloseIcon = (p: IconProps) => <Icon size={12} strokeWidth={2.6} {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>;

/** A button icon that swaps to a check mark while the button has `.done` (see `flashDone`). */
export function DoneSwap({ icon: Main, size = 16 }: { icon: (p: IconProps) => ReactNode; size?: number }) {
  return (
    <>
      <Main size={size} className="ic-main" />
      <CheckIcon size={size} className="ic-check" />
    </>
  );
}
