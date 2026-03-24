export const PRODUCT_DEPARTMENTS = ["men", "women", "unisex"] as const;

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
    "suits",
    "sportswear",
    "accessories",
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
    "dresses",
    "skirts",
    "suits",
    "sportswear",
    "accessories",
  ],
  unisex: [
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
    "sportswear",
    "accessories",
  ],
} as const;

export const PRODUCT_CATEGORIES: string[] = [
  ...new Set(Object.values(PRODUCT_CATEGORY_GROUPS).flat()),
] as string[];

export const PRODUCT_COLOR_OPTIONS = [
  "black",
  "white",
  "ivory",
  "cream",
  "beige",
  "brown",
  "tan",
  "gray",
  "blue",
  "navy",
  "red",
  "orange",
  "yellow",
  "green",
  "olive",
  "pink",
  "purple",
  "burgundy",
  "gold",
  "silver",
  "multicolor",
] as const;

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

export function getDepartmentsForCategory(category: string): string[] {
  return PRODUCT_DEPARTMENTS.filter((department) =>
    (PRODUCT_CATEGORY_GROUPS[department] as readonly string[]).includes(category),
  );
}

export function formatCatalogLabel(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
