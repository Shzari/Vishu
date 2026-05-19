export const PRODUCT_DEPARTMENTS = ["men", "women", "kids", "babies"] as const;

export const PRODUCT_CATEGORY_GROUPS = {
  men: [
    "tshirts",
    "shirts",
    "hoodies",
    "sweatshirts",
    "sweaters",
    "jackets",
    "outerwear",
    "pants",
    "jeans",
    "shorts",
    "set",
    "beach",
    "underwear",
    "suits",
    "shoes",
    "sportswear",
  ],
  women: [
    "tshirts",
    "tops",
    "shirts",
    "hoodies",
    "sweatshirts",
    "sweaters",
    "jackets",
    "outerwear",
    "pants",
    "jeans",
    "shorts",
    "leggings",
    "set",
    "beach",
    "underwear",
    "dresses",
    "skirts",
    "suits",
    "shoes",
    "sportswear",
  ],
  kids: [
    "tshirts",
    "hoodies",
    "jackets",
    "pants",
    "jeans",
    "set",
    "beach",
    "underwear",
    "schoolwear",
    "shoes",
    "sportswear",
  ],
  babies: [
    "bodysuits",
    "rompers",
    "set",
    "underwear",
    "outerwear",
    "sleepwear",
    "shoes",
    "blankets",
    "beach",
  ],
} as const;

export const ACCESSORY_CATEGORIES = [
  "hat",
  "belt",
  "tie",
  "scarf",
  "wallet",
  "glasses",
  "brooch",
  "bag",
  "jewelry",
] as const;

export const PRODUCT_CATEGORIES: string[] = [
  ...new Set([
    ...Object.values(PRODUCT_CATEGORY_GROUPS).flat(),
    ...ACCESSORY_CATEGORIES,
    "accessories",
  ]),
] as string[];

export const PRODUCT_COLOR_OPTIONS = [
  "black",
  "white",
  "beige",
  "brown",
  "gray",
  "blue",
  "navy",
  "red",
  "orange",
  "yellow",
  "green",
  "pink",
  "mixed-colors",
] as const;

export const PRODUCT_BRAND_FILTER_OPTIONS = [
  "Adidas",
  "Nike",
  "Puma",
  "Reebok",
  "New Balance",
  "Converse",
  "Vans",
  "Zara",
  "H&M",
  "Mango",
  "Bershka",
  "Pull&Bear",
  "Stradivarius",
  "New Yorker",
  "Springfield",
  "Terranova",
  "Reserved",
  "Tommy Hilfiger",
  "Calvin Klein",
  "Levi's",
  "Guess",
  "Jack & Jones",
  "Only",
  "Vero Moda",
  "Under Armour",
  "Skechers",
  "Geox",
  "Benetton",
  "Okaidi",
  "OVS",
  "LC Waikiki",
  "Koton",
  "Mavi",
  "DeFacto",
  "Colin's",
  "LTB",
  "D'S Damat",
  "Kiğılı",
  "Sarar",
  "Network",
  "Vakko",
  "Ipekyol",
  "Twist",
  "Dagi",
  "Flo",
] as const;

export function getCatalogBrandFilterOptions(): string[] {
  return [...PRODUCT_BRAND_FILTER_OPTIONS];
}

export const PRODUCT_SIZE_OPTIONS = [
  "xs",
  "s",
  "m",
  "l",
  "xl",
  "xxl",
  "xxxl",
  "one-size",
] as const;

export const ADULT_SIZE_FILTER_OPTIONS = [
  "XXS",
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
  "One Size",
] as const;

export const KIDS_SIZE_FILTER_OPTIONS = [
  "2Y",
  "3Y",
  "4Y",
  "5Y",
  "6Y",
  "7Y",
  "8Y",
  "10Y",
  "12Y",
  "14Y",
  "Kids XS",
  "Kids S",
  "Kids M",
  "Kids L",
  "Kids XL",
] as const;

export const BABY_SIZE_FILTER_OPTIONS = [
  "NB",
  "0-1M",
  "0-3M",
  "3-6M",
  "6-9M",
  "6-12M",
  "9-12M",
  "12-18M",
  "18-24M",
  "24-36M",
] as const;

export const SHOE_SIZE_FILTER_OPTIONS = [
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
  "40",
  "41",
  "42",
  "43",
  "44",
] as const;

export function getCatalogSizeFilterOptions(
  department?: string | null,
  category?: string | null,
): string[] {
  const normalizedCategory = category?.trim().toLowerCase();

  if (normalizedCategory === "shoes") {
    return [...SHOE_SIZE_FILTER_OPTIONS];
  }

  if (department === "kids") {
    return normalizedCategory === "all"
      ? [...KIDS_SIZE_FILTER_OPTIONS, ...SHOE_SIZE_FILTER_OPTIONS]
      : [...KIDS_SIZE_FILTER_OPTIONS];
  }

  if (department === "babies") {
    return normalizedCategory === "all"
      ? [...BABY_SIZE_FILTER_OPTIONS, ...SHOE_SIZE_FILTER_OPTIONS]
      : [...BABY_SIZE_FILTER_OPTIONS];
  }

  return normalizedCategory === "all"
    ? [...ADULT_SIZE_FILTER_OPTIONS, ...SHOE_SIZE_FILTER_OPTIONS]
    : [...ADULT_SIZE_FILTER_OPTIONS];
}

export function getCatalogCategoriesForDepartment(
  department?: string | null,
): string[] {
  if (!department || department === "all") {
    return [...PRODUCT_CATEGORIES];
  }

  return [
    ...(PRODUCT_CATEGORY_GROUPS[
      department as keyof typeof PRODUCT_CATEGORY_GROUPS
    ] ?? PRODUCT_CATEGORIES),
  ];
}

export function isCatalogCategoryAllowed(department: string, category: string) {
  return getCatalogCategoriesForDepartment(department).includes(category);
}

export function isCatalogCategoryValue(category?: string | null) {
  const normalized = category?.trim().toLowerCase();
  return Boolean(normalized && PRODUCT_CATEGORIES.includes(normalized));
}

export function filterCatalogCategories(categories: Array<string | null | undefined>) {
  return [...new Set(categories.map((entry) => entry?.trim().toLowerCase() || "").filter(isCatalogCategoryValue))];
}

export function getDepartmentsForCategory(category: string): string[] {
  return PRODUCT_DEPARTMENTS.filter((department) =>
    (PRODUCT_CATEGORY_GROUPS[department] as readonly string[]).includes(category),
  );
}

export function formatCatalogLabel(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized === "tshirt") return "T-Shirt";
  if (normalized === "tshirts") return "T-Shirts";
  if (normalized === "sweatshirt") return "Sweatshirt";
  if (normalized === "sweatshirts") return "Sweatshirts";
  if (normalized === "set") return "Set";
  if (normalized === "beach") return "Beach";

  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getCatalogDepartmentDisplayLabel(department?: string | null) {
  const normalized = department?.trim().toLowerCase();

  if (normalized === "men") return "Men";
  if (normalized === "women") return "Women";
  if (normalized === "kids") return "Kids";
  if (normalized === "babies") return "Babies";

  return "";
}

export function isCatalogDepartmentVisible(department?: string | null) {
  return getCatalogDepartmentDisplayLabel(department).length > 0;
}

const ACCESSORY_CATEGORY_NAMES = new Set([
  "accessory",
  "accessories",
  ...ACCESSORY_CATEGORIES,
  "hats",
  "belts",
  "ties",
  "scarves",
  "wallets",
  "brooches",
  "bags",
]);

export function isAccessoryProduct(product: {
  category?: string | null;
  categoryRef?: { name?: string | null } | null;
  subcategory?: { name?: string | null } | null;
}) {
  return [product.category, product.categoryRef?.name, product.subcategory?.name].some((value) =>
    ACCESSORY_CATEGORY_NAMES.has(value?.trim().toLowerCase() ?? ""),
  );
}

export function getCatalogGenderLabel(plural = false) {
  return plural ? "Genders" : "Gender";
}

export function formatProductAttributeLabel(value?: string | null) {
  if (!value) return "";

  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";

  if (normalized === "xs") return "XS";
  if (normalized === "s") return "S";
  if (normalized === "m") return "M";
  if (normalized === "l") return "L";
  if (normalized === "xl") return "XL";
  if (normalized === "xxl") return "XXL";
  if (normalized === "xxxl") return "3XL";
  if (normalized === "one-size") return "One Size";

  return formatCatalogLabel(normalized);
}
