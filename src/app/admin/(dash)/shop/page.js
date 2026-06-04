import { requireAdmin } from "@/lib/supabase/ssr";
import { getShopSettings } from "@/lib/data-admin";
import ShopForm from "./shop-form";

export default async function ShopPage() {
  const { supabase } = await requireAdmin();
  const shop = await getShopSettings(supabase);
  return (
    <>
      <h1 className="admin-h1">Shop content</h1>
      <ShopForm shop={shop} />
    </>
  );
}
