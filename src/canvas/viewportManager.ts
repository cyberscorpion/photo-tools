// Central reference to the scrollable workspace container.
// WorkspaceArea sets this on mount; toolHandlers reads it for pan operations.
let _container = null

export function setWorkspaceContainer(el) {
  _container = el
}

export function getWorkspaceContainer() {
  return _container
}

export function panContainer(dx, dy) {
  if (!_container) return
  _container.scrollLeft += dx
  _container.scrollTop += dy
}
