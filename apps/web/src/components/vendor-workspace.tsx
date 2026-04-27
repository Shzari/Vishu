"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers";
import { ProductMedia } from "@/components/product-media";
import { RequireRole } from "@/components/require-role";
import { StatusBadge } from "@/components/status-badge";
import {
  VendorWorkspaceShell,
  type VendorWorkspaceSection,
} from "@/components/vendor-workspace-shell";
import { apiRequest, assetUrl, formatCurrency } from "@/lib/api";
import {
  formatCatalogLabel,
  getCatalogDepartmentDisplayLabel,
  formatProductAttributeLabel,
  getCatalogGenderLabel,
} from "@/lib/catalog";
import type {
  Product,
  VendorCatalogOptions,
  VendorCatalogRequest,
} from "@/lib/types";

interface VendorOrdersResponse {
  id: string;
  orderNumber: string;
  totalPrice: number;
  paymentMethod: string;
  paymentStatus: string;
  cancelRequest?: {
    status: string;
    note?: string | null;
    requestedAt?: string | null;
  };
  status: string;
  createdAt: string;
  customerEmail: string;
  items: {
    id: string;
    quantity: number;
    unitPrice: number;
    commission: number;
    vendorEarnings: number;
    status: string;
    shipment?: {
      shippingCarrier: string | null;
      trackingNumber: string | null;
      shippedAt: string | null;
    };
    product: {
      id: string;
      title: string;
      category: string;
      color?: string | null;
      size?: string | null;
      productCode?: string | null;
    };
  }[];
}

interface VendorProductsResponse {
  vendor: {
    id: string;
    shop_name: string;
    is_active: boolean;
    is_verified: boolean;
    low_stock_threshold: number;
  };
  products: Product[];
}

const emptyCatalogRequestForm = {
  requestType: "brand" as VendorCatalogRequest["requestType"],
  requestedValue: "",
  note: "",
};

type EnrichedProduct = Product & {
  soldUnits: number;
  orderCount: number;
  revenue: number;
  isOutOfStock: boolean;
  isLowStock: boolean;
};

const emptyForm = {
  title: "",
  description: "",
  price: "",
  stock: "",
  brandId: "",
  categoryId: "",
  subcategoryId: "",
  genderGroupId: "",
  colorIds: [] as string[],
  sizeTypeId: "",
  sizeId: "",
};

function getNextVendorActions(status: string) {
  if (status === "pending") {
    return [{ label: "Confirm", value: "confirmed", tone: "button-secondary" as const }];
  }
  if (status === "confirmed") {
    return [{ label: "Mark shipped", value: "shipped", tone: "button" as const }];
  }
  if (status === "shipped") {
    return [{ label: "Mark delivered", value: "delivered", tone: "button-secondary" as const }];
  }
  return [];
}

function getWorkspaceCopy(section: Exclude<VendorWorkspaceSection, "settings">) {
  if (section === "dashboard") {
    return {
      eyebrow: "Overview",
      title: "Seller dashboard",
      description:
        "Track today’s store health, pending work, revenue, low-stock alerts, and recent activity.",
    };
  }
  if (section === "products") {
    return {
      eyebrow: "Catalog",
      title: "Products",
      description:
        "Create, edit, search, filter, duplicate, and manage your live catalog from one focused product workspace.",
    };
  }
  if (section === "inventory") {
    return {
      eyebrow: "Stock",
      title: "Inventory",
      description:
        "Review low-stock products, update quantities, and run bulk stock actions without mixing in order work.",
    };
  }
  if (section === "orders") {
    return {
      eyebrow: "Fulfillment",
      title: "Orders",
      description:
        "Handle pending, shipped, completed, cancelled, and returned orders in one structured fulfillment view.",
    };
  }
  return {
    eyebrow: "Finance",
    title: "Earnings",
    description:
      "See revenue, payout summary, recent earnings, and top-selling products in one clean seller view.",
  };
}

export function VendorWorkspace({
  section,
}: {
  section: Exclude<VendorWorkspaceSection, "settings">;
}) {
  const { token, profile, currentRole, refreshProfile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<VendorOrdersResponse[]>([]);
  const [vendorWorkspace, setVendorWorkspace] = useState<VendorProductsResponse["vendor"] | null>(null);
  const [catalogOptions, setCatalogOptions] = useState<VendorCatalogOptions | null>(null);
  const [catalogRequests, setCatalogRequests] = useState<VendorCatalogRequest[]>([]);
  const [catalogRequestForm, setCatalogRequestForm] = useState(emptyCatalogRequestForm);
  const [form, setForm] = useState(emptyForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileList | null>(null);
  const [replaceImages, setReplaceImages] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productSort, setProductSort] = useState("newest");
  const [stockFilter, setStockFilter] = useState(section === "inventory" ? "low_stock" : "all");
  const [listingFilter, setListingFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkStockValue, setBulkStockValue] = useState("");
  const [orderFilter, setOrderFilter] = useState("all");
  const [shippingCarrier, setShippingCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      await refreshProfile();
      const [vendorProducts, vendorOrders, vendorCatalogOptions, vendorCatalogRequests] = await Promise.all([
        apiRequest<VendorProductsResponse>("/products/vendor/me", undefined, token),
        apiRequest<VendorOrdersResponse[]>("/vendor/orders", undefined, token),
        apiRequest<VendorCatalogOptions>("/products/vendor/catalog-options", undefined, token),
        apiRequest<VendorCatalogRequest[]>("/products/vendor/catalog-requests", undefined, token),
      ]);
      setVendorWorkspace(vendorProducts.vendor);
      setProducts(vendorProducts.products);
      setOrders(vendorOrders);
      setCatalogOptions(vendorCatalogOptions);
      setCatalogRequests(vendorCatalogRequests);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load vendor workspace.");
    } finally {
      setLoading(false);
    }
  }, [refreshProfile, token]);

  useEffect(() => {
    if (token && currentRole === "vendor") {
      void loadWorkspace();
    }
  }, [currentRole, loadWorkspace, token]);

  async function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    try {
      setActiveAction(editingProductId ? `save-${editingProductId}` : "create-product");
      const resolvedSubcategoryId = selectedFormSubcategory?.id ?? form.subcategoryId;
      const body = new FormData();
      body.append("title", form.title);
      body.append("description", form.description);
      body.append("price", form.price);
      body.append("stock", form.stock);
      body.append("brandId", form.brandId);
      body.append("categoryId", form.categoryId);
      body.append("subcategoryId", resolvedSubcategoryId);
      if (form.genderGroupId) body.append("genderGroupId", form.genderGroupId);
      if (form.sizeTypeId) body.append("sizeTypeId", form.sizeTypeId);
      body.append("colorIds", JSON.stringify(form.colorIds));
      body.append(
        "sizeVariants",
        JSON.stringify(
          form.sizeId
            ? [{ sizeId: form.sizeId, stock: Number(form.stock || 0) }]
            : [],
        ),
      );
      if (editingProductId) {
        body.append("replaceImages", String(replaceImages));
      }
      Array.from(files ?? []).forEach((file) => body.append("images", file));
      await apiRequest(
        editingProductId ? `/products/${editingProductId}` : "/products",
        { method: editingProductId ? "PATCH" : "POST", body },
        token,
      );
      resetProductForm();
      setMessage(editingProductId ? "Product updated." : "Product created.");
      await loadWorkspace();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save product.");
    } finally {
      setActiveAction(null);
    }
  }

  async function submitCatalogRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    try {
      setActiveAction("catalog-request");
      setMessage(null);
      setError(null);
      const response = await apiRequest<{
        message: string;
        requests: VendorCatalogRequest[];
      }>(
        "/products/vendor/catalog-requests",
        {
          method: "POST",
          body: JSON.stringify({
            requestType: catalogRequestForm.requestType,
            requestedValue: catalogRequestForm.requestedValue,
            note: catalogRequestForm.note || undefined,
            categoryId:
              catalogRequestForm.requestType === "subcategory" ||
              catalogRequestForm.requestType === "category"
                ? form.categoryId || undefined
                : undefined,
            subcategoryId:
              catalogRequestForm.requestType === "subcategory"
                ? form.subcategoryId || undefined
                : undefined,
            sizeTypeId:
              catalogRequestForm.requestType === "size"
                ? form.sizeTypeId || undefined
                : undefined,
          }),
        },
        token,
      );
      setCatalogRequests(response.requests);
      setCatalogRequestForm(emptyCatalogRequestForm);
      setMessage(response.message);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to submit catalog request.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function deleteProduct(productId: string) {
    if (!token || !window.confirm("Delete this product from your catalog?")) return;
    try {
      setActiveAction(`delete-${productId}`);
      await apiRequest(`/products/${productId}`, { method: "DELETE" }, token);
      setMessage("Product deleted.");
      await loadWorkspace();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Delete failed.");
    } finally {
      setActiveAction(null);
    }
  }

  async function toggleProductListing(productId: string, isListed: boolean) {
    if (!token) return;
    try {
      setActiveAction(`listing-${productId}`);
      await apiRequest(
        `/products/${productId}/listing`,
        { method: "PATCH", body: JSON.stringify({ isListed }) },
        token,
      );
      setMessage(isListed ? "Product is visible in the shop." : "Product hidden from the public shop.");
      await loadWorkspace();
    } catch (listingError) {
      setError(listingError instanceof Error ? listingError.message : "Listing update failed.");
    } finally {
      setActiveAction(null);
    }
  }

  async function duplicateProduct(productId: string) {
    if (!token) return;
    try {
      setActiveAction(`duplicate-${productId}`);
      await apiRequest<Product>(`/products/${productId}/duplicate`, { method: "POST" }, token);
      setMessage("Product duplicated.");
      await loadWorkspace();
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : "Duplicate failed.");
    } finally {
      setActiveAction(null);
    }
  }

  async function applyBulkStockUpdate() {
    if (!token || selectedProductIds.length === 0 || bulkStockValue.trim().length === 0) return;
    try {
      setActiveAction("bulk-stock");
      await apiRequest(
        "/products/bulk-stock",
        {
          method: "PATCH",
          body: JSON.stringify({
            productIds: selectedProductIds,
            stock: Number(bulkStockValue),
          }),
        },
        token,
      );
      setMessage("Bulk stock updated.");
      setSelectedProductIds([]);
      setBulkStockValue("");
      await loadWorkspace();
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : "Bulk stock update failed.");
    } finally {
      setActiveAction(null);
    }
  }

  async function updateOrderStatus(orderId: string, status: string) {
    if (!token) return;
    try {
      setActiveAction(`order-${orderId}-${status}`);
      const body =
        status === "shipped"
          ? { status, shippingCarrier: shippingCarrier || undefined, trackingNumber }
          : { status };
      await apiRequest(
        `/vendor/orders/${orderId}/status`,
        { method: "PATCH", body: JSON.stringify(body) },
        token,
      );
      setMessage("Order status updated.");
      setShippingCarrier("");
      setTrackingNumber("");
      await loadWorkspace();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Status update failed.");
    } finally {
      setActiveAction(null);
    }
  }

  const vendorShopName = vendorWorkspace?.shop_name ?? profile?.vendor?.shop_name ?? "Your Shop";
  const vendorAccessRole = profile?.vendor?.access_role ?? "shop_holder";
  const vendorCanViewFinance = vendorAccessRole === "shop_holder";
  const vendorVerified = vendorWorkspace?.is_verified ?? profile?.vendor?.is_verified ?? false;
  const vendorActive = vendorWorkspace?.is_active ?? profile?.vendor?.is_active ?? false;
  const vendorCanManageCatalog = vendorVerified && vendorActive;
  const lowStockThreshold = vendorWorkspace?.low_stock_threshold ?? 5;
  const pendingOrders = orders.filter((order) => order.status === "pending").length;
  const totalOrders = orders.length;
  const completedOrders = orders.filter((order) => order.status === "delivered").length;
  const cancelledOrders = orders.filter((order) => order.status === "cancelled").length;
  const returnedOrders = orders.filter((order) => order.status === "returned").length;
  const inventoryUnits = products.reduce((sum, product) => sum + product.stock, 0);
  const projectedRevenue = orders.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.vendorEarnings, 0),
    0,
  );

  const productPerformance = useMemo(() => {
    const aggregates = new Map<string, { soldUnits: number; orderCount: number; revenue: number }>();
    orders.forEach((order) => {
      const seenInOrder = new Set<string>();
      order.items.forEach((item) => {
        const current = aggregates.get(item.product.id) ?? { soldUnits: 0, orderCount: 0, revenue: 0 };
        current.soldUnits += item.quantity;
        current.revenue += item.vendorEarnings;
        if (!seenInOrder.has(item.product.id)) {
          current.orderCount += 1;
          seenInOrder.add(item.product.id);
        }
        aggregates.set(item.product.id, current);
      });
    });
    return aggregates;
  }, [orders]);

  const enrichedProducts = useMemo<EnrichedProduct[]>(
    () =>
      products.map((product) => {
        const metrics = productPerformance.get(product.id) ?? { soldUnits: 0, orderCount: 0, revenue: 0 };
        const isOutOfStock = product.stock === 0;
        const isLowStock =
          lowStockThreshold > 0 && !isOutOfStock && product.stock <= lowStockThreshold;
        return {
          ...product,
          isListed: product.isListed ?? true,
          soldUnits: metrics.soldUnits,
          orderCount: metrics.orderCount,
          revenue: metrics.revenue,
          isOutOfStock,
          isLowStock,
        };
      }),
    [lowStockThreshold, productPerformance, products],
  );

  const vendorDepartments = useMemo(
    () =>
      [...new Set(products.map((product) => product.department))]
        .filter((entry) => getCatalogDepartmentDisplayLabel(entry))
        .sort(),
    [products],
  );
  const vendorCategories = useMemo(() => {
    const baseProducts =
      departmentFilter === "all"
        ? products
        : products.filter((product) => product.department === departmentFilter);
    return [...new Set(baseProducts.map((product) => product.category))].sort();
  }, [departmentFilter, products]);

  const filteredProducts = useMemo(
    () =>
      [...enrichedProducts]
        .filter((product) => {
          const search = productSearch.trim().toLowerCase();
          const matchesSearch =
            search.length === 0 ||
            `${product.title} ${product.department} ${product.category} ${product.productCode ?? ""} ${product.color ?? ""} ${product.size ?? ""}`
              .toLowerCase()
              .includes(search);
          if (!matchesSearch) return false;
          if (departmentFilter !== "all" && product.department !== departmentFilter) return false;
          if (categoryFilter !== "all" && product.category !== categoryFilter) return false;
          if (stockFilter === "in_stock") return product.stock > 0;
          if (stockFilter === "low_stock") return product.isLowStock;
          if (stockFilter === "out_of_stock") return product.isOutOfStock;
          if (listingFilter === "listed") return Boolean(product.isListed);
          if (listingFilter === "hidden") return !product.isListed;
          return true;
        })
        .sort((left, right) => {
          switch (productSort) {
            case "oldest":
              return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
            case "price-low":
              return left.price - right.price;
            case "price-high":
              return right.price - left.price;
            case "stock-low":
              return left.stock - right.stock;
            case "stock-high":
              return right.stock - left.stock;
            case "most-ordered":
              return right.soldUnits - left.soldUnits || right.orderCount - left.orderCount;
            case "title":
              return left.title.localeCompare(right.title);
            default:
              return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
          }
        }),
    [categoryFilter, departmentFilter, enrichedProducts, listingFilter, productSearch, productSort, stockFilter],
  );

  const filteredOrders = useMemo(
    () => orders.filter((order) => orderFilter === "all" || order.status === orderFilter),
    [orderFilter, orders],
  );
  const lowStockProducts = useMemo(
    () => enrichedProducts.filter((product) => product.isLowStock || product.isOutOfStock),
    [enrichedProducts],
  );
  const totalSoldUnits = useMemo(
    () => enrichedProducts.reduce((sum, product) => sum + product.soldUnits, 0),
    [enrichedProducts],
  );
  const bestSellers = useMemo(
    () =>
      [...enrichedProducts]
        .filter((product) => product.soldUnits > 0)
        .sort((left, right) => right.soldUnits - left.soldUnits || right.revenue - left.revenue)
        .slice(0, 5),
    [enrichedProducts],
  );
  const recentOrders = useMemo(
    () =>
      [...orders]
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
        .slice(0, 6),
    [orders],
  );
  const editingProduct = useMemo(
    () => products.find((product) => product.id === editingProductId) ?? null,
    [editingProductId, products],
  );
  const availableGenderGroups = useMemo(
    () => catalogOptions?.genderGroups ?? [],
    [catalogOptions],
  );
  const availableBrands = useMemo(
    () => catalogOptions?.brands ?? [],
    [catalogOptions],
  );
  const availableFormCategories = useMemo(
    () => catalogOptions?.categories ?? [],
    [catalogOptions],
  );
  const availableFormSubcategories = useMemo(
    () =>
      availableFormCategories.find((entry) => entry.id === form.categoryId)
        ?.subcategories ?? [],
    [availableFormCategories, form.categoryId],
  );
  const availableFormColors = useMemo(
    () => catalogOptions?.colors ?? [],
    [catalogOptions],
  );
  const availableFormSizeTypes = useMemo(
    () => catalogOptions?.sizeTypes ?? [],
    [catalogOptions],
  );
  const availableFormSizes = useMemo(
    () =>
      availableFormSizeTypes.find((entry) => entry.id === form.sizeTypeId)?.sizes ??
      [],
    [availableFormSizeTypes, form.sizeTypeId],
  );
  const selectedFormBrand = useMemo(
    () => availableBrands.find((entry) => entry.id === form.brandId) ?? null,
    [availableBrands, form.brandId],
  );
  const selectedFormGenderGroup = useMemo(
    () => availableGenderGroups.find((entry) => entry.id === form.genderGroupId) ?? null,
    [availableGenderGroups, form.genderGroupId],
  );
  const selectedFormCategory = useMemo(
    () => availableFormCategories.find((entry) => entry.id === form.categoryId) ?? null,
    [availableFormCategories, form.categoryId],
  );
  const selectedFormSubcategory = useMemo(
    () =>
      availableFormSubcategories.find((entry) => entry.id === form.subcategoryId) ??
      availableFormSubcategories[0] ??
      null,
    [availableFormSubcategories, form.subcategoryId],
  );
  const selectedFormSizeType = useMemo(
    () => availableFormSizeTypes.find((entry) => entry.id === form.sizeTypeId) ?? null,
    [availableFormSizeTypes, form.sizeTypeId],
  );
  const selectedFormSize = useMemo(
    () => availableFormSizes.find((entry) => entry.id === form.sizeId) ?? null,
    [availableFormSizes, form.sizeId],
  );
  const recentCatalogRequests = useMemo(
    () => catalogRequests.slice(0, 6),
    [catalogRequests],
  );
  const selectedFilePreviews = useMemo(() => {
    if (!files) return [];
    return Array.from(files).map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }));
  }, [files]);

  useEffect(() => {
    return () => {
      selectedFilePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [selectedFilePreviews]);

  useEffect(() => {
    if (
      form.categoryId &&
      !availableFormCategories.some((entry) => entry.id === form.categoryId)
    ) {
      setForm((current) => ({
        ...current,
        categoryId: "",
        subcategoryId: "",
      }));
    }
  }, [availableFormCategories, form.categoryId]);

  useEffect(() => {
    const nextSubcategoryId =
      availableFormSubcategories.find((entry) => entry.id === form.subcategoryId)?.id ??
      availableFormSubcategories[0]?.id ??
      "";

    if (nextSubcategoryId !== form.subcategoryId) {
      setForm((current) => ({ ...current, subcategoryId: nextSubcategoryId }));
    }
  }, [availableFormSubcategories, form.subcategoryId]);

  useEffect(() => {
    if (
      form.sizeTypeId &&
      !availableFormSizeTypes.some((entry) => entry.id === form.sizeTypeId)
    ) {
      setForm((current) => ({ ...current, sizeTypeId: "", sizeId: "" }));
    }
  }, [availableFormSizeTypes, form.sizeTypeId]);

  useEffect(() => {
    if (
      form.sizeId &&
      !availableFormSizes.some((entry) => entry.id === form.sizeId)
    ) {
      setForm((current) => ({ ...current, sizeId: "" }));
    }
  }, [availableFormSizes, form.sizeId]);

  useEffect(() => {
    if (categoryFilter !== "all" && !vendorCategories.includes(categoryFilter)) {
      setCategoryFilter("all");
    }
  }, [categoryFilter, vendorCategories]);

  useEffect(() => {
    setSelectedProductIds((current) =>
      current.filter((productId) => products.some((product) => product.id === productId)),
    );
  }, [products]);

  function resetProductForm() {
    setEditingProductId(null);
    setForm(emptyForm);
    setFiles(null);
    setReplaceImages(false);
  }

  function startEditProduct(product: Product) {
    setEditingProductId(product.id);
    setFiles(null);
    setReplaceImages(false);
    setForm({
      title: product.title,
      description: product.description,
      price: String(product.price),
      stock: String(product.stock),
      brandId: product.brand?.id ?? "",
      categoryId: product.categoryRef?.id ?? "",
      subcategoryId: product.subcategory?.id ?? "",
      genderGroupId: product.genderGroup?.id ?? "",
      colorIds: product.colors.map((entry) => entry.id),
      sizeTypeId: product.sizeVariants[0]?.sizeTypeId ?? "",
      sizeId: product.sizeVariants[0]?.id ?? "",
    });
  }

  const copy = getWorkspaceCopy(section);

  return (
    <RequireRole requiredRole="vendor">
      <VendorWorkspaceShell
        section={section}
        eyebrow={copy.eyebrow}
        title={`${vendorShopName} ${copy.title}`}
        description={copy.description}
        actions={
          <button className="button-ghost" type="button" onClick={() => void loadWorkspace()}>
            Refresh
          </button>
        }
      >
        {message ? <div className="message success">{message}</div> : null}
        {error ? <div className="message error">{error}</div> : null}
        {loading ? <div className="message">Refreshing vendor data...</div> : null}

        {section === "dashboard" ? (
          <>
            <div className="vendor-overview-grid">
              <div className="card vendor-overview-card"><span>Pending orders</span><strong>{pendingOrders}</strong><p>Orders still waiting for confirmation or shipment.</p></div>
              <div className="card vendor-overview-card"><span>Total orders</span><strong>{totalOrders}</strong><p>All marketplace orders that included your products.</p></div>
              {vendorCanViewFinance ? <div className="card vendor-overview-card"><span>Revenue</span><strong>{formatCurrency(projectedRevenue)}</strong><p>Tracked vendor earnings from your order items.</p></div> : null}
              <div className="card vendor-overview-card"><span>Low stock alerts</span><strong>{lowStockProducts.length}</strong><p>Products that need inventory attention soon.</p></div>
              <div className="card vendor-overview-card"><span>Listed products</span><strong>{products.length}</strong><p>Current catalog size in your store.</p></div>
              <div className="card vendor-overview-card"><span>Inventory units</span><strong>{inventoryUnits}</strong><p>Total sellable units across your catalog.</p></div>
            </div>
            <div className="vendor-section-grid">
              <section className="form-card stack">
                <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}><h2 className="section-title">Recent activity</h2><span className="chip">{recentOrders.length}</span></div>
                {recentOrders.length === 0 ? <div className="empty">No order activity yet.</div> : recentOrders.map((order) => <div key={order.id} className="vendor-activity-row"><div><strong>{order.customerEmail}</strong><p className="muted">{new Date(order.createdAt).toLocaleString()}</p></div><div className="chip-row"><StatusBadge status={order.status} />{vendorCanViewFinance ? <span className="chip">{formatCurrency(order.totalPrice)}</span> : null}</div></div>)}
              </section>
              <section className="form-card stack">
                <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}><h2 className="section-title">Recent alerts</h2><span className="chip">{lowStockProducts.length}</span></div>
                {lowStockProducts.length === 0 ? <div className="empty">Nothing urgent right now.</div> : lowStockProducts.slice(0, 6).map((product) => <div key={product.id} className="vendor-activity-row"><div><strong>{product.title}</strong><p className="muted">{product.isOutOfStock ? "Out of stock" : `Low stock at ${product.stock} units`}</p></div><span className={product.isOutOfStock ? "badge danger" : "badge warn"}>{product.isOutOfStock ? "Restock now" : "Low stock"}</span></div>)}
              </section>
            </div>
          </>
        ) : null}

        {section === "products" ? (
          <>
            <form className="form-card vendor-product-composer" onSubmit={submitProduct}>
              <div className="vendor-product-composer-header">
                <div className="vendor-product-composer-copy">
                  <div className="vendor-product-composer-kicker">Product studio</div>
                  <h2 className="section-title">
                    {editingProductId ? "Refine this product" : "Create a sharper listing"}
                  </h2>
                  <p className="muted">
                    Work through a cleaner product composer for details, catalog setup,
                    inventory, and images without changing the save flow.
                  </p>
                </div>
                <div className="vendor-product-composer-badges">
                  <span className={editingProductId ? "badge warn" : "badge"}>
                    {editingProductId ? "Editing" : "New listing"}
                  </span>
                  <span className="chip">
                    {selectedFilePreviews.length > 0
                      ? `${selectedFilePreviews.length} selected`
                      : editingProduct?.images.length
                        ? `${editingProduct.images.length} saved`
                        : "No images yet"}
                  </span>
                </div>
              </div>
              {!vendorCanManageCatalog ? (
                <div className="message error">
                  {vendorVerified
                    ? "Admin approval is still required before you can save products."
                    : "Verify your vendor email before you can save products."}
                </div>
              ) : null}
              <div className="vendor-product-composer-layout">
                <div className="vendor-product-composer-main">
                  <section className="vendor-product-composer-section">
                    <div className="vendor-product-composer-section-head">
                      <span className="vendor-product-composer-step">01</span>
                      <div>
                        <h3>Core details</h3>
                        <p className="muted">Start with the product name, description, price, and stock.</p>
                      </div>
                    </div>
                    <div className="field">
                      <label>Title</label>
                      <input
                        value={form.title}
                        placeholder="Ex. Soft lounge hoodie"
                        onChange={(event) =>
                          setForm((current) => ({ ...current, title: event.target.value }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label>Description</label>
                      <textarea
                        value={form.description}
                        placeholder="Write a short, customer-friendly description."
                        onChange={(event) =>
                          setForm((current) => ({ ...current, description: event.target.value }))
                        }
                      />
                    </div>
                    <div className="form-grid two">
                      <div className="field">
                        <label>Price</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={form.price}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, price: event.target.value }))
                          }
                        />
                      </div>
                      <div className="field">
                        <label>Stock</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={form.stock}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, stock: event.target.value }))
                          }
                        />
                      </div>
                    </div>
                  </section>

                  <section className="vendor-product-composer-section">
                    <div className="vendor-product-composer-section-head">
                      <span className="vendor-product-composer-step">02</span>
                      <div>
                        <h3>Catalog setup</h3>
                        <p className="muted">Map the product to your approved marketplace structure.</p>
                      </div>
                    </div>
                    <div className="form-grid two">
                      <div className="field">
                        <label>Brand</label>
                        <select
                          value={form.brandId}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, brandId: event.target.value }))
                          }
                        >
                          <option value="">Select brand</option>
                          {availableBrands.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>{getCatalogGenderLabel()}</label>
                        <select
                          value={form.genderGroupId}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, genderGroupId: event.target.value }))
                          }
                        >
                          <option value="">Select gender group</option>
                          {availableGenderGroups.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="form-grid two">
                      <div className="field">
                        <label>Category</label>
                        <select
                          value={form.categoryId}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              categoryId: event.target.value,
                              subcategoryId: "",
                            }))
                          }
                        >
                          <option value="">Select category</option>
                          {availableFormCategories.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="vendor-product-auto-card">
                        <span className="vendor-product-auto-label">Auto subcategory</span>
                        <strong>
                          {selectedFormSubcategory?.name ?? "Assigned from the chosen category"}
                        </strong>
                        <p className="muted">
                          Vendors no longer need to choose this manually. It is handled from the
                          category setup in the background.
                        </p>
                      </div>
                    </div>
                    <p className="muted vendor-catalog-help">
                      Vendors can only use approved catalog options here. If something is missing,
                      submit a request below instead of creating it directly.
                    </p>
                  </section>

                  <section className="vendor-product-composer-section">
                    <div className="vendor-product-composer-section-head">
                      <span className="vendor-product-composer-step">03</span>
                      <div>
                        <h3>Color and size</h3>
                        <p className="muted">Choose the attributes customers will use to shop this item.</p>
                      </div>
                    </div>
                    <div className="form-grid two">
                      <div className="field">
                        <label>Colors</label>
                        <select
                          multiple
                          value={form.colorIds}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              colorIds: Array.from(event.target.selectedOptions).map((option) => option.value),
                            }))
                          }
                        >
                          {availableFormColors.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name}
                            </option>
                          ))}
                        </select>
                        <p className="muted">Use Ctrl or Command to choose multiple colors.</p>
                      </div>
                      <div className="field">
                        <label>Size type</label>
                        <select
                          value={form.sizeTypeId}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              sizeTypeId: event.target.value,
                              sizeId: "",
                            }))
                          }
                        >
                          <option value="">Select size type</option>
                          {availableFormSizeTypes.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="form-grid two">
                      <div className="field">
                        <label>Size</label>
                        <select
                          value={form.sizeId}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, sizeId: event.target.value }))
                          }
                        >
                          <option value="">Select size</option>
                          {availableFormSizes.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </section>
                </div>

                <aside className="vendor-product-composer-side">
                  <section className="vendor-product-composer-panel vendor-upload-panel">
                    <div className="vendor-product-composer-section-head">
                      <span className="vendor-product-composer-step">04</span>
                      <div>
                        <h3>Images and publish</h3>
                        <p className="muted">Upload clear images, review the setup, and save when ready.</p>
                      </div>
                    </div>

                    <div className="vendor-product-meta-grid">
                      <div className="vendor-product-meta-card">
                        <span>Brand</span>
                        <strong>{selectedFormBrand?.name ?? "Choose brand"}</strong>
                      </div>
                      <div className="vendor-product-meta-card">
                        <span>Category</span>
                        <strong>{selectedFormCategory?.name ?? "Choose category"}</strong>
                      </div>
                      <div className="vendor-product-meta-card">
                        <span>{getCatalogGenderLabel()}</span>
                        <strong>{selectedFormGenderGroup?.name ?? "Optional"}</strong>
                      </div>
                      <div className="vendor-product-meta-card">
                        <span>Size setup</span>
                        <strong>
                          {selectedFormSize?.label ?? selectedFormSizeType?.name ?? "Choose size details"}
                        </strong>
                      </div>
                    </div>

                    <div className="vendor-upload-dropzone">
                      <div className="vendor-upload-dropzone-copy">
                        <strong>
                          {selectedFilePreviews.length > 0
                            ? `${selectedFilePreviews.length} new image${selectedFilePreviews.length === 1 ? "" : "s"} selected`
                            : editingProduct?.images.length
                              ? `${editingProduct.images.length} saved image${editingProduct.images.length === 1 ? "" : "s"}`
                              : "Choose product images"}
                        </strong>
                        <p className="muted">
                          Upload up to 6 images. Clean front shots and detail photos usually perform best.
                        </p>
                      </div>
                      <input
                        className="vendor-upload-input"
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(event) => setFiles(event.target.files)}
                      />
                    </div>

                    {editingProductId ? (
                      <label className="vendor-inline-toggle">
                        <input
                          type="checkbox"
                          checked={replaceImages}
                          onChange={(event) => setReplaceImages(event.target.checked)}
                        />
                        Replace existing images
                      </label>
                    ) : null}

                    {editingProduct && !replaceImages && editingProduct.images.length > 0 ? (
                      <div className="vendor-preview-group">
                        <div className="vendor-preview-heading">Current images</div>
                        <div className="preview-grid">
                          {editingProduct.images.map((image) => (
                            <div key={image} className="preview-card">
                              <ProductMedia
                                image={assetUrl(image)}
                                title={editingProduct.title}
                                subtitle="Current image"
                                className="card-image"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedFilePreviews.length > 0 ? (
                      <div className="vendor-preview-group">
                        <div className="vendor-preview-heading">New uploads</div>
                        <div className="preview-grid">
                          {selectedFilePreviews.map((preview) => (
                            <div key={preview.url} className="preview-card">
                              <ProductMedia
                                image={preview.url}
                                title={form.title || preview.name}
                                subtitle={preview.name}
                                className="card-image"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="inline-actions vendor-product-composer-actions">
                      <button className="button" type="submit" disabled={!vendorCanManageCatalog}>
                        {activeAction === (editingProductId ? `save-${editingProductId}` : "create-product")
                          ? editingProductId
                            ? "Updating..."
                            : "Creating..."
                          : editingProductId
                            ? "Update product"
                            : "Create product"}
                      </button>
                      {editingProductId ? (
                        <button
                          className="button-ghost"
                          type="button"
                          disabled={activeAction !== null}
                          onClick={resetProductForm}
                        >
                          Cancel edit
                        </button>
                      ) : null}
                    </div>
                  </section>
                </aside>
              </div>
            </form>
            <section className="form-card stack">
              <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 className="section-title">Missing catalog option?</h2>
                  <p className="muted">
                    Request a missing brand, category, size, or color. Admin will
                    review the request, then create the real value manually in Settings if approved.
                  </p>
                </div>
                <span className="chip">{catalogRequests.length} requests</span>
              </div>
              <form className="stack" onSubmit={submitCatalogRequest}>
                <div className="form-grid two">
                  <div className="field">
                    <label>Request type</label>
                    <select
                      value={catalogRequestForm.requestType}
                      onChange={(event) =>
                        setCatalogRequestForm((current) => ({
                          ...current,
                          requestType: event.target.value as VendorCatalogRequest["requestType"],
                        }))
                      }
                    >
                      <option value="brand">Brand</option>
                      <option value="category">Category</option>
                      <option value="size">Size</option>
                      <option value="color">Color</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Requested value</label>
                    <input
                      value={catalogRequestForm.requestedValue}
                      onChange={(event) =>
                        setCatalogRequestForm((current) => ({
                          ...current,
                          requestedValue: event.target.value,
                        }))
                      }
                      placeholder="Enter the missing option"
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Optional note</label>
                  <textarea
                    rows={3}
                    value={catalogRequestForm.note}
                    onChange={(event) =>
                      setCatalogRequestForm((current) => ({
                        ...current,
                        note: event.target.value,
                      }))
                    }
                    placeholder="Optional context for admin"
                  />
                </div>
                <div className="inline-actions">
                  <button className="button-secondary" type="submit">
                    {activeAction === "catalog-request"
                      ? "Submitting..."
                      : "Submit request"}
                  </button>
                </div>
              </form>
              {recentCatalogRequests.length === 0 ? (
                <div className="empty">No catalog requests submitted yet.</div>
              ) : (
                <div className="vendor-request-list">
                  {recentCatalogRequests.map((request) => (
                    <div key={request.id} className="vendor-request-row">
                      <div className="vendor-request-copy">
                        <strong>{request.requestedValue}</strong>
                        <p className="muted">
                          {formatCatalogLabel(request.requestType)}
                          {request.categoryName ? ` · ${request.categoryName}` : ""}
                          {request.subcategoryName ? ` · ${request.subcategoryName}` : ""}
                          {request.sizeTypeName ? ` · ${request.sizeTypeName}` : ""}
                        </p>
                        <p className="muted">
                          {new Date(request.createdAt).toLocaleString()}
                          {request.note ? ` · ${request.note}` : ""}
                        </p>
                        {request.adminNote ? (
                          <p className="muted">Admin note: {request.adminNote}</p>
                        ) : null}
                      </div>
                      <span
                        className={
                          request.status === "pending"
                            ? "badge warn"
                            : request.status === "approved"
                              ? "badge"
                              : "badge danger"
                        }
                      >
                        {request.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="form-card stack">
              <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}><div><h2 className="section-title">Product list</h2><p className="muted">Search and filter your catalog, then edit or manage each product from its own row.</p></div><span className="chip">{filteredProducts.length} shown</span></div>
              <div className="vendor-product-toolbar"><div className="field"><label>Search products</label><input placeholder="Title, code, gender, category, color, size" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} /></div><div className="field"><label>Sort by</label><select value={productSort} onChange={(event) => setProductSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="price-low">Price low to high</option><option value="price-high">Price high to low</option><option value="title">Title A-Z</option><option value="most-ordered">Most ordered</option></select></div><div className="field"><label>Listing filter</label><select value={listingFilter} onChange={(event) => setListingFilter(event.target.value)}><option value="all">Listed and hidden</option><option value="listed">Listed only</option><option value="hidden">Hidden only</option></select></div><div className="field"><label>{getCatalogGenderLabel()}</label><select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option value="all">All {getCatalogGenderLabel(true).toLowerCase()}</option>{vendorDepartments.map((entry) => <option key={entry} value={entry}>{formatCatalogLabel(entry)}</option>)}</select></div><div className="field"><label>Category</label><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{vendorCategories.map((entry) => <option key={entry} value={entry}>{formatCatalogLabel(entry)}</option>)}</select></div></div>
              {filteredProducts.length === 0 ? <div className="empty">{products.length === 0 ? "No products yet. Add your first product to start building the shop." : "No matching products yet."}</div> : filteredProducts.map((product) => <div key={product.id} className="card vendor-product-collapsible"><div className="vendor-product-summary-row"><div className="vendor-product-summary-main"><strong>{product.productCode || "Code pending"}</strong><span className="muted">{product.title}</span><span className="muted">{product.isListed ? "Listed" : "Hidden"}</span><span className="muted">Stock {product.stock}</span><span className="muted">{formatCurrency(product.price)}</span></div><div className="vendor-product-summary-end"><span className={product.isOutOfStock ? "badge danger" : product.isLowStock ? "badge warn" : "badge"}>{product.isOutOfStock ? "Out of stock" : product.isLowStock ? "Low stock" : "Healthy stock"}</span><button className="button-ghost vendor-expand-toggle" type="button" onClick={() => setExpandedProductId((current) => (current === product.id ? null : product.id))}>{expandedProductId === product.id ? "▾" : "▸"}</button></div></div>{expandedProductId === product.id ? <div className="vendor-product-expanded"><div className="vendor-product-preview"><ProductMedia image={assetUrl(product.images[0])} title={product.title} subtitle={`${formatCatalogLabel(product.department)} ${formatCatalogLabel(product.category)}`} className="card-image" /></div><div className="vendor-product-content"><div className="stack" style={{ gap: "0.2rem" }}><strong>{product.title}</strong><p className="muted">{formatCatalogLabel(product.department)} | {formatCatalogLabel(product.category)}{product.color ? ` | ${formatProductAttributeLabel(product.color)}` : ""}{product.size ? ` | ${formatProductAttributeLabel(product.size)}` : ""}</p></div><div className="vendor-product-metrics"><span>{product.isListed ? "Public listing active" : "Hidden from customers"}</span><span>Price {formatCurrency(product.price)}</span><span>Stock {product.stock}</span><span>Sold {product.soldUnits}</span><span>Orders {product.orderCount}</span>{vendorCanViewFinance ? <span>Earnings {formatCurrency(product.revenue)}</span> : null}</div></div><div className="vendor-product-actions"><button className="button-secondary" type="button" disabled={activeAction !== null} onClick={() => startEditProduct(product)}>Edit</button><button className="button-ghost" type="button" disabled={activeAction !== null} onClick={() => duplicateProduct(product.id)}>{activeAction === `duplicate-${product.id}` ? "Duplicating..." : "Duplicate"}</button><button className="button-ghost" type="button" disabled={activeAction !== null} onClick={() => toggleProductListing(product.id, !product.isListed)}>{activeAction === `listing-${product.id}` ? "Saving..." : product.isListed ? "Hide" : "Show"}</button><button className="danger-button" type="button" disabled={activeAction !== null} onClick={() => deleteProduct(product.id)}>{activeAction === `delete-${product.id}` ? "Deleting..." : "Delete"}</button></div></div> : null}</div>)}
            </section>
          </>
        ) : null}

        {section === "inventory" ? <><section className="form-card stack"><div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}><div><h2 className="section-title">Stock controls</h2><p className="muted">Focus only on stock levels, low-stock alerts, out-of-stock items, and bulk quantity updates.</p></div><span className="chip">Threshold {lowStockThreshold === 0 ? "off" : lowStockThreshold}</span></div><div className="vendor-product-toolbar"><div className="field"><label>Search products</label><input placeholder="Title, code, color, size" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} /></div><div className="field"><label>Stock filter</label><select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}><option value="all">All stock states</option><option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option><option value="in_stock">In stock</option></select></div><div className="field"><label>{getCatalogGenderLabel()}</label><select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option value="all">All {getCatalogGenderLabel(true).toLowerCase()}</option>{vendorDepartments.map((entry) => <option key={entry} value={entry}>{formatCatalogLabel(entry)}</option>)}</select></div><div className="field"><label>Category</label><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{vendorCategories.map((entry) => <option key={entry} value={entry}>{formatCatalogLabel(entry)}</option>)}</select></div></div></section><section className="form-card stack"><div className="card vendor-bulk-actions"><div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}><div><strong>Bulk stock update</strong><p className="muted">Select products below, set one shared stock value, and update them together.</p></div><span className="chip">{selectedProductIds.length} selected</span></div><div className="inline-actions"><button className="button-secondary" type="button" onClick={() => setSelectedProductIds(filteredProducts.map((product) => product.id))} disabled={filteredProducts.length === 0}>Select shown</button><button className="button-ghost" type="button" onClick={() => setSelectedProductIds([])} disabled={selectedProductIds.length === 0}>Clear selection</button></div><div className="inline-actions" style={{ alignItems: "end" }}><div className="field" style={{ minWidth: "180px" }}><label>New stock for selected</label><input type="number" min="0" value={bulkStockValue} onChange={(event) => setBulkStockValue(event.target.value)} placeholder="e.g. 12" /></div><button className="button" type="button" disabled={selectedProductIds.length === 0 || bulkStockValue.trim().length === 0} onClick={() => void applyBulkStockUpdate()}>{activeAction === "bulk-stock" ? "Updating..." : "Apply stock update"}</button></div></div>{filteredProducts.length === 0 ? <div className="empty">No stock-managed products for this filter.</div> : filteredProducts.map((product) => <div key={product.id} className="card vendor-product-collapsible"><div className="vendor-product-summary-row"><div className="vendor-product-summary-main"><label className="vendor-row-check"><input type="checkbox" checked={selectedProductIds.includes(product.id)} onChange={(event) => setSelectedProductIds((current) => event.target.checked ? [...current, product.id] : current.filter((entry) => entry !== product.id))} /></label><strong>{product.productCode || "Code pending"}</strong><span className="muted">{product.title}</span><span className="muted">Stock {product.stock}</span><span className="muted">Sold {product.soldUnits}</span></div><div className="vendor-product-summary-end"><span className={product.isOutOfStock ? "badge danger" : product.isLowStock ? "badge warn" : "badge"}>{product.isOutOfStock ? "Out of stock" : product.isLowStock ? "Low stock" : "Healthy stock"}</span></div></div></div>)}</section></> : null}

        {section === "orders" ? <section className="form-card stack"><div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}><h2 className="section-title">Order handling</h2><span className="chip">{filteredOrders.length} orders</span></div><div className="field"><label>Order status</label><select value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="shipped">Shipped</option><option value="delivered">Completed</option><option value="cancelled">Cancelled</option><option value="returned">Returned</option></select></div>{filteredOrders.length === 0 ? <div className="empty">No orders for this filter yet.</div> : filteredOrders.map((order) => <div key={order.id} className="card"><div className="inline-actions" style={{ justifyContent: "space-between" }}><div><strong>{order.orderNumber}</strong><p className="muted">{order.customerEmail}</p><p className="muted">{new Date(order.createdAt).toLocaleString()}</p><p className="muted">{order.paymentMethod === "cash_on_delivery" ? "Cash on delivery" : "Paid online"} | {order.paymentStatus === "cod_pending" ? "Collect on arrival" : order.paymentStatus === "cod_collected" ? "Cash collected" : order.paymentStatus === "cod_refused" ? "Delivery refused" : "Already paid"}</p></div><div className="chip-row"><StatusBadge status={order.status} />{vendorCanViewFinance ? <span className="chip">{formatCurrency(order.totalPrice)}</span> : null}{order.cancelRequest?.status === "requested" ? <span className="badge warn">Cancel requested</span> : null}</div></div>{order.items.map((item) => <div key={item.id} className="order-line"><div><strong>{item.product.title}</strong><p className="muted">{item.product.productCode ? `${item.product.productCode} | ` : ""}{item.quantity} x {formatCurrency(item.unitPrice)}{vendorCanViewFinance ? ` | earnings ${formatCurrency(item.vendorEarnings)}` : ""}</p></div><StatusBadge status={item.status} /></div>)}{order.status === "confirmed" ? <div className="form-grid two"><div className="field"><label>Carrier</label><input placeholder="DHL, UPS, local courier" value={shippingCarrier} onChange={(event) => setShippingCarrier(event.target.value)} /></div><div className="field"><label>Tracking number</label><input placeholder="Required before shipping" value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} /></div></div> : null}<div className="inline-actions">{getNextVendorActions(order.status).length === 0 ? <span className="muted">This order does not need a next status action.</span> : null}{getNextVendorActions(order.status).map((action) => <button key={action.value} className={action.tone} type="button" disabled={activeAction !== null || (action.value === "shipped" && trackingNumber.trim().length === 0)} onClick={() => updateOrderStatus(order.id, action.value)}>{activeAction === `order-${order.id}-${action.value}` ? "Saving..." : action.label}</button>)}</div></div>)}</section> : null}

        {section === "earnings" ? <><div className="vendor-overview-grid"><div className="card vendor-overview-card"><span>Total vendor earnings</span><strong>{formatCurrency(projectedRevenue)}</strong><p>Net earnings tracked across all vendor order items.</p></div><div className="card vendor-overview-card"><span>Completed orders</span><strong>{completedOrders}</strong><p>Delivered orders contributing to your performance.</p></div><div className="card vendor-overview-card"><span>Units sold</span><strong>{totalSoldUnits}</strong><p>Total sold units across your active catalog.</p></div><div className="card vendor-overview-card"><span>Cancelled / returned</span><strong>{cancelledOrders + returnedOrders}</strong><p>Orders that did not finish the normal delivery flow.</p></div></div><div className="vendor-section-grid"><section className="form-card stack"><div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}><h2 className="section-title">Top-selling products</h2><span className="chip">{bestSellers.length}</span></div>{bestSellers.length === 0 ? <div className="empty">Sales data will appear here once orders start coming in.</div> : bestSellers.map((product) => <div key={product.id} className="vendor-activity-row"><div><strong>{product.title}</strong><p className="muted">{product.soldUnits} sold | {product.orderCount} orders</p></div><span className="chip">{formatCurrency(product.revenue)}</span></div>)}</section><section className="form-card stack"><div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}><h2 className="section-title">Recent earnings</h2><span className="chip">{recentOrders.length}</span></div>{recentOrders.length === 0 ? <div className="empty">No earnings activity yet.</div> : recentOrders.map((order) => <div key={order.id} className="vendor-activity-row"><div><strong>{order.customerEmail}</strong><p className="muted">{new Date(order.createdAt).toLocaleDateString()}</p></div><span className="chip">{formatCurrency(order.items.reduce((sum, item) => sum + item.vendorEarnings, 0))}</span></div>)}</section></div></> : null}
      </VendorWorkspaceShell>
    </RequireRole>
  );
}
