import { one, q } from "@/lib/db";

export type Brand = {
  id: string;
  name: string;
  tagline: string | null;
  cuisine: string | null;
  country: string;
  instagram_handle: string | null;
  facebook_page: string | null;
  website: string | null;
  brand_colors: string[];
};

export type Location = {
  id: string;
  name: string;
  suburb: string | null;
  city: string | null;
  state: string | null;
};

export async function getActiveBrand(): Promise<Brand> {
  const brand = await one<Brand>(
    "select * from brands order by created_at asc limit 1"
  );
  if (!brand) throw new Error("No brand found — run `pnpm tsx scripts/seed.ts`");
  return brand;
}

export async function getLocations(brandId: string): Promise<Location[]> {
  return q<Location>(
    "select id, name, suburb, city, state from locations where brand_id = $1 order by created_at",
    [brandId]
  );
}
