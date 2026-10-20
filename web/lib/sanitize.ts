import sanitizeHtml from 'sanitize-html';

/**
 * Job descriptions are HTML written by third parties. Only plain formatting survives:
 * no scripts, styles, images, iframes or event handlers. Links open in a new tab and
 * only with http(s) or mailto.
 */
export function sanitizeDescription(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'hr',
      'ul',
      'ol',
      'li',
      'strong',
      'b',
      'em',
      'i',
      'u',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'a',
      'code',
      'pre',
      'span',
      'div',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    // target and rel are always overwritten by the transform below.
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
      }),
    },
    exclusiveFilter: (frame) =>
      frame.tag === 'p' && !frame.text.trim() && !frame.mediaChildren.length,
  });
}
