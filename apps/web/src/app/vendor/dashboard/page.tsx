"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { apiRequest, assetUrl, formatCurrency } from "@/lib/api";
import {
  PRODUCT_COLOR_OPTIONS,
  PRODUCT_DEPARTMENTS,
  PRODUCT_SIZE_OPTIONS,
  formatCatalogLabel,
  formatProductAttributeLabel,
  getCatalogCategoriesForDepartment,
  getCatalogGenderLabel,
} from "@/lib/catalog";
import { ProductMedia } from "@/components/product-media";
import { StatusBadge } from "@/components/status-badge";
import type { Product } from "@/lib/types";

interface VendorOrdersResponse {
  id: string;
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
    email: string;
    shop_name: string;
    is_active: boolean;
    is_verified: boolean;
    low_stock_threshold: number;
    has_active_subscription: boolean;
    is_publicly_visible: boolean;
  };
  products: Product[];
}

const emptyForm = {
  title: "",
  description: "",
  price: "",
  stock: "",
  department: "unisex",
  category: "",
  color: "",
  size: "",
};

function getNextVendorActions(status: string) {
  if (status === "pending") {
    return [{ label: "Confirm", value: "confirmed", tone: "button-secondary" as const }];
  }

  if (status === "confirmed") {
    return [{ label: "Mark Shipped", value: "shipped", tone: "button" as const }];
  }

  if (status === "shipped") {
    return [{ label: "Mark Delivered", value: "delivered", tone: "button-secondary" as const }];
  }

  return [];
}

export default function VendorDashboardPage() {
  const { token, user, profile, currentRole, refreshProfile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<VendorOrdersResponse[]>([]);
  const [vendorWorkspace, setVendorWorkspace] = useState<VendorProductsResponse["vendor"] | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [files, setFiles] = useState<FileList | null>(null);
  const [replaceImages, setReplaceImages] = useState(false);
  const [activeView, setActiveView] = useState<"products" | "add-product" | "low-stock" | "orders">("products");
  const [productSearch, setProductSearch] = useState("");
  const [productSort, setProductSort] = useState("newest");
  const [stockFilter, setStockFilter] = useState("all");
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

  async function loadDashboard() {
    if (!token) return;

    try {
      setLoading(true);
      await refreshProfile();
      const vendorProducts = await apiRequest<VendorProductsResponse>(
        "/products/vendor/me",
        undefined,
        token,
      );
      const vendorOrders = await apiRequest<VendorOrdersResponse[]>(
        "/vendor/orders",
        undefined,
        token,
      );
      setVendorWorkspace(vendorProducts.vendor);
      setProducts(vendorProducts.products);
      setOrders(vendorOrders);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load vendor dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token && currentRole === "vendor") {
      void loadDashboard();
    }
  }, [currentRole, token]);

  async function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    setError(null);
    setMessage(null);

    try {
      setActiveAction(editingProductId ? `save-${editingProductId}` : "create-product");
      const body = new FormData();
      body.append("title", form.title);
      body.append("description", form.description);
      body.append("price", form.price);
      body.append("stock", form.stock);
      body.append("department", form.department);
      body.append("category", form.category);
      body.append("color", form.color);
      body.append("size", form.size);
      if (editingProductId) {
        body.append("replaceImages", String(replaceImages));
      }
      Array.from(files ?? []).forEach((file) => body.append("images", file));

      await apiRequest(
        editingProductId ? `/products/${editingProductId}` : "/products",
        {
          method: editingProductId ? "PATCH" : "POST",
          body,
        },
        token,
      );

      setForm(emptyForm);
      setFiles(null);
      setReplaceImages(false);
      setEditingProductId(null);
      setMessage(editingProductId ? "Product updated." : "Product created.");
      await loadDashboard();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save product.");
    } finally {
      setActiveAction(null);
    }
  }

  async function deleteProduct(productId: string) {
    if (!token) return;
    if (!window.confirm("Delete this product from your catalog?")) return;
    try {
      setActiveAction(`delete-${productId}`);
      await apiRequest(`/products/${productId}`, { method: "DELETE" }, token);
      setMessage("Product deleted.");
      await loadDashboard();
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
        {
          method: "PATCH",
          body: JSON.stringify({ isListed }),
        },
        token,
      );
      setMessage(isListed ? "Product is visible in the shop." : "Product hidden from the public shop.");
      await loadDashboard();
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
      const duplicated = await apiRequest<Product>(
        `/products/${productId}/duplicate`,
        { method: "POST" },
        token,
      );
      setMessage(`Duplicated ${duplicated.title}. The copy starts hidden so you can review it first.`);
      setExpandedProductId(duplicated.id);
      await loadDashboard();
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
      const nextStock = Number(bulkStockValue);
      await apiRequest(
        "/products/bulk-stock",
        {
          method: "PATCH",
          body: JSON.stringify({
            productIds: selectedProductIds,
            stock: nextStock,
          }),
        },
        token,
      );
      setMessage(
        `Updated stock to ${nextStock} for ${selectedProductIds.length} product${selectedProductIds.length === 1 ? "" : "s"}.`,
      );
      setSelectedProductIds([]);
      setBulkStockValue("");
      await loadDashboard();
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
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
        token,
      );
      setMessage("Order status updated.");
      setShippingCarrier("");
      setTrackingNumber("");
      await loadDashboard();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Status update failed.");
    } finally {
      setActiveAction(null);
    }
  }

  const vendorShopName = vendorWorkspace?.shop_name ?? profile?.vendor?.shop_name ?? "Your Shop Dashboard";
  const vendorVerified = vendorWorkspace?.is_verified ?? profile?.vendor?.is_verified ?? false;
  const vendorActive = vendorWorkspace?.is_active ?? profile?.vendor?.is_active ?? false;
  const vendorHasActiveSubscription = vendorWorkspace?.has_active_subscription ?? false;
  const vendorIsPubliclyVisible = vendorWorkspace?.is_publicly_visible ?? false;
  const vendorCanManageCatalog = vendorVerified && vendorActive;
  const lowStockThreshold = vendorWorkspace?.low_stock_threshold ?? 5;
  const inventoryUnits = products.reduce((sum, product) => sum + product.stock, 0);
  const pendingOrders = orders.filter((order) => order.status === "pending").length;
  const projectedRevenue = orders.reduce(
    (sum, order) =>
      sum + order.items.reduce((orderSum, item) => orderSum + item.vendorEarnings, 0),
    0,
  );
  const productPerformance = useMemo(() => {
    const aggregates = new Map<
      string,
      { soldUnits: number; orderCount: number; revenue: number }
    >();

    orders.forEach((order) => {
      const seenInOrder = new Set<string>();
      order.items.forEach((item) => {
        const current = aggregates.get(item.product.id) ?? {
          soldUnits: 0,
          orderCount: 0,
          revenue: 0,
        };
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
  const enrichedProducts = useMemo(() => {
    return products.map((product) => {
      const metrics = productPerformance.get(product.id) ?? {
        soldUnits: 0,
        orderCount: 0,
        revenue: 0,
      };
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
    });
  }, [lowStockThreshold, productPerformance, products]);
  const filteredProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase();
    const lowStockOnly = activeView === "low-stock";
    const nextProducts = enrichedProducts
      .filter((product) => {
        const matchesSearch =
          search.length === 0 ||
          `${product.title} ${product.department} ${product.category} ${product.productCode ?? ""} ${product.color ?? ""} ${product.size ?? ""}`
            .toLowerCase()
            .includes(search);
        if (!matchesSearch) {
          return false;
        }

        if (lowStockOnly && !product.isLowStock) {
          return false;
        }

        if (departmentFilter !== "all" && product.department !== departmentFilter) {
          return false;
        }

        if (categoryFilter !== "all" && product.category !== categoryFilter) {
          return false;
        }

        if (stockFilter === "in_stock") {
          return product.stock > 0;
        }
        if (stockFilter === "low_stock") {
          return product.isLowStock;
        }
        if (stockFilter === "out_of_stock") {
          return product.isOutOfStock;
        }

        if (listingFilter === "listed") {
          return product.isListed;
        }

        if (listingFilter === "hidden") {
          return !product.isListed;
        }

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
      });

    return nextProducts;
  }, [activeView, categoryFilter, departmentFilter, enrichedProducts, listingFilter, productSearch, productSort, stockFilter]);
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => orderFilter === "all" || order.status === orderFilter);
  }, [orderFilter, orders]);
  const lowStockProducts = useMemo(
    () => enrichedProducts.filter((product) => product.isLowStock),
    [enrichedProducts],
  );
  const vendorDepartments = useMemo(
    () => [...new Set(products.map((product) => product.department))].sort(),
    [products],
  );
  const vendorCategories = useMemo(() => {
    const baseProducts =
      departmentFilter === "all"
        ? products
        : products.filter((product) => product.department === departmentFilter);

    return [...new Set(baseProducts.map((product) => product.category))].sort();
  }, [departmentFilter, products]);
  const totalSoldUnits = useMemo(
    () => enrichedProducts.reduce((sum, product) => sum + product.soldUnits, 0),
    [enrichedProducts],
  );
  const bestSellers = useMemo(
    () =>
      [...enrichedProducts]
        .filter((product) => product.soldUnits > 0)
        .sort((left, right) => right.soldUnits - left.soldUnits || right.revenue - left.revenue)
        .slice(0, 3),
    [enrichedProducts],
  );
  const slowMovers = useMemo(
    () =>
      [...enrichedProducts]
        .filter((product) => product.stock > 0)
        .sort((left, right) => left.soldUnits - right.soldUnits || right.stock - left.stock)
        .slice(0, 3),
    [enrichedProducts],
  );
  const stockWatchProducts = useMemo(
    () =>
      [...enrichedProducts]
        .filter((product) => product.isOutOfStock || product.isLowStock)
        .sort((left, right) => left.stock - right.stock || right.soldUnits - left.soldUnits)
        .slice(0, 4),
    [enrichedProducts],
  );
  const editingProduct = useMemo(
    () => products.find((product) => product.id === editingProductId) ?? null,
    [editingProductId, products],
  );
  const onboardingSteps = useMemo(
    () => [
      {
        label: "Verify vendor email",
        done: vendorVerified,
        hint: vendorVerified ? "Done" : "Open your verification email to unlock the vendor account.",
      },
      {
        label: "Wait for admin approval",
        done: vendorActive,
        hint: vendorActive ? "Done" : "Your shop stays private until admin activates it.",
      },
      {
        label: "Activate subscription",
        done: vendorHasActiveSubscription,
        hint: vendorHasActiveSubscription
          ? "Done"
          : "Use Vendor Settings to activate a monthly or yearly listing plan.",
      },
      {
        label: "Add your first product",
        done: products.length > 0,
        hint: products.length > 0 ? "Done" : "Add at least one product so customers can browse your shop.",
      },
    ],
    [products.length, vendorActive, vendorHasActiveSubscription, vendorVerified],
  );
  const nextOnboardingStep = onboardingSteps.find((step) => !step.done) ?? null;
  const selectedFilePreviews = useMemo(() => {
    if (!files) {
      return [];
    }

    return Array.from(files).map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }));
  }, [files]);
  const availableFormCategories = useMemo(
    () => getCatalogCategoriesForDepartment(form.department),
    [form.department],
  );

  useEffect(() => {
    return () => {
      selectedFilePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [selectedFilePreviews]);

  useEffect(() => {
    if (form.category && !availableFormCategories.includes(form.category)) {
      setForm((current) => ({ ...current, category: "" }));
    }
  }, [availableFormCategories, form.category]);

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
    setActiveView("add-product");
    setForm({
      title: product.title,
      description: product.description,
      price: String(product.price),
      stock: String(product.stock),
      department: product.department,
      category: product.category,
      color: product.color ?? "",
      size: product.size ?? "",
    });
  }

  return (
    <RequireRole requiredRole="vendor">
      <div className="stack vendor-dashboard-page">
      <section className="panel hero-panel vendor-hero-panel">
        <div className="vendor-hero-main">
          <div className="stack" style={{ gap: "0.45rem" }}>
            <span className="chip">Vendor workspace</span>
            <h1 className="hero-title vendor-hero-title">{vendorShopName}</h1>
            <p className="hero-copy vendor-hero-copy">
              Verification status:{" "}
              <strong>{vendorVerified ? "Verified" : "Pending verification"}</strong>. Admin activation:{" "}
              <strong>{vendorActive ? "Active" : "Waiting for approval"}</strong>.
            </p>
          </div>
          <div className="vendor-hero-statuses">
            <span className={vendorVerified ? "badge" : "badge warn"}>
              {vendorVerified ? "Verified vendor" : "Pending verification"}
            </span>
            <span className={vendorActive ? "badge" : "badge warn"}>
              {vendorActive ? "Active account" : "Awaiting admin approval"}
            </span>
            <span className="chip">
              Low stock email alert at {lowStockThreshold === 0 ? "disabled" : `${lowStockThreshold} units`}
            </span>
          </div>
        </div>
        <div className="mini-stats vendor-hero-stats">
          <div className="mini-stat">
            <strong>{products.length}</strong>
            <span className="muted">Listed products</span>
          </div>
          <div className="mini-stat">
            <strong>{inventoryUnits}</strong>
            <span className="muted">Inventory units</span>
          </div>
          <div className="mini-stat">
            <strong>{pendingOrders}</strong>
            <span className="muted">Pending vendor orders</span>
          </div>
          <div className="mini-stat">
            <strong>{lowStockProducts.length}</strong>
            <span className="muted">Low stock alerts</span>
          </div>
          <div className="mini-stat">
            <strong>{formatCurrency(projectedRevenue)}</strong>
            <span className="muted">Tracked vendor earnings</span>
          </div>
          <div className="mini-stat">
            <strong>{totalSoldUnits}</strong>
            <span className="muted">Units sold</span>
          </div>
        </div>
      </section>

      {message && <div className="message success">{message}</div>}
      {error && <div className="message error">{error}</div>}
      {loading && <div className="message">Refreshing vendor data...</div>}

      <section className="form-card stack">
        <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 className="section-title">Onboarding Status</h2>
            <p className="muted">
              Track the exact steps needed before your shop is fully visible to customers.
            </p>
          </div>
          <span className={vendorIsPubliclyVisible ? "badge" : "badge warn"}>
            {vendorIsPubliclyVisible ? "Public shop live" : "Shop not public yet"}
          </span>
        </div>
        <div className="mini-stats">
          {onboardingSteps.map((step) => (
            <div key={step.label} className="mini-stat">
              <strong>{step.done ? "Done" : "Pending"}</strong>
              <span className="muted">{step.label}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <strong>
            {vendorIsPubliclyVisible
              ? "Customers can already browse your products."
              : `Next step: ${nextOnboardingStep?.label ?? "Review your setup"}`}
          </strong>
          <p className="muted">
            {vendorIsPubliclyVisible
              ? "Your vendor account, subscription, and catalog are all in a public-ready state."
              : nextOnboardingStep?.hint ?? "Keep working through the checklist until your shop is public."}
          </p>
          {!vendorHasActiveSubscription && (
            <div className="inline-actions">
              <a className="button-secondary" href="/vendor/settings">
                Open subscription settings
              </a>
            </div>
          )}
        </div>
      </section>

      {lowStockProducts.length > 0 && activeView !== "low-stock" && (
        <div className="message">
          {lowStockProducts.length} product{lowStockProducts.length === 1 ? "" : "s"} need stock attention.
          Use the <strong>Low stock</strong> panel to review them quickly.
        </div>
      )}

      <section className="form-card stack">
        <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 className="section-title">Vendor controls</h2>
            <p className="muted">Switch between adding products, reviewing catalog stock, and fulfillment work.</p>
          </div>
          <button className="button-ghost" type="button" onClick={() => void loadDashboard()}>
            Refresh
          </button>
        </div>
        <div className="vendor-view-switch">
          <button
            className={activeView === "products" ? "button" : "button-secondary"}
            type="button"
            onClick={() => setActiveView("products")}
          >
            Product list ({products.length})
          </button>
          <button
            className={activeView === "add-product" ? "button" : "button-secondary"}
            type="button"
            onClick={() => {
              resetProductForm();
              setActiveView("add-product");
            }}
          >
            Add product
          </button>
          <button
            className={activeView === "low-stock" ? "button" : "button-secondary"}
            type="button"
            onClick={() => {
              setStockFilter("low_stock");
              setActiveView("low-stock");
            }}
          >
            Low stock ({lowStockProducts.length})
          </button>
          <button
            className={activeView === "orders" ? "button" : "button-secondary"}
            type="button"
            onClick={() => setActiveView("orders")}
          >
            Orders ({orders.length})
          </button>
          <a className="button-ghost" href="/vendor/settings">
            Stock alert settings
          </a>
        </div>
      </section>

      {activeView === "add-product" && (
        <form className="form-card form-grid" onSubmit={submitProduct}>
          <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <h2 className="section-title">{editingProductId ? "Edit Product" : "Add Product"}</h2>
            <span className={editingProductId ? "badge warn" : "badge"}>
              {editingProductId ? "Editing existing item" : "Creating new item"}
            </span>
          </div>
          {!vendorCanManageCatalog && (
            <div className="message error">
              {vendorVerified
                ? "Admin approval is still required before you can save products."
                : "Verify your vendor email before you can save products."}
            </div>
          )}
          {vendorCanManageCatalog && !vendorHasActiveSubscription && (
            <div className="message">
              You can prepare products now, but they will stay hidden from the public shop until a subscription is active.
            </div>
          )}
          <div className="field">
            <label>Title</label>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea
              value={form.description}
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
                value={form.price}
                onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
              />
            </div>
            <div className="field">
              <label>Stock</label>
              <input
                type="number"
                value={form.stock}
                onChange={(event) => setForm((current) => ({ ...current, stock: event.target.value }))}
              />
            </div>
          </div>
          <div className="form-grid two">
            <div className="field">
              <label>{getCatalogGenderLabel()}</label>
              <select
                value={form.department}
                onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
              >
                {PRODUCT_DEPARTMENTS.map((entry) => (
                  <option key={entry} value={entry}>
                    {formatCatalogLabel(entry)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Category</label>
              <select
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              >
                <option value="">Select category</option>
                {availableFormCategories.map((entry) => (
                  <option key={entry} value={entry}>
                    {formatCatalogLabel(entry)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-grid two">
            <div className="field">
              <label>Color</label>
              <input
                list="vendor-product-colors"
                value={form.color}
                onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
                placeholder="black"
              />
            </div>
            <div className="field">
              <label>Size</label>
              <input
                list="vendor-product-sizes"
                value={form.size}
                onChange={(event) => setForm((current) => ({ ...current, size: event.target.value }))}
                placeholder="m"
              />
            </div>
          </div>
          <datalist id="vendor-product-colors">
            {PRODUCT_COLOR_OPTIONS.map((entry) => (
              <option key={entry} value={entry}>
                {formatProductAttributeLabel(entry)}
              </option>
            ))}
          </datalist>
          <datalist id="vendor-product-sizes">
            {PRODUCT_SIZE_OPTIONS.map((entry) => (
              <option key={entry} value={entry}>
                {formatProductAttributeLabel(entry)}
              </option>
            ))}
          </datalist>
          <div className="field">
            <label>Images</label>
            <input type="file" multiple accept="image/*" onChange={(event) => setFiles(event.target.files)} />
          </div>
          {editingProduct && !replaceImages && editingProduct.images.length > 0 && (
            <div className="stack">
              <div className="inline-actions" style={{ justifyContent: "space-between" }}>
                <strong>Current product images</strong>
                <span className="muted">Enable replace mode to swap them out.</span>
              </div>
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
          )}
          {selectedFilePreviews.length > 0 && (
            <div className="stack">
              <div className="inline-actions" style={{ justifyContent: "space-between" }}>
                <strong>Selected upload preview</strong>
                <span className="muted">{selectedFilePreviews.length} file(s) ready</span>
              </div>
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
          )}
          {editingProductId && (
            <label className="inline-actions">
              <input
                type="checkbox"
                checked={replaceImages}
                onChange={(event) => setReplaceImages(event.target.checked)}
              />
              Replace existing images
            </label>
          )}
          <div className="inline-actions">
            <button className="button" type="submit" disabled={!vendorCanManageCatalog}>
              {activeAction === (editingProductId ? `save-${editingProductId}` : "create-product")
                ? editingProductId
                  ? "Updating..."
                  : "Creating..."
                : editingProductId
                  ? "Update product"
                  : "Create product"}
            </button>
            {editingProductId && (
              <button
                className="button-ghost"
                type="button"
                disabled={activeAction !== null}
                onClick={resetProductForm}
              >
                Cancel edit
              </button>
            )}
            {!editingProductId && (form.title || form.description || files?.length) && (
              <button className="button-ghost" type="button" disabled={activeAction !== null} onClick={resetProductForm}>
                Clear form
              </button>
            )}
          </div>
        </form>
      )}

      {(activeView === "products" || activeView === "low-stock") && (
        <>
        <section className="form-card stack">
          <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 className="section-title">{activeView === "low-stock" ? "Product Search" : "Search Products"}</h2>
              <p className="muted">
                Filter your catalog first, then review the matching products in the separate list below.
              </p>
            </div>
            <div className="chip-row">
              <span className="chip">{filteredProducts.length} shown</span>
              <span className="chip">
                Alert threshold {lowStockThreshold === 0 ? "disabled" : lowStockThreshold}
              </span>
            </div>
          </div>
          <div className="vendor-product-toolbar">
            <div className="field">
              <label>Search products</label>
              <input
                placeholder="Title, code, gender, category, color, size"
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
              />
            </div>
            <div className="field">
              <label>Sort by</label>
              <select value={productSort} onChange={(event) => setProductSort(event.target.value)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="price-low">Price low to high</option>
                <option value="price-high">Price high to low</option>
                <option value="stock-low">Stock low to high</option>
                <option value="stock-high">Stock high to low</option>
                <option value="most-ordered">Most ordered</option>
                <option value="title">Title A-Z</option>
              </select>
            </div>
            <div className="field">
              <label>Stock filter</label>
              <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}>
                <option value="all">All stock states</option>
                <option value="in_stock">In stock</option>
                <option value="low_stock">Low stock</option>
                <option value="out_of_stock">Out of stock</option>
              </select>
            </div>
            <div className="field">
              <label>Listing filter</label>
              <select value={listingFilter} onChange={(event) => setListingFilter(event.target.value)}>
                <option value="all">Listed and hidden</option>
                <option value="listed">Listed only</option>
                <option value="hidden">Hidden only</option>
              </select>
            </div>
            <div className="field">
              <label>{getCatalogGenderLabel()}</label>
              <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
                <option value="all">All {getCatalogGenderLabel(true).toLowerCase()}</option>
                {vendorDepartments.map((entry) => (
                  <option key={entry} value={entry}>
                    {formatCatalogLabel(entry)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Category</label>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">All categories</option>
                {vendorCategories.map((entry) => (
                  <option key={entry} value={entry}>
                    {formatCatalogLabel(entry)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mini-stats">
            <div className="mini-stat">
              <strong>{filteredProducts.reduce((sum, product) => sum + product.stock, 0)}</strong>
              <span className="muted">Units in shown products</span>
            </div>
            <div className="mini-stat">
              <strong>{filteredProducts.reduce((sum, product) => sum + product.soldUnits, 0)}</strong>
              <span className="muted">Sold units in shown products</span>
            </div>
            <div className="mini-stat">
              <strong>{formatCurrency(filteredProducts.reduce((sum, product) => sum + product.revenue, 0))}</strong>
              <span className="muted">Shown vendor earnings</span>
            </div>
          </div>
        </section>

        <section className="form-card stack">
          <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 className="section-title">{activeView === "low-stock" ? "Low Stock Products" : "Your Products"}</h2>
              <p className="muted">
                Each row stays compact. Use the arrow to expand a product and see the full details.
              </p>
            </div>
            <div className="chip-row">
              <span className="chip">{filteredProducts.length} item{filteredProducts.length === 1 ? "" : "s"}</span>
            </div>
          </div>
          <div className="vendor-insight-grid">
            <div className="card vendor-insight-card">
              <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <strong>Best sellers</strong>
                <span className="chip">{bestSellers.length}</span>
              </div>
              {bestSellers.length === 0 ? (
                <p className="muted">Sales data will show here after customers start ordering.</p>
              ) : (
                <div className="stack" style={{ gap: "0.42rem" }}>
                  {bestSellers.map((product) => (
                    <div key={product.id} className="vendor-insight-row">
                      <div>
                        <strong>{product.title}</strong>
                        <p className="muted">
                          {product.productCode || "Code pending"} | {product.soldUnits} sold
                        </p>
                      </div>
                      <span className="chip">{formatCurrency(product.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card vendor-insight-card">
              <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <strong>Slow movers</strong>
                <span className="chip">{slowMovers.length}</span>
              </div>
              {slowMovers.length === 0 ? (
                <p className="muted">Your lowest-movement products will show here once the catalog grows.</p>
              ) : (
                <div className="stack" style={{ gap: "0.42rem" }}>
                  {slowMovers.map((product) => (
                    <div key={product.id} className="vendor-insight-row">
                      <div>
                        <strong>{product.title}</strong>
                        <p className="muted">
                          {[product.color, product.size]
                            .map((entry) => formatProductAttributeLabel(entry))
                            .filter(Boolean)
                            .concat(`${product.stock} in stock`)
                            .join(" | ")}
                        </p>
                      </div>
                      <span className="chip">{product.soldUnits} sold</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="card vendor-insight-card">
              <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <strong>Stock watch</strong>
                <span className="chip">{stockWatchProducts.length}</span>
              </div>
              {stockWatchProducts.length === 0 ? (
                <p className="muted">No products need stock attention right now.</p>
              ) : (
                <div className="stack" style={{ gap: "0.42rem" }}>
                  {stockWatchProducts.map((product) => (
                    <div key={product.id} className="vendor-insight-row">
                      <div>
                        <strong>{product.title}</strong>
                        <p className="muted">
                          {product.isOutOfStock ? "Out of stock" : `Low stock at ${product.stock} units`}
                        </p>
                      </div>
                      <span className={product.isOutOfStock ? "badge danger" : "badge warn"}>
                        {product.isOutOfStock ? "Restock now" : "Watch closely"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="card vendor-bulk-actions">
            <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>Bulk stock update</strong>
                <p className="muted">
                  Select products below, set one shared stock value, and update them together.
                </p>
              </div>
              <span className="chip">{selectedProductIds.length} selected</span>
            </div>
            <div className="inline-actions">
              <button
                className="button-secondary"
                type="button"
                onClick={() => setSelectedProductIds(filteredProducts.map((product) => product.id))}
                disabled={filteredProducts.length === 0}
              >
                Select shown
              </button>
              <button
                className="button-ghost"
                type="button"
                onClick={() => setSelectedProductIds([])}
                disabled={selectedProductIds.length === 0}
              >
                Clear selection
              </button>
            </div>
            <div className="inline-actions" style={{ alignItems: "end" }}>
              <div className="field" style={{ minWidth: "180px" }}>
                <label>New stock for selected</label>
                <input
                  type="number"
                  min="0"
                  value={bulkStockValue}
                  onChange={(event) => setBulkStockValue(event.target.value)}
                  placeholder="e.g. 12"
                />
              </div>
              <button
                className="button"
                type="button"
                disabled={selectedProductIds.length === 0 || bulkStockValue.trim().length === 0}
                onClick={() => void applyBulkStockUpdate()}
              >
                {activeAction === "bulk-stock" ? "Updating..." : "Apply stock update"}
              </button>
            </div>
          </div>
          {filteredProducts.length === 0 && (
            <div className="empty">
              {products.length === 0
                ? "No products yet. Add your first product to start building the shop."
                : "No matching products yet."}
            </div>
          )}
          {filteredProducts.map((product) => (
            <div key={product.id} className="card vendor-product-collapsible">
              <div className="vendor-product-summary-row">
                <div className="vendor-product-summary-main">
                  <label className="vendor-row-check">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.includes(product.id)}
                      onChange={(event) =>
                        setSelectedProductIds((current) =>
                          event.target.checked
                            ? [...current, product.id]
                            : current.filter((entry) => entry !== product.id),
                        )
                      }
                    />
                  </label>
                  <strong>{product.productCode || "Code pending"}</strong>
                  <span className="muted">{product.title}</span>
                  <span className="muted">{product.isListed ? "Listed" : "Hidden"}</span>
                  <span className="muted">Stock {product.stock}</span>
                  <span className="muted">{formatCurrency(product.price)}</span>
                  <span className="muted">Sold {product.soldUnits}</span>
                </div>
                <div className="vendor-product-summary-end">
                  {!product.isListed ? (
                    <span className="badge warn">Hidden</span>
                  ) : product.isOutOfStock ? (
                    <span className="badge danger">Out of stock</span>
                  ) : product.isLowStock ? (
                    <span className="badge warn">Low stock</span>
                  ) : (
                    <span className="badge">Healthy stock</span>
                  )}
                  <button
                    className="button-ghost vendor-expand-toggle"
                    type="button"
                    onClick={() =>
                      setExpandedProductId((current) => (current === product.id ? null : product.id))
                    }
                  >
                    {expandedProductId === product.id ? "▾" : "▸"}
                  </button>
                </div>
              </div>
              {expandedProductId === product.id && (
                <div className="vendor-product-expanded">
                  <div className="vendor-product-preview">
                    <ProductMedia
                      image={assetUrl(product.images[0])}
                      title={product.title}
                      subtitle={`${formatCatalogLabel(product.department)} ${formatCatalogLabel(product.category)}`}
                      className="card-image"
                    />
                  </div>
                  <div className="vendor-product-content">
                    <div className="stack" style={{ gap: "0.2rem" }}>
                      <strong>{product.title}</strong>
                      <p className="muted">
                        {formatCatalogLabel(product.department)} | {formatCatalogLabel(product.category)}
                        {product.color ? ` | ${formatProductAttributeLabel(product.color)}` : ""}
                        {product.size ? ` | ${formatProductAttributeLabel(product.size)}` : ""}
                      </p>
                    </div>
                    <div className="vendor-product-metrics">
                      <span>{product.isListed ? "Public listing active" : "Hidden from customers"}</span>
                      <span>Price {formatCurrency(product.price)}</span>
                      <span>Stock {product.stock}</span>
                      <span>Sold {product.soldUnits}</span>
                      <span>Orders {product.orderCount}</span>
                      <span>Earnings {formatCurrency(product.revenue)}</span>
                    </div>
                  </div>
                  <div className="vendor-product-actions">
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={activeAction !== null}
                      onClick={() => startEditProduct(product)}
                    >
                      Edit
                    </button>
                    <button
                      className="button-ghost"
                      type="button"
                      disabled={activeAction !== null}
                      onClick={() => duplicateProduct(product.id)}
                    >
                      {activeAction === `duplicate-${product.id}` ? "Duplicating..." : "Duplicate"}
                    </button>
                    <button
                      className="button-ghost"
                      type="button"
                      disabled={activeAction !== null}
                      onClick={() => toggleProductListing(product.id, !product.isListed)}
                    >
                      {activeAction === `listing-${product.id}`
                        ? "Saving..."
                        : product.isListed
                          ? "Hide"
                          : "Show"}
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      disabled={activeAction !== null}
                      onClick={() => deleteProduct(product.id)}
                    >
                      {activeAction === `delete-${product.id}` ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </section>
        </>
      )}

      {activeView === "orders" && (
        <section className="form-card stack">
        <h2 className="section-title">Vendor Orders</h2>
        <div className="field">
          <label>Order status</label>
          <select value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
        {filteredOrders.length === 0 && (
          <div className="empty">
            {vendorIsPubliclyVisible
              ? "No orders for this filter yet."
              : "Orders will start showing here once your shop is public and customers begin buying."}
          </div>
        )}
        {filteredOrders.map((order) => (
          <div key={order.id} className="card">
            <div className="inline-actions" style={{ justifyContent: "space-between" }}>
              <div>
                <strong>{order.customerEmail}</strong>
                <p className="muted">{new Date(order.createdAt).toLocaleString()}</p>
                <p className="muted">
                  {order.paymentMethod === "cash_on_delivery" ? "Cash on delivery" : "Paid online"} |{" "}
                  {order.paymentStatus === "cod_pending"
                    ? "Collect on arrival"
                    : order.paymentStatus === "cod_collected"
                      ? "Cash collected"
                      : order.paymentStatus === "cod_refused"
                        ? "Delivery refused"
                        : "Already paid"}
                </p>
                {order.cancelRequest?.status === "requested" && (
                  <p className="muted">
                    Customer cancel requested
                    {order.cancelRequest.requestedAt
                      ? ` | ${new Date(order.cancelRequest.requestedAt).toLocaleString()}`
                      : ""}
                    {order.cancelRequest.note ? ` | ${order.cancelRequest.note}` : ""}
                  </p>
                )}
              </div>
              <div className="chip-row">
                <StatusBadge status={order.status} />
                <span className="chip">{formatCurrency(order.totalPrice)}</span>
                {order.cancelRequest?.status === "requested" && (
                  <span className="badge warn">Cancel requested</span>
                )}
              </div>
            </div>
            {order.items.map((item) => (
              <div key={item.id} className="order-line">
                <div>
                  <strong>{item.product.title}</strong>
                  <p className="muted">
                    {item.product.productCode ? `${item.product.productCode} | ` : ""}
                    {item.quantity} x {formatCurrency(item.unitPrice)} | earnings{" "}
                    {formatCurrency(item.vendorEarnings)}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
            <div className="order-summary-grid">
              <div className="mini-stat">
                <strong>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</strong>
                <span className="muted">Units in this order</span>
              </div>
              <div className="mini-stat">
                <strong>
                  {formatCurrency(order.items.reduce((sum, item) => sum + item.commission, 0))}
                </strong>
                <span className="muted">Commission on your items</span>
              </div>
              <div className="mini-stat">
                <strong>
                  {formatCurrency(order.items.reduce((sum, item) => sum + item.vendorEarnings, 0))}
                </strong>
                <span className="muted">Net vendor earnings</span>
              </div>
            </div>
            {order.status === "confirmed" && (
              <div className="form-grid two">
                <div className="field">
                  <label>Carrier</label>
                  <input
                    placeholder="DHL, UPS, local courier"
                    value={shippingCarrier}
                    onChange={(event) => setShippingCarrier(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Tracking number</label>
                  <input
                    placeholder="Required before shipping"
                    value={trackingNumber}
                    onChange={(event) => setTrackingNumber(event.target.value)}
                  />
                </div>
              </div>
            )}
            {order.items.some((item) => item.shipment?.trackingNumber) && (
              <div className="card">
                <strong>Shipment</strong>
                <p className="muted">
                  {order.items[0].shipment?.shippingCarrier || "Carrier pending"}
                  {" | "}
                  {order.items[0].shipment?.trackingNumber}
                </p>
                {order.items[0].shipment?.shippedAt && (
                  <p className="muted">
                    Shipped {new Date(order.items[0].shipment!.shippedAt!).toLocaleString()}
                  </p>
                )}
              </div>
            )}
            <div className="inline-actions">
              {getNextVendorActions(order.status).length === 0 && (
                <span className="muted">This order is fully delivered.</span>
              )}
              {getNextVendorActions(order.status).map((action) => (
                <button
                  key={action.value}
                  className={action.tone}
                  type="button"
                  disabled={
                    activeAction !== null ||
                    (action.value === "shipped" && trackingNumber.trim().length === 0)
                  }
                  onClick={() => updateOrderStatus(order.id, action.value)}
                >
                  {activeAction === `order-${order.id}-${action.value}` ? "Saving..." : action.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        </section>
      )}
      </div>
    </RequireRole>
  );
}
