import { notFound } from "next/navigation";
import { CategoryResultsPage } from "@/components/category-results-page";
import { isStorefrontBrowseSelectionValid } from "@/lib/storefront-nav";

export default async function BrowseCategoryPage({
  params,
}: {
  params: Promise<{ department: string; category: string }>;
}) {
  const resolved = await params;
  const department = decodeURIComponent(resolved.department).toLowerCase();
  const category = decodeURIComponent(resolved.category).toLowerCase();

  if (!isStorefrontBrowseSelectionValid(department, category)) {
    notFound();
  }

  return (
    <CategoryResultsPage
      mode="category"
      department={department}
      category={category}
    />
  );
}
