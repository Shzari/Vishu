"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RequireRole } from "@/components/require-role";
import { useAuth } from "@/components/providers";
import { apiRequest } from "@/lib/api";
import type {
  AdminCatalogRequest,
  AdminCatalogStructure,
} from "@/lib/types";

type CatalogSection =
  | "categories"
  | "subcategories"
  | "brands"
  | "colors"
  | "sizes"
  | "gender-groups"
  | "requests";

const SECTIONS: Array<{ id: CatalogSection; label: string }> = [
  { id: "categories", label: "Categories" },
  { id: "subcategories", label: "Subcategories" },
  { id: "brands", label: "Brands" },
  { id: "colors", label: "Colors" },
  { id: "sizes", label: "Sizes" },
  { id: "gender-groups", label: "Gender Groups" },
  { id: "requests", label: "Requests" },
];

type SimpleForm = { name: string; isActive: boolean; sortOrder: string };
type SubcategoryForm = {
  categoryId: string;
  name: string;
  isActive: boolean;
  sortOrder: string;
};
type SizeForm = {
  sizeTypeId: string;
  label: string;
  isActive: boolean;
  sortOrder: string;
};

const emptySimpleForm: SimpleForm = { name: "", isActive: true, sortOrder: "0" };
const emptySubcategoryForm: SubcategoryForm = {
  categoryId: "",
  name: "",
  isActive: true,
  sortOrder: "0",
};
const emptySizeForm: SizeForm = {
  sizeTypeId: "",
  label: "",
  isActive: true,
  sortOrder: "0",
};

function isCatalogSection(value: string | null): value is CatalogSection {
  return SECTIONS.some((section) => section.id === value);
}

function AdminCatalogPageInner() {
  const { token, currentRole } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeSection, setActiveSection] = useState<CatalogSection>("categories");
  const [structure, setStructure] = useState<AdminCatalogStructure | null>(null);
  const [requests, setRequests] = useState<AdminCatalogRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [simpleForm, setSimpleForm] = useState<SimpleForm>(emptySimpleForm);
  const [subcategoryForm, setSubcategoryForm] =
    useState<SubcategoryForm>(emptySubcategoryForm);
  const [sizeTypeForm, setSizeTypeForm] = useState<SimpleForm>(emptySimpleForm);
  const [sizeForm, setSizeForm] = useState<SizeForm>(emptySizeForm);

  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  useEffect(() => {
    const requestedSection = searchParams.get("section");
    if (isCatalogSection(requestedSection) && requestedSection !== activeSection) {
      setActiveSection(requestedSection);
      setEditingId(null);
      setSimpleForm(emptySimpleForm);
      setSubcategoryForm(emptySubcategoryForm);
      setSizeTypeForm(emptySimpleForm);
      setSizeForm(emptySizeForm);
    }
  }, [activeSection, searchParams]);

  useEffect(() => {
    if (!token || currentRole !== "admin") return;
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [structureResponse, requestResponse] = await Promise.all([
          apiRequest<AdminCatalogStructure>("/admin/catalog-structure", {}, token),
          apiRequest<AdminCatalogRequest[]>("/admin/catalog-requests?status=all", {}, token),
        ]);
        if (!active) return;
        setStructure(structureResponse);
        setRequests(requestResponse);
      } catch (loadError) {
        if (!active) return;
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load catalog tools.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [currentRole, token]);

  const filteredRequests = useMemo(
    () =>
      requests.filter((request) => {
        if (typeFilter !== "all" && request.requestType !== typeFilter) return false;
        if (statusFilter !== "all" && request.status !== statusFilter) return false;
        return true;
      }),
    [requests, statusFilter, typeFilter],
  );

  const categories = structure?.categories ?? [];
  const subcategories = structure?.subcategories ?? [];
  const brands = structure?.brands ?? [];
  const colors = structure?.colors ?? [];
  const sizeTypes = structure?.sizeTypes ?? [];
  const sizes = structure?.sizes ?? [];
  const genderGroups = structure?.genderGroups ?? [];

  function openSection(section: CatalogSection) {
    setActiveSection(section);
    setEditingId(null);
    setSimpleForm(emptySimpleForm);
    setSubcategoryForm(emptySubcategoryForm);
    setSizeTypeForm(emptySimpleForm);
    setSizeForm(emptySizeForm);
    router.replace(`/admin/catalog?section=${section}`, { scroll: false });
  }

  async function saveStructure(
    path: string,
    body: Record<string, unknown>,
    method: "POST" | "PATCH" | "DELETE" = "POST",
  ) {
    if (!token) return;

    try {
      setActiveAction(path);
      setMessage(null);
      setError(null);
      const next = await apiRequest<AdminCatalogStructure>(
        path,
        method === "DELETE" ? { method } : { method, body: JSON.stringify(body) },
        token,
      );
      setStructure(next);
      setMessage("Catalog structure updated.");
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Catalog update failed.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function reviewRequest(requestId: string, status: "approved" | "rejected") {
    if (!token) return;

    try {
      setActiveAction(`${requestId}-${status}`);
      setMessage(null);
      setError(null);
      const next = await apiRequest<AdminCatalogRequest[]>(
        `/admin/catalog-requests/${requestId}/review`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status,
            adminNote: noteById[requestId]?.trim() || undefined,
          }),
        },
        token,
      );
      setRequests(next);
      setMessage(status === "approved" ? "Request approved." : "Request rejected.");
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Failed to review request.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <RequireRole requiredRole="admin">
      <div className="admin-page-shell">
        <section className="admin-page-head">
          <div className="admin-page-copy">
            <span className="admin-page-eyebrow">Marketplace structure</span>
            <h1 className="admin-page-title">Catalog</h1>
            <p className="admin-page-description">
              Manage the catalog structure in one dedicated place, separate from
              payments, email, and admin access settings.
            </p>
          </div>
        </section>

        {message ? <div className="message success">{message}</div> : null}
        {error ? <div className="message error">{error}</div> : null}
        {loading ? <div className="message">Loading catalog tools...</div> : null}

        <div className="admin-structure-layout">
          <aside className="form-card stack admin-settings-sidebar">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                className={
                  activeSection === section.id
                    ? "button admin-settings-nav active"
                    : "button-ghost admin-settings-nav"
                }
                onClick={() => openSection(section.id)}
              >
                {section.label}
              </button>
            ))}
          </aside>

          <div className="stack" style={{ flex: 1 }}>
            {activeSection === "categories" ? (
              <>
                <section className="form-card stack">
                  <h2 className="section-title">
                    {editingId ? "Edit category" : "Add category"}
                  </h2>
                  <div className="form-grid two">
                    <div className="field">
                      <label>Name</label>
                      <input
                        value={simpleForm.name}
                        onChange={(event) =>
                          setSimpleForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label>Sort order</label>
                      <input
                        type="number"
                        value={simpleForm.sortOrder}
                        onChange={(event) =>
                          setSimpleForm((current) => ({
                            ...current,
                            sortOrder: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <label className="vendor-row-check">
                    <input
                      type="checkbox"
                      checked={simpleForm.isActive}
                      onChange={(event) =>
                        setSimpleForm((current) => ({
                          ...current,
                          isActive: event.target.checked,
                        }))
                      }
                    />
                    <span>Active</span>
                  </label>
                  <div className="inline-actions">
                    <button
                      className="button"
                      type="button"
                      disabled={
                        activeAction !== null || simpleForm.name.trim().length === 0
                      }
                      onClick={() =>
                        void saveStructure(
                          editingId
                            ? `/admin/catalog/categories/${editingId}`
                            : "/admin/catalog/categories",
                          {
                            name: simpleForm.name,
                            isActive: simpleForm.isActive,
                            sortOrder: Number(simpleForm.sortOrder || 0),
                          },
                          editingId ? "PATCH" : "POST",
                        ).then(() => {
                          setEditingId(null);
                          setSimpleForm(emptySimpleForm);
                        })
                      }
                    >
                      {editingId ? "Save category" : "Add category"}
                    </button>
                  </div>
                </section>

                <section className="form-card stack">
                  <div className="table-wrap">
                    <table className="admin-simple-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Status</th>
                          <th>Sort</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.map((item) => (
                          <tr key={item.id}>
                            <td>{item.name}</td>
                            <td>{item.isActive ? "Active" : "Inactive"}</td>
                            <td>{item.sortOrder}</td>
                            <td>
                              <div className="inline-actions">
                                <button
                                  className="button-ghost"
                                  type="button"
                                  onClick={() => {
                                    setEditingId(item.id);
                                    setSimpleForm({
                                      name: item.name,
                                      isActive: item.isActive,
                                      sortOrder: String(item.sortOrder),
                                    });
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  className="button-ghost"
                                  type="button"
                                  onClick={() =>
                                    void saveStructure(
                                      `/admin/catalog/categories/${item.id}`,
                                      {},
                                      "DELETE",
                                    )
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : null}

            {activeSection === "subcategories" ? (
              <>
                <section className="form-card stack">
                  <h2 className="section-title">
                    {editingId ? "Edit subcategory" : "Add subcategory"}
                  </h2>
                  <div className="form-grid two">
                    <div className="field">
                      <label>Category</label>
                      <select
                        value={subcategoryForm.categoryId}
                        onChange={(event) =>
                          setSubcategoryForm((current) => ({
                            ...current,
                            categoryId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select category</option>
                        {categories.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Name</label>
                      <input
                        value={subcategoryForm.name}
                        onChange={(event) =>
                          setSubcategoryForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="form-grid two">
                    <div className="field">
                      <label>Sort order</label>
                      <input
                        type="number"
                        value={subcategoryForm.sortOrder}
                        onChange={(event) =>
                          setSubcategoryForm((current) => ({
                            ...current,
                            sortOrder: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <label className="vendor-row-check">
                      <input
                        type="checkbox"
                        checked={subcategoryForm.isActive}
                        onChange={(event) =>
                          setSubcategoryForm((current) => ({
                            ...current,
                            isActive: event.target.checked,
                          }))
                        }
                      />
                      <span>Active</span>
                    </label>
                  </div>
                  <div className="inline-actions">
                    <button
                      className="button"
                      type="button"
                      disabled={
                        activeAction !== null ||
                        subcategoryForm.categoryId.length === 0 ||
                        subcategoryForm.name.trim().length === 0
                      }
                      onClick={() =>
                        void saveStructure(
                          editingId
                            ? `/admin/catalog/subcategories/${editingId}`
                            : "/admin/catalog/subcategories",
                          {
                            categoryId: subcategoryForm.categoryId,
                            name: subcategoryForm.name,
                            isActive: subcategoryForm.isActive,
                            sortOrder: Number(subcategoryForm.sortOrder || 0),
                          },
                          editingId ? "PATCH" : "POST",
                        ).then(() => {
                          setEditingId(null);
                          setSubcategoryForm(emptySubcategoryForm);
                        })
                      }
                    >
                      {editingId ? "Save subcategory" : "Add subcategory"}
                    </button>
                  </div>
                </section>

                <section className="form-card stack">
                  <div className="table-wrap">
                    <table className="admin-simple-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Category</th>
                          <th>Status</th>
                          <th>Sort</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subcategories.map((item) => (
                          <tr key={item.id}>
                            <td>{item.name}</td>
                            <td>{item.categoryName}</td>
                            <td>{item.isActive ? "Active" : "Inactive"}</td>
                            <td>{item.sortOrder}</td>
                            <td>
                              <div className="inline-actions">
                                <button
                                  className="button-ghost"
                                  type="button"
                                  onClick={() => {
                                    setEditingId(item.id);
                                    setSubcategoryForm({
                                      categoryId: item.categoryId,
                                      name: item.name,
                                      isActive: item.isActive,
                                      sortOrder: String(item.sortOrder),
                                    });
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  className="button-ghost"
                                  type="button"
                                  onClick={() =>
                                    void saveStructure(
                                      `/admin/catalog/subcategories/${item.id}`,
                                      {},
                                      "DELETE",
                                    )
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : null}

            {activeSection === "brands" || activeSection === "colors" ? (
              <section className="form-card stack">
                <h2 className="section-title">
                  {activeSection === "brands" ? "Brands" : "Colors"}
                </h2>
                <div className="form-grid two">
                  <div className="field">
                    <label>Name</label>
                    <input
                      value={simpleForm.name}
                      onChange={(event) =>
                        setSimpleForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Sort order</label>
                    <input
                      type="number"
                      value={simpleForm.sortOrder}
                      onChange={(event) =>
                        setSimpleForm((current) => ({
                          ...current,
                          sortOrder: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <label className="vendor-row-check">
                  <input
                    type="checkbox"
                    checked={simpleForm.isActive}
                    onChange={(event) =>
                      setSimpleForm((current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))
                    }
                  />
                  <span>Active</span>
                </label>
                <div className="inline-actions">
                  <button
                    className="button"
                    type="button"
                    disabled={
                      activeAction !== null || simpleForm.name.trim().length === 0
                    }
                    onClick={() => {
                      const base =
                        activeSection === "brands"
                          ? "/admin/catalog/brands"
                          : "/admin/catalog/colors";
                      void saveStructure(
                        editingId ? `${base}/${editingId}` : base,
                        {
                          name: simpleForm.name,
                          isActive: simpleForm.isActive,
                          sortOrder: Number(simpleForm.sortOrder || 0),
                        },
                        editingId ? "PATCH" : "POST",
                      ).then(() => {
                        setEditingId(null);
                        setSimpleForm(emptySimpleForm);
                      });
                    }}
                  >
                    {editingId ? "Save" : "Add"}
                  </button>
                </div>
                <div className="table-wrap">
                  <table className="admin-simple-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(activeSection === "brands" ? brands : colors).map((item) => (
                        <tr key={item.id}>
                          <td>{item.name}</td>
                          <td>{item.isActive ? "Active" : "Inactive"}</td>
                          <td>
                            <div className="inline-actions">
                              <button
                                className="button-ghost"
                                type="button"
                                onClick={() => {
                                  setEditingId(item.id);
                                  setSimpleForm({
                                    name: item.name,
                                    isActive: item.isActive,
                                    sortOrder: String(item.sortOrder),
                                  });
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="button-ghost"
                                type="button"
                                onClick={() => {
                                  const base =
                                    activeSection === "brands"
                                      ? "/admin/catalog/brands"
                                      : "/admin/catalog/colors";
                                  void saveStructure(`${base}/${item.id}`, {}, "DELETE");
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
            {activeSection === "sizes" ? (
              <>
                <section className="form-card stack">
                  <h2 className="section-title">Size types</h2>
                  <div className="form-grid two">
                    <div className="field">
                      <label>Name</label>
                      <input
                        value={sizeTypeForm.name}
                        onChange={(event) =>
                          setSizeTypeForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label>Sort order</label>
                      <input
                        type="number"
                        value={sizeTypeForm.sortOrder}
                        onChange={(event) =>
                          setSizeTypeForm((current) => ({
                            ...current,
                            sortOrder: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <label className="vendor-row-check">
                    <input
                      type="checkbox"
                      checked={sizeTypeForm.isActive}
                      onChange={(event) =>
                        setSizeTypeForm((current) => ({
                          ...current,
                          isActive: event.target.checked,
                        }))
                      }
                    />
                    <span>Active</span>
                  </label>
                  <div className="inline-actions">
                    <button
                      className="button"
                      type="button"
                      disabled={
                        activeAction !== null || sizeTypeForm.name.trim().length === 0
                      }
                      onClick={() =>
                        void saveStructure(
                          "/admin/catalog/size-types",
                          {
                            name: sizeTypeForm.name,
                            isActive: sizeTypeForm.isActive,
                            sortOrder: Number(sizeTypeForm.sortOrder || 0),
                          },
                          "POST",
                        ).then(() => setSizeTypeForm(emptySimpleForm))
                      }
                    >
                      Add size type
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table className="admin-simple-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Status</th>
                          <th>Sort</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sizeTypes.map((item) => (
                          <tr key={item.id}>
                            <td>{item.name}</td>
                            <td>{item.isActive ? "Active" : "Inactive"}</td>
                            <td>{item.sortOrder}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="form-card stack">
                  <h2 className="section-title">Sizes</h2>
                  <div className="form-grid two">
                    <div className="field">
                      <label>Size type</label>
                      <select
                        value={sizeForm.sizeTypeId}
                        onChange={(event) =>
                          setSizeForm((current) => ({
                            ...current,
                            sizeTypeId: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select size type</option>
                        {sizeTypes.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Label</label>
                      <input
                        value={sizeForm.label}
                        onChange={(event) =>
                          setSizeForm((current) => ({
                            ...current,
                            label: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="form-grid two">
                    <div className="field">
                      <label>Sort order</label>
                      <input
                        type="number"
                        value={sizeForm.sortOrder}
                        onChange={(event) =>
                          setSizeForm((current) => ({
                            ...current,
                            sortOrder: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <label className="vendor-row-check">
                      <input
                        type="checkbox"
                        checked={sizeForm.isActive}
                        onChange={(event) =>
                          setSizeForm((current) => ({
                            ...current,
                            isActive: event.target.checked,
                          }))
                        }
                      />
                      <span>Active</span>
                    </label>
                  </div>
                  <div className="inline-actions">
                    <button
                      className="button"
                      type="button"
                      disabled={
                        activeAction !== null ||
                        sizeForm.sizeTypeId.length === 0 ||
                        sizeForm.label.trim().length === 0
                      }
                      onClick={() =>
                        void saveStructure(
                          editingId
                            ? `/admin/catalog/sizes/${editingId}`
                            : "/admin/catalog/sizes",
                          {
                            sizeTypeId: sizeForm.sizeTypeId,
                            label: sizeForm.label,
                            isActive: sizeForm.isActive,
                            sortOrder: Number(sizeForm.sortOrder || 0),
                          },
                          editingId ? "PATCH" : "POST",
                        ).then(() => {
                          setEditingId(null);
                          setSizeForm(emptySizeForm);
                        })
                      }
                    >
                      {editingId ? "Save size" : "Add size"}
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table className="admin-simple-table">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Size</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sizes.map((item) => (
                          <tr key={item.id}>
                            <td>{item.sizeTypeName}</td>
                            <td>{item.label}</td>
                            <td>{item.isActive ? "Active" : "Inactive"}</td>
                            <td>
                              <div className="inline-actions">
                                <button
                                  className="button-ghost"
                                  type="button"
                                  onClick={() => {
                                    setEditingId(item.id);
                                    setSizeForm({
                                      sizeTypeId: item.sizeTypeId,
                                      label: item.label,
                                      isActive: item.isActive,
                                      sortOrder: String(item.sortOrder),
                                    });
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  className="button-ghost"
                                  type="button"
                                  onClick={() =>
                                    void saveStructure(
                                      `/admin/catalog/sizes/${item.id}`,
                                      {},
                                      "DELETE",
                                    )
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : null}
            {activeSection === "gender-groups" ? (
              <section className="form-card stack">
                <h2 className="section-title">Gender groups</h2>
                <div className="form-grid two">
                  <div className="field">
                    <label>Name</label>
                    <input
                      value={simpleForm.name}
                      onChange={(event) =>
                        setSimpleForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Sort order</label>
                    <input
                      type="number"
                      value={simpleForm.sortOrder}
                      onChange={(event) =>
                        setSimpleForm((current) => ({
                          ...current,
                          sortOrder: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <label className="vendor-row-check">
                  <input
                    type="checkbox"
                    checked={simpleForm.isActive}
                    onChange={(event) =>
                      setSimpleForm((current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))
                    }
                  />
                  <span>Active</span>
                </label>
                <div className="inline-actions">
                  <button
                    className="button"
                    type="button"
                    disabled={
                      activeAction !== null || simpleForm.name.trim().length === 0
                    }
                    onClick={() =>
                      void saveStructure(
                        editingId
                          ? `/admin/catalog/gender-groups/${editingId}`
                          : "/admin/catalog/gender-groups",
                        {
                          name: simpleForm.name,
                          isActive: simpleForm.isActive,
                          sortOrder: Number(simpleForm.sortOrder || 0),
                        },
                        editingId ? "PATCH" : "POST",
                      ).then(() => {
                        setEditingId(null);
                        setSimpleForm(emptySimpleForm);
                      })
                    }
                  >
                    {editingId ? "Save group" : "Add group"}
                  </button>
                </div>
                <div className="table-wrap">
                  <table className="admin-simple-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Sort</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {genderGroups.map((item) => (
                        <tr key={item.id}>
                          <td>{item.name}</td>
                          <td>{item.isActive ? "Active" : "Inactive"}</td>
                          <td>{item.sortOrder}</td>
                          <td>
                            <div className="inline-actions">
                              <button
                                className="button-ghost"
                                type="button"
                                onClick={() => {
                                  setEditingId(item.id);
                                  setSimpleForm({
                                    name: item.name,
                                    isActive: item.isActive,
                                    sortOrder: String(item.sortOrder),
                                  });
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="button-ghost"
                                type="button"
                                onClick={() =>
                                  void saveStructure(
                                    `/admin/catalog/gender-groups/${item.id}`,
                                    {},
                                    "DELETE",
                                  )
                                }
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
            {activeSection === "requests" ? (
              <section className="form-card stack">
                <div className="admin-filter-toolbar">
                  <div className="field">
                    <label>Type</label>
                    <select
                      value={typeFilter}
                      onChange={(event) => setTypeFilter(event.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="category">Category</option>
                      <option value="subcategory">Subcategory</option>
                      <option value="brand">Brand</option>
                      <option value="size">Size</option>
                      <option value="color">Color</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Status</label>
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="admin-simple-table">
                    <thead>
                      <tr>
                        <th>Request</th>
                        <th>Vendor</th>
                        <th>Status</th>
                        <th>Review</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.map((request) => (
                        <tr key={request.id}>
                          <td>
                            <div className="admin-table-stack">
                              <strong>{request.requestedValue}</strong>
                              <span className="muted">
                                {request.requestType}
                                {request.categoryName ? ` · ${request.categoryName}` : ""}
                                {request.subcategoryName
                                  ? ` · ${request.subcategoryName}`
                                  : ""}
                                {request.sizeTypeName ? ` · ${request.sizeTypeName}` : ""}
                              </span>
                            </div>
                          </td>
                          <td>{request.vendor.shopName}</td>
                          <td>{request.status}</td>
                          <td>
                            {request.status === "pending" ? (
                              <div className="stack">
                                <textarea
                                  className="input admin-request-note"
                                  rows={3}
                                  value={noteById[request.id] ?? ""}
                                  onChange={(event) =>
                                    setNoteById((current) => ({
                                      ...current,
                                      [request.id]: event.target.value,
                                    }))
                                  }
                                />
                                <div className="inline-actions">
                                  <button
                                    className="button"
                                    type="button"
                                    disabled={activeAction === `${request.id}-approved`}
                                    onClick={() =>
                                      void reviewRequest(request.id, "approved")
                                    }
                                  >
                                    Approve
                                  </button>
                                  <button
                                    className="button-ghost"
                                    type="button"
                                    disabled={activeAction === `${request.id}-rejected`}
                                    onClick={() =>
                                      void reviewRequest(request.id, "rejected")
                                    }
                                  >
                                    Reject
                                  </button>
                                </div>
                              </div>
                            ) : (
                              request.adminNote ?? "Reviewed"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </RequireRole>
  );
}


export default function AdminCatalogPage() {
  return (
    <Suspense fallback={<div className="message">Loading...</div>}>
      <AdminCatalogPageInner />
    </Suspense>
  );
}
