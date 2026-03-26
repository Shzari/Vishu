import {
  formatCatalogLabel,
  getCatalogCategoriesForDepartment,
} from "@/lib/catalog";

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
      "pants",
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
      "skirts",
      "leggings",
      "accessories",
    ],
  },
  {
    id: "kids",
    label: "KIDS",
    available: false,
    note: "Structured kidswear navigation is prepared for the next catalog expansion.",
    subcategories: [
      "tshirts",
      "hoodies",
      "jackets",
      "sets",
      "jeans",
      "pants",
      "schoolwear",
      "sleepwear",
    ],
  },
  {
    id: "babies",
    label: "BABIES",
    available: false,
    note: "Soft essentials, newborn sets, and nursery basics are coming into the catalog.",
    subcategories: [
      "bodysuits",
      "rompers",
      "sets",
      "outerwear",
      "sleepwear",
      "blankets",
      "accessories",
      "gift sets",
    ],
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

  if (group.available && group.department) {
    return getCatalogCategoriesForDepartment(group.department);
  }

  return [...group.subcategories];
}

export function isStorefrontBrowseSelectionValid(
  department: string,
  category: string,
) {
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
  return "";
}

export function getStorefrontCategoryHeading(
  department: string,
  category: string,
) {
  const departmentTitle = getStorefrontDepartmentTitle(department);
  const categoryTitle = formatCatalogLabel(category);

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
