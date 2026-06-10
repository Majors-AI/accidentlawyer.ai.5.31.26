// Theming helper — the SINGLE mechanism that turns a ColorScheme into applied
// styles. The White Label live preview uses it now; real global / per-department
// application reuses the exact same mapping later.
//
// TODO(apply app-wide + persist): today this only produces an inline style object
// a wrapper element spreads onto itself (scoped to that subtree). Real
// application sets these vars on a root/app boundary (and persists the scheme),
// at which point existing components should read var(--primary) etc. The token
// names below are the contract both sides share.

import type { CSSProperties } from 'react';
import type { ColorScheme } from './firmSettings';

// CSS custom properties can't be expressed in the standard CSSProperties type,
// so we widen to allow the `--*` keys.
export type ThemeVars = CSSProperties & Record<`--${string}`, string>;

export function schemeToVars(scheme: ColorScheme): ThemeVars {
  return {
    '--primary': scheme.primary,
    '--accent': scheme.accent,
    '--background': scheme.background,
    '--surface': scheme.surface,
    '--text': scheme.text,
    '--muted-text': scheme.mutedText,
  };
}
