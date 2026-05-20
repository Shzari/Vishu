"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { useAuth, useLanguage } from "@/components/providers";
import { RequireRole } from "@/components/require-role";
import { VendorWorkspaceShell } from "@/components/vendor-workspace-shell";
import { apiRequest } from "@/lib/api";
import type { Product, VendorCatalogOptions } from "@/lib/types";

const MAX_PRODUCT_PHOTOS = 6;
const MAX_PRODUCT_PHOTO_SIZE = 30 * 1024 * 1024;
const ACCEPTED_IMAGE_EXTENSIONS = [
  ".avif",
  ".jpg",
  ".jpeg",
  ".jfif",
  ".png",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
];

type SelectedProductPhoto = {
  id: string;
  file: File;
  previewUrl: string;
};

type ProductCreateResponse = {
  message: string;
  product: Product;
};

function formatVendorSizeTypeLabel(name: string) {
  const normalized = name.trim().toLowerCase();
  if (normalized === "babies" || normalized === "baby") return "Bebe";
  if (normalized === "kids") return "Fëmijë";
  if (normalized === "eu") return "Të rritur";
  if (normalized === "shoe eu") return "Shoes";
  return name;
}

function isVisibleVendorSizeType(name?: string | null) {
  const normalized = name?.trim().toLowerCase() ?? "";
  return normalized !== "clothing" && normalized !== "apparel";
}

export function VendorProductCreatePage() {
  const router = useRouter();
  const { token, loading } = useAuth();
  const { language } = useLanguage();
  const [catalogOptions, setCatalogOptions] = useState<VendorCatalogOptions | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [genderGroupId, setGenderGroupId] = useState("");
  const [selectedColorIds, setSelectedColorIds] = useState<string[]>([]);
  const [selectedSizeTypeId, setSelectedSizeTypeId] = useState("");
  const [sizeStocks, setSizeStocks] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<SelectedProductPhoto[]>([]);
  const [primaryPhotoIndex, setPrimaryPhotoIndex] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoPickerMessage, setPhotoPickerMessage] = useState("No photo selected yet.");
  const [submitting, setSubmitting] = useState(false);
  const photoInputId = useId();
  const photosRef = useRef<SelectedProductPhoto[]>([]);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const photoPickerOpenRef = useRef(false);
  const lastPhotoSelectionKeyRef = useRef("");

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, []);

  const addPhotoFiles = useCallback((fileList: FileList | File[] | null, options?: { silentEmpty?: boolean }) => {
    const selectedFiles = Array.from(fileList ?? []);
    setError(null);

    if (!selectedFiles.length) {
      if (!options?.silentEmpty) {
        setPhotoPickerMessage("The browser did not send any file from the picker.");
        setStatus("No file was selected from the folder.");
      }
      return;
    }

    setPhotoPickerMessage(
      `Browser detected ${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"}: ${selectedFiles
        .map((file) => file.name)
        .join(", ")}`,
    );

    const currentPhotos = photosRef.current;
    const existingKeys = new Set(currentPhotos.map((photo) => getFileKey(photo.file)));
    const nextPhotos = [...currentPhotos];
    const rejected: string[] = [];
    const duplicates: string[] = [];

    for (const file of selectedFiles) {
      if (nextPhotos.length >= MAX_PRODUCT_PHOTOS) {
        rejected.push(`${file.name} exceeds the ${MAX_PRODUCT_PHOTOS} photo limit`);
        continue;
      }

      if (existingKeys.has(getFileKey(file))) {
        duplicates.push(file.name);
        continue;
      }

      if (!isAcceptedImageFile(file)) {
        rejected.push(`${file.name} is not a supported image`);
        continue;
      }

      if (file.size > MAX_PRODUCT_PHOTO_SIZE) {
        rejected.push(`${file.name} is larger than 30 MB`);
        continue;
      }

      existingKeys.add(getFileKey(file));
      nextPhotos.push({
        id: `${Date.now()}-${nextPhotos.length}-${file.name}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    photosRef.current = nextPhotos;
    setPhotos(nextPhotos);
    setPrimaryPhotoIndex((current) =>
      nextPhotos.length ? Math.min(current, nextPhotos.length - 1) : 0,
    );

    const addedCount = nextPhotos.length - currentPhotos.length;
    const messages = [];
    if (addedCount > 0) {
      messages.push(`Selected ${nextPhotos.length} photo${nextPhotos.length === 1 ? "" : "s"}.`);
    }
    if (duplicates.length) {
      messages.push(`Skipped duplicate: ${duplicates.join(", ")}.`);
    }

    if (rejected.length) {
      setError(rejected.join(". "));
    }

    if (messages.length) {
      setStatus(messages.join(" "));
    } else if (!rejected.length) {
      setStatus(`Selected ${nextPhotos.length} photo${nextPhotos.length === 1 ? "" : "s"}.`);
    }
  }, []);

  useEffect(() => {
    function syncFilesAfterPickerCloses() {
      if (!photoPickerOpenRef.current) {
        return;
      }

      photoPickerOpenRef.current = false;
      window.setTimeout(() => {
        addPhotoFiles(photoInputRef.current?.files ?? null, { silentEmpty: true });
      }, 80);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        syncFilesAfterPickerCloses();
      }
    }

    window.addEventListener("focus", syncFilesAfterPickerCloses);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", syncFilesAfterPickerCloses);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [addPhotoFiles]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!token) {
      setCatalogLoading(false);
      return;
    }

    let active = true;

    async function loadCatalogOptions() {
      setCatalogLoading(true);
      setCatalogError(null);

      try {
        const options = await apiRequest<VendorCatalogOptions>(
          "/products/vendor/catalog-options",
          undefined,
          token,
        );

        if (active) {
          setCatalogOptions(options);
        }
      } catch (nextError) {
        if (active) {
          setCatalogError(
            nextError instanceof Error
              ? nextError.message
              : "Could not load product catalog options.",
          );
        }
      } finally {
        if (active) {
          setCatalogLoading(false);
        }
      }
    }

    void loadCatalogOptions();

    return () => {
      active = false;
    };
  }, [loading, token]);

  const selectedCategory = useMemo(
    () => catalogOptions?.categories.find((category) => category.id === categoryId) ?? null,
    [catalogOptions, categoryId],
  );

  const resolvedSubcategory = selectedCategory?.subcategories[0] ?? null;

  const visibleSizeTypes = useMemo(
    () => catalogOptions?.sizeTypes.filter((sizeType) => isVisibleVendorSizeType(sizeType.name)) ?? [],
    [catalogOptions],
  );

  const selectedSizeType = useMemo(
    () => catalogOptions?.sizeTypes.find((sizeType) => sizeType.id === selectedSizeTypeId) ?? null,
    [catalogOptions, selectedSizeTypeId],
  );

  const sizeVariants = useMemo(() => {
    if (!selectedSizeType) {
      return [];
    }

    return selectedSizeType.sizes
      .map((size) => ({
        sizeId: size.id,
        stock: Math.max(0, Number(sizeStocks[size.id] ?? 0)),
      }))
      .filter((entry) => entry.stock > 0);
  }, [selectedSizeType, sizeStocks]);

  function handlePhotoSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectionKey = Array.from(event.currentTarget.files ?? [])
      .map(getFileKey)
      .join("|");
    if (selectionKey && selectionKey === lastPhotoSelectionKeyRef.current) {
      return;
    }

    lastPhotoSelectionKeyRef.current = selectionKey;
    photoPickerOpenRef.current = false;
    addPhotoFiles(event.currentTarget.files);
    window.setTimeout(() => {
      event.currentTarget.value = "";
      lastPhotoSelectionKeyRef.current = "";
    }, 0);
  }

  function handlePhotoDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    photoPickerOpenRef.current = false;
    addPhotoFiles(event.dataTransfer.files);
  }

  function removePhoto(index: number) {
    const removedPhoto = photos[index];
    if (!removedPhoto) {
      return;
    }

    URL.revokeObjectURL(removedPhoto.previewUrl);
    const nextPhotos = photos.filter((_, photoIndex) => photoIndex !== index);
    if (!nextPhotos.length && photoInputRef.current) {
      photoInputRef.current.value = "";
    }
    photosRef.current = nextPhotos;
    setPhotos(nextPhotos);
    setPrimaryPhotoIndex((current) => {
      if (!nextPhotos.length) {
        return 0;
      }

      if (current === index) {
        return 0;
      }

      if (current > index) {
        return current - 1;
      }

      return Math.min(current, nextPhotos.length - 1);
    });
    setStatus(
      nextPhotos.length
        ? `Selected ${nextPhotos.length} photo${nextPhotos.length === 1 ? "" : "s"}.`
        : "No photos selected.",
    );
  }

  function movePhoto(fromIndex: number, toIndex: number) {
    setPhotos((current) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= current.length ||
        toIndex >= current.length
      ) {
        return current;
      }

      const nextPhotos = [...current];
      const [movedPhoto] = nextPhotos.splice(fromIndex, 1);
      nextPhotos.splice(toIndex, 0, movedPhoto);
      photosRef.current = nextPhotos;
      return nextPhotos;
    });
    setPrimaryPhotoIndex(0);
    setStatus(`Photo moved to slot ${toIndex + 1}. Slot 1 is the thumbnail.`);
  }

  function selectPrimaryPhoto(index: number) {
    if (index === 0) {
      setPrimaryPhotoIndex(0);
      setStatus("Photo 1 is selected as the thumbnail.");
      return;
    }

    movePhoto(index, 0);
    setStatus(`Photo ${index + 1} moved to slot 1 and selected as the thumbnail.`);
  }

  function toggleColor(colorId: string) {
    setSelectedColorIds((current) =>
      current.includes(colorId)
        ? current.filter((entry) => entry !== colorId)
        : [...current, colorId],
    );
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const priceNumber = Number(price);
    const stockNumber = Number(stock);

    if (!token) {
      setError("Sign in as a vendor before creating a product.");
      return;
    }

    if (!cleanTitle || !cleanDescription) {
      setError("Add a title and description.");
      return;
    }

    if (!Number.isFinite(priceNumber) || priceNumber < 0) {
      setError("Enter a valid price.");
      return;
    }

    const stockRequiredMessage =
      language === "sq"
        ? "Stoku nuk mund te jete 0. Shkruani sa cope keni ne stok."
        : "Stock can't be 0. Enter how many pieces you have in stock.";

    if (!stock.trim() || !Number.isInteger(stockNumber) || stockNumber < 1) {
      setError(stockRequiredMessage);
      return;
    }

    if (!brandId || !categoryId) {
      setError("Select a brand and category.");
      return;
    }

    if (!resolvedSubcategory) {
      setError("This category is not ready for product uploads yet. Choose another category or ask an admin to finish its setup.");
      return;
    }

    if (!selectedColorIds.length) {
      setError("Select at least one color.");
      return;
    }

    if (selectedSizeTypeId && !sizeVariants.length) {
      setError(stockRequiredMessage);
      return;
    }

    if (!photos.length) {
      setError("Select at least one product photo.");
      return;
    }

    const body = new FormData();
    body.append("title", cleanTitle);
    body.append("description", cleanDescription);
    body.append("price", String(priceNumber));
    body.append("stock", String(stockNumber));
    body.append("brandId", brandId);
    body.append("categoryId", categoryId);
    body.append("subcategoryId", resolvedSubcategory.id);
    body.append("colorIds", JSON.stringify(selectedColorIds));
    body.append("primaryUploadIndex", String(Math.min(primaryPhotoIndex, photos.length - 1)));

    if (genderGroupId) {
      body.append("genderGroupId", genderGroupId);
    }

    if (selectedSizeTypeId && sizeVariants.length) {
      body.append("sizeTypeId", selectedSizeTypeId);
      body.append("sizeVariants", JSON.stringify(sizeVariants));
    }

    photos.forEach((photo) => {
      body.append("images", photo.file, photo.file.name);
    });

    setSubmitting(true);
    setStatus("Uploading product...");

    try {
      await apiRequest<ProductCreateResponse>(
        "/products",
        {
          method: "POST",
          body,
        },
        token,
      );

      setStatus("Product sent for admin review.");
      router.push("/vendor/products");
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Product upload failed.");
      setStatus(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <RequireRole requiredRole="vendor">
      <VendorWorkspaceShell
        section="products"
        eyebrow="Products"
        title="Add product"
        description="Create a new product listing with its own photos, catalog details, and stock."
        actions={
          <Link className="button-secondary" href="/vendor/products">
            Products
          </Link>
        }
      >
        <form className="form-card vendor-product-composer vendor-product-create-form" onSubmit={submitProduct}>
          {catalogLoading ? <div className="message">Loading catalog...</div> : null}
          {catalogError ? <div className="message error">{catalogError}</div> : null}
          {error ? <div className="message error">{error}</div> : null}
          {status ? <div className="message success">{status}</div> : null}

          <div className="vendor-product-composer-layout">
            <div className="vendor-product-composer-main">
              <section className="vendor-product-composer-section">
                <div className="vendor-product-composer-section-head">
                  <span className="vendor-product-composer-step">1</span>
                  <div>
                    <h3>Product details</h3>
                  </div>
                </div>

                <div className="form-grid two">
                  <label className="field">
                    <span>Title</span>
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Product name"
                    />
                  </label>

                  <label className="field">
                    <span>Price</span>
                    <input
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      type="number"
                      placeholder="0.00"
                    />
                  </label>

                  <label className="field">
                    <span>Stock</span>
                    <input
                      value={stock}
                      onChange={(event) => setStock(event.target.value)}
                      inputMode="numeric"
                      min="1"
                      step="1"
                      type="number"
                      placeholder="1"
                    />
                  </label>

                  <label className="field">
                    <span>Gender group</span>
                    <select
                      value={genderGroupId}
                      onChange={(event) => setGenderGroupId(event.target.value)}
                      disabled={!catalogOptions?.genderGroups.length}
                    >
                      <option value="">Optional</option>
                      {catalogOptions?.genderGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="field">
                  <span>Description</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe the product"
                  />
                </label>
              </section>

              <section className="vendor-product-composer-section">
                <div className="vendor-product-composer-section-head">
                  <span className="vendor-product-composer-step">2</span>
                  <div>
                    <h3>Catalog</h3>
                  </div>
                </div>

                <div className="form-grid two">
                  <label className="field">
                    <span>Brand</span>
                    <select
                      value={brandId}
                      onChange={(event) => setBrandId(event.target.value)}
                      disabled={!catalogOptions?.brands.length}
                    >
                      <option value="">Select brand</option>
                      {catalogOptions?.brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Category</span>
                    <select
                      value={categoryId}
                      onChange={(event) => setCategoryId(event.target.value)}
                      disabled={!catalogOptions?.categories.length}
                    >
                      <option value="">Select category</option>
                      {catalogOptions?.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className="vendor-product-composer-section">
                <div className="vendor-product-composer-section-head">
                  <span className="vendor-product-composer-step">3</span>
                  <div>
                    <h3>Colors</h3>
                  </div>
                </div>

                <div className="vendor-color-grid">
                  {catalogOptions?.colors.map((color) => {
                    const selected = selectedColorIds.includes(color.id);

                    return (
                      <button
                        key={color.id}
                        type="button"
                        className={selected ? "vendor-color-option selected" : "vendor-color-option"}
                        onClick={() => toggleColor(color.id)}
                        aria-pressed={selected}
                      >
                        <span
                          className="vendor-color-swatch"
                          style={{ background: getColorSwatch(color.name) }}
                          aria-hidden="true"
                        />
                        <span>{color.name}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="vendor-product-composer-section">
                <div className="vendor-product-composer-section-head">
                  <span className="vendor-product-composer-step">4</span>
                  <div>
                    <h3>Sizes</h3>
                  </div>
                </div>

                <label className="field vendor-size-type-field">
                  <span>Size type</span>
                  <select
                    value={selectedSizeTypeId}
                    onChange={(event) => {
                      setSelectedSizeTypeId(event.target.value);
                      setSizeStocks({});
                    }}
                    disabled={!visibleSizeTypes.length}
                  >
                    <option value="">No size variants</option>
                    {visibleSizeTypes.map((sizeType) => (
                      <option key={sizeType.id} value={sizeType.id}>
                        {formatVendorSizeTypeLabel(sizeType.name)}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedSizeType ? (
                  <div className="vendor-size-grid">
                    {selectedSizeType.sizes.map((size) => (
                      <label key={size.id} className="vendor-size-stock-option">
                        <span>{size.label}</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          value={sizeStocks[size.id] ?? ""}
                          onChange={(event) =>
                            setSizeStocks((current) => ({
                              ...current,
                              [size.id]: event.target.value,
                            }))
                          }
                          placeholder="1"
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
              </section>
            </div>

            <aside className="vendor-product-composer-side">
              <section
                className="vendor-product-composer-panel vendor-photo-drop-panel"
                onDragOver={(event) => event.preventDefault()}
                onDrop={handlePhotoDrop}
              >
                <div className="vendor-product-composer-section-head">
                  <span className="vendor-product-composer-step">5</span>
                  <div>
                    <h3>Photos</h3>
                  </div>
                </div>

                <div className="field">
                  <span>Product photos</span>
                  <div className="vendor-photo-picker-actions">
                    <label
                      htmlFor={photoInputId}
                      className="button-secondary"
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        photoPickerOpenRef.current = true;
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          photoPickerOpenRef.current = true;
                          photoInputRef.current?.click();
                        }
                      }}
                    >
                      Choose photos
                    </label>
                    <span className="vendor-upload-status">
                      {photos.length
                        ? `${photos.length} photo${photos.length === 1 ? "" : "s"} selected`
                        : "No photos selected yet"}
                    </span>
                  </div>
                  <p className="vendor-upload-status">{photoPickerMessage}</p>
                  <input
                    id={photoInputId}
                    ref={photoInputRef}
                    className="vendor-hidden-file-input"
                    type="file"
                    accept="image/*,.avif,.heic,.heif"
                    multiple
                    tabIndex={-1}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        photoPickerOpenRef.current = true;
                      }
                    }}
                    onInput={(event) => {
                      handlePhotoSelection(event as unknown as ChangeEvent<HTMLInputElement>);
                    }}
                    onChange={handlePhotoSelection}
                  />
                </div>

                {photos.length ? (
                  <div className="vendor-new-photo-grid">
                    {photos.map((photo, index) => (
                      <div
                        key={photo.id}
                        className="vendor-new-photo-card"
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", String(index));
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const fromIndex = Number(event.dataTransfer.getData("text/plain"));
                          if (!Number.isNaN(fromIndex)) {
                            movePhoto(fromIndex, index);
                          }
                        }}
                      >
                        <button
                          type="button"
                          className={
                            primaryPhotoIndex === index
                              ? "vendor-new-photo-preview selected"
                              : "vendor-new-photo-preview"
                          }
                          onClick={() => selectPrimaryPhoto(index)}
                          aria-label={`Use photo ${index + 1} as product thumbnail`}
                        >
                          <img src={photo.previewUrl} alt={photo.file.name} />
                        </button>
                        <div className="vendor-new-photo-meta">
                          <strong>
                            {primaryPhotoIndex === index
                              ? `Photo ${index + 1} - thumbnail`
                              : `Photo ${index + 1}`}
                          </strong>
                          <span>{photo.file.name}</span>
                          <small>{formatFileSize(photo.file.size)}</small>
                        </div>
                        <div className="vendor-new-photo-actions">
                          <button
                            type="button"
                            className={
                              primaryPhotoIndex === index
                                ? "thumbnail-select-button selected"
                                : "thumbnail-select-button"
                            }
                            onClick={() => selectPrimaryPhoto(index)}
                          >
                            {primaryPhotoIndex === index
                              ? "Thumbnail selected"
                              : `Use photo ${index + 1} as thumbnail`}
                          </button>
                          <button
                            type="button"
                            className="button-ghost"
                            onClick={() => removePhoto(index)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty">Choose photos above and they will appear here.</div>
                )}
              </section>

              <section className="vendor-product-composer-panel">
                <button
                  className="button"
                  type="submit"
                  disabled={submitting || catalogLoading || Boolean(catalogError)}
                >
                  {submitting ? "Uploading..." : "Create product"}
                </button>
                <Link className="button-secondary" href="/vendor/products">
                  Cancel
                </Link>
              </section>
            </aside>
          </div>
        </form>
      </VendorWorkspaceShell>
    </RequireRole>
  );
}

function isAcceptedImageFile(file: File) {
  const name = file.name.toLowerCase();
  return (
    file.type.startsWith("image/") ||
    ACCEPTED_IMAGE_EXTENSIONS.some((extension) => name.endsWith(extension))
  );
}

function getFileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getColorSwatch(colorName: string) {
  const normalized = colorName.trim().toLowerCase();
  const colorMap: Record<string, string> = {
    beige: "#d7c2a3",
    black: "#111111",
    blue: "#2563eb",
    brown: "#7c4a2d",
    cream: "#f3ead7",
    gold: "#d4a017",
    gray: "#9ca3af",
    green: "#16a34a",
    grey: "#9ca3af",
    ivory: "#f8f1df",
    navy: "#1e3a8a",
    orange: "#f97316",
    pink: "#ec4899",
    purple: "#7c3aed",
    red: "#dc2626",
    silver: "#d1d5db",
    white: "#ffffff",
    yellow: "#facc15",
  };

  return colorMap[normalized] ?? "#e5e7eb";
}
