// shortcuts.ts — How the app names the "Cmd or Ctrl" modifier.
//
// Monaco binds CtrlCmd, so the same shortcut is ⌘-based on Apple hardware and
// Ctrl-based everywhere else. Printing one fixed label made the docs and the
// editor disagree with the keyboard on half the machines, so the label is
// derived from the platform once, here.

const platform =
  typeof navigator === 'undefined'
    ? ''
    : (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
      navigator.platform ??
      navigator.userAgent;

export const IS_APPLE = /mac|iphone|ipad|ipod/i.test(platform);

/** The modifier as it is printed in a kbd chip: ⌘ on Apple, Ctrl elsewhere. */
export const MOD_LABEL = IS_APPLE ? '⌘' : 'Ctrl';

/** "⌘+Enter" / "Ctrl+Enter", for titles and inline hints. */
export const modShortcut = (key: string) => `${MOD_LABEL}+${key}`;
