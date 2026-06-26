/**
 * Boring-avatars wrapper — renders via Preact (no React runtime needed).
 * boring-avatars uses react/jsx-runtime internally; Vite aliases it to
 * preact/jsx-runtime so the output is Preact virtual nodes, rendered here
 * to a static SVG string with preact-render-to-string.
 */

import { h } from 'preact';
import { renderToStaticMarkup } from 'preact-render-to-string';
import Avatar from 'boring-avatars';

const PALETTE = ['#92A1C6', '#146A7C', '#F0AB3D', '#C271B4', '#C20D90'];

/**
 * Returns an inline SVG string for the given pilot name.
 * Uses the boring-avatars "beam" variant (deterministic face avatar).
 */
export function boringAvatar(name: string, size = 80): string {
  const vnode = h(Avatar, {
    name: name || 'pilot',
    size,
    variant: 'beam',
    colors: PALETTE,
  } as never);
  return renderToStaticMarkup(vnode);
}
