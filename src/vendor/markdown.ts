/**
 * Markdown parser — wraps `marked` with a safe link renderer.
 * Links in release notes are rendered as non-clickable text (href stripped)
 * to avoid opening untrusted URLs inside the Tauri webview.
 */

import { marked } from 'marked';

marked.use({
  gfm: true,
  renderer: {
    // Render links as styled text, no actual href
    link({ text }: { text: string; href: string }) {
      return `<span class="md-link">${text}</span>`;
    },
  },
});

/** Parse a Markdown string and return safe HTML. */
export function mdParse(src: string): string {
  if (!src) return '';
  return marked.parse(src) as string;
}
