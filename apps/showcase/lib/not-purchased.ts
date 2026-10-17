/*
 * next.config.ts aliases every product the customer did not buy to this file,
 * so importing one — from app code or from another package — fails the build
 * at compile time with "Can't resolve 'HIS_PRODUCT_NOT_PURCHASED'" and an
 * import trace that names the file that reached for it.
 *
 * (Aliasing to a path that does not exist is not enough: Turbopack then falls
 * back to normal resolution and bundles the product anyway.)
 */
import "HIS_PRODUCT_NOT_PURCHASED";
