import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

/**
 * Patch DOM methods to prevent React reconciliation crashes.
 *
 * React 18 assumes it is the sole owner of the DOM tree it manages.
 * When a third-party library (Recharts/Tremor charts, Google Translate,
 * browser extensions, etc.) directly mutates the DOM, React's
 * removeChild / insertBefore calls may reference nodes that have already
 * been moved or detached. This causes:
 *   "NotFoundError: Failed to execute 'removeChild' on 'Node'"
 *   "NotFoundError: Failed to execute 'insertBefore' on 'Node'"
 *
 * The patch below catches those cases and returns gracefully instead
 * of crashing the entire application.
 */
if (typeof Node !== 'undefined') {
  const origRemoveChild = Node.prototype.removeChild;
  // @ts-ignore – intentional monkey-patch
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      // The node was already detached by a third-party library – ignore.
      return child;
    }
    return origRemoveChild.call(this, child) as T;
  };

  const origInsertBefore = Node.prototype.insertBefore;
  // @ts-ignore – intentional monkey-patch
  Node.prototype.insertBefore = function <T extends Node>(
    newNode: T,
    referenceNode: Node | null,
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      // Reference node was already moved – just append instead.
      return origInsertBefore.call(this, newNode, null) as T;
    }
    return origInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
