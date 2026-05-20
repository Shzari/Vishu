import {
  ACCESSORY_CATEGORIES,
  formatCatalogLabel,
  getCatalogCategoriesForDepartment,
} from "@/lib/catalog";

export const ACCESSORY_NAV_LABELS: Record<
  string,
  string
> = {
  hat: "Hats",
  belt: "Belts",
  tie: "Ties",
  scarf: "Scarves",
  wallet: "Wallets",
  glasses: "Glasses",
  brooch: "Brooches",
  bag: "Bags",
  jewelry: "Jewelry",
};

export const STOREFRONT_NAV_GROUPS = [
  {
    id: "men",
    label: "MEN",
    department: "men",
    available: true,
    note: "Refined daily staples, tailoring, and outerwear.",
    subcategories: [
      "tshirts",
      "shirts",
      "hoodies",
      "jackets",
      "jeans",
      "shoes",
      "pants",
      "kostume",
      "beach",
      "underwear",
      "outerwear",
      "sportswear",
    ],
  },
  {
    id: "women",
    label: "WOMEN",
    department: "women",
    available: true,
    note: "Dresses, elevated essentials, and seasonal layers.",
    subcategories: [
      "dresses",
      "tops",
      "jackets",
      "shirts",
      "jeans",
      "shoes",
      "skirts",
      "leggings",
      "komplete",
      "beach",
      "underwear",
    ],
  },
  {
    id: "kids",
    label: "KIDS",
    available: true,
    department: "kids",
    note: "Kidswear, school essentials, and shoes.",
    subcategories: [
      "tshirts",
      "hoodies",
      "jackets",
      "beach",
      "jeans",
      "shoes",
      "pants",
      "underwear",
      "schoolwear",
      "sleepwear",
    ],
  },
  {
    id: "babies",
    label: "BABIES",
    available: true,
    department: "babies",
    note: "Soft essentials, newborn basics, and first shoes.",
    subcategories: [
      "bodysuits",
      "rompers",
      "outerwear",
      "sleepwear",
      "underwear",
      "shoes",
      "blankets",
      "beach",
    ],
  },
  {
    id: "accessories",
    label: "ACCESSORIES",
    department: "all",
    available: true,
    note: "Hats, belts, ties, bags, and finishing details.",
    subcategories: ACCESSORY_CATEGORIES,
  },
] as const;

export type StorefrontNavGroup = (typeof STOREFRONT_NAV_GROUPS)[number];

export function getStorefrontNavGroup(groupId: string) {
  return STOREFRONT_NAV_GROUPS.find((entry) => entry.id === groupId) ?? null;
}

export function getStorefrontNavCategories(groupId: string) {
  const group = getStorefrontNavGroup(groupId);

  if (!group) {
    return [];
  }

  if (group.id === "accessories") {
    return [...ACCESSORY_CATEGORIES];
  }

  if (group.available && group.department) {
    return getCatalogCategoriesForDepartment(group.department);
  }

  return [...group.subcategories];
}

export function isStorefrontBrowseSelectionValid(
  department: string,
  category: string,
) {
  if (category === "all") {
    if (department === "all") {
      return true;
    }

    return STOREFRONT_NAV_GROUPS.some(
      (entry) =>
        entry.available &&
        entry.department === department &&
        entry.id !== "accessories",
    );
  }

  if (department === "all") {
    return ACCESSORY_CATEGORIES.includes(
      category as (typeof ACCESSORY_CATEGORIES)[number],
    );
  }

  return getStorefrontNavCategories(department).includes(category);
}

export function buildStorefrontCategoryHref(
  department: string,
  category: string,
) {
  return `/browse/${department}/${category}`;
}

export function getStorefrontDepartmentTitle(department: string) {
  if (department === "men") return "Men";
  if (department === "women") return "Women";
  if (department === "kids") return "Kids";
  if (department === "babies") return "Babies";
  if (department === "all") return "Accessories";
  return "";
}

export function formatStorefrontNavCategoryLabel(
  groupId: string,
  category: string,
) {
  if (groupId === "accessories") {
    return ACCESSORY_NAV_LABELS[category] ?? formatCatalogLabel(category);
  }

  return formatCatalogLabel(category);
}

export function getStorefrontCategoryHeading(
  department: string,
  category: string,
) {
  const departmentTitle = getStorefrontDepartmentTitle(department);
  const categoryTitle = formatCatalogLabel(category);

  if (department === "all") {
    return ACCESSORY_NAV_LABELS[category] ?? categoryTitle;
  }

  if (department === "men") {
    return `Men's ${categoryTitle}`;
  }

  if (department === "women") {
    return `Women's ${categoryTitle}`;
  }

  if (department === "kids") {
    return `Kids' ${categoryTitle}`;
  }

  if (department === "babies") {
    return `Babies' ${categoryTitle}`;
  }

  return departmentTitle ? `${departmentTitle} ${categoryTitle}` : categoryTitle;
}
