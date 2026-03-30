/**
 * Admin wallet address for accessing /admin.
 * Loaded from VITE_ADMIN_WALLET environment variable.
 * If not set, admin page will deny all access.
 */
const ADMIN_WALLET_RAW = import.meta.env.VITE_ADMIN_WALLET || "";

export const ADMIN_WALLET = ADMIN_WALLET_RAW.toLowerCase();

export function isAdminWallet(address: string | undefined): boolean {
  // If no admin wallet configured, deny all access
  if (!ADMIN_WALLET) {
    return false;
  }
  if (!address) return false;
  return address.toLowerCase() === ADMIN_WALLET;
}
