/** Non-blocking feedback shared by production workflows. */
export function notify(message, type = 'info') {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('creatordesk:notify', { detail: { message: String(message), type } }));
  }
}
