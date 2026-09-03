type GuardedNodePrototype = typeof Node.prototype & {
  __plonopolisGoogleTranslateGuardInstalled?: boolean;
};

/**
 * Google Translate potrafi przenieść węzły tekstowe do własnych elementów
 * <font>. React może wtedy próbować usunąć lub wstawić węzeł względem rodzica,
 * do którego ten węzeł już nie należy, co kończy się NotFoundError i crashem UI.
 */
export function installGoogleTranslateDomGuard(): void {
  if (typeof Node === "undefined") return;

  const prototype = Node.prototype as GuardedNodePrototype;
  if (prototype.__plonopolisGoogleTranslateGuardInstalled) return;

  const nativeRemoveChild = prototype.removeChild;
  const nativeInsertBefore = prototype.insertBefore;

  prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      return child;
    }
    return nativeRemoveChild.call(this, child) as T;
  };

  prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode !== null && referenceNode.parentNode !== this) {
      return nativeInsertBefore.call(this, newNode, null) as T;
    }
    return nativeInsertBefore.call(this, newNode, referenceNode) as T;
  };

  prototype.__plonopolisGoogleTranslateGuardInstalled = true;
}