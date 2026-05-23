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

const productCreateCopy = {
  en: {
    eyebrow: "Products",
    title: "Add product",
    description: "Create a new product listing with its own photos, catalog details, and stock.",
    products: "Products",
    loadingCatalog: "Loading catalog...",
    catalogLoadFailed: "Could not load product catalog options.",
    productDetails: "Product details",
    titleLabel: "Title",
    titlePlaceholder: "Product name",
    price: "Price",
    stock: "Stock",
    genderGroup: "Gender group",
    optional: "Optional",
    descriptionLabel: "Description",
    descriptionPlaceholder: "Describe the product",
    catalog: "Catalog",
    brand: "Brand",
    selectBrand: "Select brand",
    category: "Category",
    selectCategory: "Select category",
    colors: "Colors",
    sizes: "Sizes",
    sizeType: "Size type",
    noSizeVariants: "No size variants",
    photos: "Photos",
    productPhotos: "Product photos",
    choosePhotos: "Choose photos",
    noPhotoSelected: "No photo selected yet.",
    noPhotosSelected: "No photos selected yet",
    selectedPhotoCount: (count: number) => `${count} photo${count === 1 ? "" : "s"} selected`,
    detectedFiles: (count: number, names: string) =>
      `Browser detected ${count} file${count === 1 ? "" : "s"}: ${names}`,
    pickerEmpty: "The browser did not send any file from the picker.",
    noFileFromFolder: "No file was selected from the folder.",
    photoLimit: (name: string, limit: number) => `${name} exceeds the ${limit} photo limit`,
    unsupportedImage: (name: string) => `${name} is not a supported image`,
    imageTooLarge: (name: string) => `${name} is larger than 30 MB`,
    skippedDuplicate: (names: string) => `Skipped duplicate: ${names}.`,
    selectedPhotosSentence: (count: number) => `Selected ${count} photo${count === 1 ? "" : "s"}.`,
    noPhotosSentence: "No photos selected.",
    photoMoved: (slot: number) => `Photo moved to slot ${slot}. Slot 1 is the thumbnail.`,
    photoOneThumbnail: "Photo 1 is selected as the thumbnail.",
    movedToThumbnail: (photo: number) => `Photo ${photo} moved to slot 1 and selected as the thumbnail.`,
    useAsThumbnail: (photo: number) => `Use photo ${photo} as product thumbnail`,
    photoLabel: (photo: number) => `Photo ${photo}`,
    photoThumbnailLabel: (photo: number) => `Photo ${photo} - thumbnail`,
    thumbnailSelected: "Thumbnail selected",
    setThumbnail: "Set thumbnail",
    remove: "Remove",
    emptyPhotos: "Choose photos above and they will appear here.",
    uploading: "Uploading...",
    uploadingProduct: "Uploading product...",
    createProduct: "Create product",
    cancel: "Cancel",
    sentForReview: "Product sent for admin review.",
    uploadFailed: "Product upload failed.",
    signInVendor: "Sign in as a vendor before creating a product.",
    addTitleDescription: "Add a title and description.",
    priceRequired: "Enter a product price greater than 0.",
    stockRequired: "Stock can't be 0. Enter how many pieces you have in stock.",
    selectBrandCategory: "Select a brand and category.",
    categoryNotReady:
      "This category is not ready for product uploads yet. Choose another category or ask an admin to finish its setup.",
    selectColor: "Select at least one color.",
    selectPhoto: "Select at least one product photo.",
  },
  sq: {
    eyebrow: "Produktet",
    title: "Shto produkt",
    description: "Krijo nje produkt te ri me fotot, detajet e katalogut dhe stokun e vet.",
    products: "Produktet",
    loadingCatalog: "Katalogu po ngarkohet...",
    catalogLoadFailed: "Opsionet e katalogut nuk mund te ngarkoheshin.",
    productDetails: "Detajet e produktit",
    titleLabel: "Titulli",
    titlePlaceholder: "Emri i produktit",
    price: "Cmimi",
    stock: "Stoku",
    genderGroup: "Grupi gjinor",
    optional: "Opsionale",
    descriptionLabel: "Pershkrimi",
    descriptionPlaceholder: "Pershkruani produktin",
    catalog: "Katalogu",
    brand: "Marka",
    selectBrand: "Zgjidh marken",
    category: "Kategoria",
    selectCategory: "Zgjidh kategorine",
    colors: "Ngjyrat",
    sizes: "Madhesite",
    sizeType: "Lloji i madhesise",
    noSizeVariants: "Pa variante madhesie",
    photos: "Fotot",
    productPhotos: "Fotot e produktit",
    choosePhotos: "Zgjidh fotot",
    noPhotoSelected: "Ende nuk eshte zgjedhur foto.",
    noPhotosSelected: "Ende nuk jane zgjedhur foto",
    selectedPhotoCount: (count: number) => `${count} foto ${count === 1 ? "e zgjedhur" : "te zgjedhura"}`,
    detectedFiles: (count: number, names: string) =>
      `Shfletuesi gjeti ${count} skedar${count === 1 ? "" : "e"}: ${names}`,
    pickerEmpty: "Shfletuesi nuk dergoi asnje skedar nga zgjedhesi.",
    noFileFromFolder: "Nuk u zgjodh asnje skedar nga dosja.",
    photoLimit: (name: string, limit: number) => `${name} tejkalon limitin prej ${limit} fotove`,
    unsupportedImage: (name: string) => `${name} nuk eshte imazh i perkrahur`,
    imageTooLarge: (name: string) => `${name} eshte me i madh se 30 MB`,
    skippedDuplicate: (names: string) => `U anashkalua dublikati: ${names}.`,
    selectedPhotosSentence: (count: number) => `U zgjodhen ${count} foto.`,
    noPhotosSentence: "Nuk ka foto te zgjedhura.",
    photoMoved: (slot: number) => `Fotoja u zhvendos ne pozicionin ${slot}. Pozicioni 1 eshte thumbnail.`,
    photoOneThumbnail: "Fotoja 1 eshte zgjedhur si thumbnail.",
    movedToThumbnail: (photo: number) => `Fotoja ${photo} u vendos ne pozicionin 1 dhe u zgjodh si thumbnail.`,
    useAsThumbnail: (photo: number) => `Perdor foton ${photo} si thumbnail te produktit`,
    photoLabel: (photo: number) => `Foto ${photo}`,
    photoThumbnailLabel: (photo: number) => `Foto ${photo} - thumbnail`,
    thumbnailSelected: "Thumbnail i zgjedhur",
    setThumbnail: "Set thumbnail",
    remove: "Hiq",
    emptyPhotos: "Zgjidh fotot me lart dhe ato do te shfaqen ketu.",
    uploading: "Duke ngarkuar...",
    uploadingProduct: "Produkti po ngarkohet...",
    createProduct: "Krijo produktin",
    cancel: "Anulo",
    sentForReview: "Produkti u dergua per shqyrtim nga admini.",
    uploadFailed: "Ngarkimi i produktit deshtoi.",
    signInVendor: "Hyni si biznes para se te krijoni produkt.",
    addTitleDescription: "Shtoni titullin dhe pershkrimin.",
    priceRequired: "Shkruani nje cmim produkti me te madh se 0.",
    stockRequired: "Stoku nuk mund te jete 0. Shkruani sa cope keni ne stok.",
    selectBrandCategory: "Zgjidhni marken dhe kategorine.",
    categoryNotReady:
      "Kjo kategori nuk eshte gati per ngarkim produktesh. Zgjidhni kategori tjeter ose kerkoni nga admini ta perfundoje konfigurimin.",
    selectColor: "Zgjidhni te pakten nje ngjyre.",
    selectPhoto: "Zgjidhni te pakten nje foto te produktit.",
  },
} as const;

function formatVendorSizeTypeLabel(name: string, language: "en" | "sq") {
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

function formatVendorSizeTypeDisplay(name: string, language: "en" | "sq") {
  const normalized = name.trim().toLowerCase();
  if (language === "sq") {
    if (normalized === "babies" || normalized === "baby") return "Bebe";
    if (normalized === "kids") return "Femije";
    if (normalized === "eu") return "Te rritur";
    if (normalized === "shoe eu") return "Kepuce";
  }
  if (normalized === "babies" || normalized === "baby") return "Babies";
  if (normalized === "kids") return "Kids";
  if (normalized === "eu") return "Adults";
  if (normalized === "shoe eu") return "Shoes";
  return name;
}

function formatVendorCatalogOptionLabel(name: string, language: "en" | "sq") {
  if (language !== "sq") {
    return name;
  }

  const normalized = name.trim().toLowerCase();
  const sqLabels: Record<string, string> = {
    men: "Meshkuj",
    man: "Meshkuj",
    women: "Femra",
    woman: "Femra",
    kids: "Femije",
    babies: "Bebe",
    baby: "Bebe",
    dress: "Fustan",
    dresses: "Fustane",
    shoes: "Kepuce",
    shoe: "Kepuce",
    accessories: "Aksesor",
    accessory: "Aksesor",
    bags: "Canta",
    bag: "Cante",
    suit: "Kostum",
    suits: "Kostume",
    set: "Komplet",
    sets: "Komplete",
    pants: "Pantallona",
    jeans: "Xhinse",
    skirt: "Fund",
    skirts: "Funde",
    shirt: "Kemishe",
    shirts: "Kemisha",
    blouse: "Bluze",
    top: "Bluze",
    jacket: "Xhakete",
    jackets: "Xhaketa",
    coat: "Pallto",
    coats: "Pallto",
    black: "E zeze",
    white: "E bardhe",
    red: "E kuqe",
    blue: "Blu",
    "light blue": "Blu e hapur",
    "sky blue": "Blu qielli",
    "dark blue": "Blu e erret",
    green: "E gjelber",
    pink: "Roze",
    beige: "Bezhe",
    brown: "Kafe",
    gray: "Gri",
    grey: "Gri",
    gold: "Ari",
    silver: "Argjend",
    yellow: "E verdhe",
    orange: "Portokalli",
    purple: "Vjollce",
    cream: "Krem",
  };

  return sqLabels[normalized] ?? name;
}

export function VendorProductCreatePage() {
  const router = useRouter();
  const { token, loading } = useAuth();
  const { language } = useLanguage();
  const t = productCreateCopy[language];
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
  const [photoPickerMessage, setPhotoPickerMessage] = useState<string>(t.noPhotoSelected);
  const [submitting, setSubmitting] = useState(false);
  const photoInputId = useId();
  const photosRef = useRef<SelectedProductPhoto[]>([]);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const photoPickerOpenRef = useRef(false);
  const lastPhotoSelectionKeyRef = useRef("");

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    if (!photos.length) {
      setPhotoPickerMessage(t.noPhotoSelected);
    }
  }, [photos.length, t.noPhotoSelected]);

  useEffect(() => {
    resizeTextareaToContent(descriptionTextareaRef.current);
  }, [description]);

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
        setPhotoPickerMessage(t.pickerEmpty);
        setStatus(t.noFileFromFolder);
      }
      return;
    }

    setPhotoPickerMessage(
      t.detectedFiles(
        selectedFiles.length,
        selectedFiles.map((file) => file.name).join(", "),
      ),
    );

    const currentPhotos = photosRef.current;
    const existingKeys = new Set(currentPhotos.map((photo) => getFileKey(photo.file)));
    const nextPhotos = [...currentPhotos];
    const rejected: string[] = [];
    const duplicates: string[] = [];

    for (const file of selectedFiles) {
      if (nextPhotos.length >= MAX_PRODUCT_PHOTOS) {
        rejected.push(t.photoLimit(file.name, MAX_PRODUCT_PHOTOS));
        continue;
      }

      if (existingKeys.has(getFileKey(file))) {
        duplicates.push(file.name);
        continue;
      }

      if (!isAcceptedImageFile(file)) {
        rejected.push(t.unsupportedImage(file.name));
        continue;
      }

      if (file.size > MAX_PRODUCT_PHOTO_SIZE) {
        rejected.push(t.imageTooLarge(file.name));
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
      messages.push(t.selectedPhotosSentence(nextPhotos.length));
    }
    if (duplicates.length) {
      messages.push(t.skippedDuplicate(duplicates.join(", ")));
    }

    if (rejected.length) {
      setError(rejected.join(". "));
    }

    if (messages.length) {
      setStatus(messages.join(" "));
    } else if (!rejected.length) {
      setStatus(t.selectedPhotosSentence(nextPhotos.length));
    }
  }, [t]);

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
            : t.catalogLoadFailed,
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
  }, [loading, token, t.catalogLoadFailed]);

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
        ? t.selectedPhotosSentence(nextPhotos.length)
        : t.noPhotosSentence,
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
    setStatus(t.photoMoved(toIndex + 1));
  }

  function selectPrimaryPhoto(index: number) {
    if (index === 0) {
      setPrimaryPhotoIndex(0);
      setStatus(t.photoOneThumbnail);
      return;
    }

    movePhoto(index, 0);
    setStatus(t.movedToThumbnail(index + 1));
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
      setError(t.signInVendor);
      return;
    }

    if (!cleanTitle || !cleanDescription) {
      setError(t.addTitleDescription);
      return;
    }

    if (!price.trim() || !Number.isFinite(priceNumber) || priceNumber <= 0) {
      setError(t.priceRequired);
      return;
    }

    const stockRequiredMessage = t.stockRequired;

    if (!stock.trim() || !Number.isInteger(stockNumber) || stockNumber < 1) {
      setError(stockRequiredMessage);
      return;
    }

    if (!brandId || !categoryId) {
      setError(t.selectBrandCategory);
      return;
    }

    if (!resolvedSubcategory) {
      setError(t.categoryNotReady);
      return;
    }

    if (!selectedColorIds.length) {
      setError(t.selectColor);
      return;
    }

    if (selectedSizeTypeId && !sizeVariants.length) {
      setError(stockRequiredMessage);
      return;
    }

    if (!photos.length) {
      setError(t.selectPhoto);
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
    setStatus(t.uploadingProduct);

    try {
      await apiRequest<ProductCreateResponse>(
        "/products",
        {
          method: "POST",
          body,
        },
        token,
      );

      setStatus(t.sentForReview);
      router.push("/vendor/products");
      router.refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t.uploadFailed);
      setStatus(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <RequireRole requiredRole="vendor">
      <VendorWorkspaceShell
        section="products"
        eyebrow={t.eyebrow}
        title={t.title}
        description={t.description}
        actions={
          <Link className="button-secondary" href="/vendor/products">
            {t.products}
          </Link>
        }
      >
        <form className="form-card vendor-product-composer vendor-product-create-form" onSubmit={submitProduct}>
          {catalogLoading ? <div className="message">{t.loadingCatalog}</div> : null}
          {catalogError ? <div className="message error">{catalogError}</div> : null}
          {error ? <div className="message error">{error}</div> : null}
          {status ? <div className="message success">{status}</div> : null}

          <div className="vendor-product-composer-layout">
            <div className="vendor-product-composer-main">
              <section className="vendor-product-composer-section">
                <div className="vendor-product-composer-section-head">
                  <span className="vendor-product-composer-step">1</span>
                  <div>
                    <h3>{t.productDetails}</h3>
                  </div>
                </div>

                <div className="form-grid two">
                  <label className="field">
                    <span>{t.titleLabel}</span>
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder={t.titlePlaceholder}
                    />
                  </label>

                  <label className="field">
                    <span>{t.price}</span>
                    <input
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      type="number"
                      placeholder="0.00"
                      required
                    />
                  </label>

                  <label className="field">
                    <span>{t.stock}</span>
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
                    <span>{t.genderGroup}</span>
                    <select
                      value={genderGroupId}
                      onChange={(event) => setGenderGroupId(event.target.value)}
                      disabled={!catalogOptions?.genderGroups.length}
                    >
                      <option value="">{t.optional}</option>
                      {catalogOptions?.genderGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {formatVendorCatalogOptionLabel(group.name, language)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="field">
                  <span>{t.descriptionLabel}</span>
                  <textarea
                    ref={descriptionTextareaRef}
                    value={description}
                    rows={3}
                    onChange={(event) => {
                      resizeTextareaToContent(event.currentTarget);
                      setDescription(event.target.value);
                    }}
                    placeholder={t.descriptionPlaceholder}
                  />
                </label>
              </section>

              <section className="vendor-product-composer-section">
                <div className="vendor-product-composer-section-head">
                  <span className="vendor-product-composer-step">2</span>
                  <div>
                    <h3>{t.catalog}</h3>
                  </div>
                </div>

                <div className="form-grid two">
                  <label className="field">
                    <span>{t.brand}</span>
                    <select
                      value={brandId}
                      onChange={(event) => setBrandId(event.target.value)}
                      disabled={!catalogOptions?.brands.length}
                    >
                      <option value="">{t.selectBrand}</option>
                      {catalogOptions?.brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>{t.category}</span>
                    <select
                      value={categoryId}
                      onChange={(event) => setCategoryId(event.target.value)}
                      disabled={!catalogOptions?.categories.length}
                    >
                      <option value="">{t.selectCategory}</option>
                      {catalogOptions?.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {formatVendorCatalogOptionLabel(category.name, language)}
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
                    <h3>{t.colors}</h3>
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
                        <span>{formatVendorCatalogOptionLabel(color.name, language)}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="vendor-product-composer-section">
                <div className="vendor-product-composer-section-head">
                  <span className="vendor-product-composer-step">4</span>
                  <div>
                    <h3>{t.sizes}</h3>
                  </div>
                </div>

                <label className="field vendor-size-type-field">
                  <span>{t.sizeType}</span>
                  <select
                    value={selectedSizeTypeId}
                    onChange={(event) => {
                      setSelectedSizeTypeId(event.target.value);
                      setSizeStocks({});
                    }}
                    disabled={!visibleSizeTypes.length}
                  >
                    <option value="">{t.noSizeVariants}</option>
                    {visibleSizeTypes.map((sizeType) => (
                      <option key={sizeType.id} value={sizeType.id}>
                        {formatVendorSizeTypeDisplay(sizeType.name, language)}
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
                    <h3>{t.photos}</h3>
                  </div>
                </div>

                <div className="field">
                  <span>{t.productPhotos}</span>
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
                      {t.choosePhotos}
                    </label>
                    <span className="vendor-upload-status">
                      {photos.length ? t.selectedPhotoCount(photos.length) : t.noPhotosSelected}
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
                          aria-label={t.useAsThumbnail(index + 1)}
                        >
                          <img src={photo.previewUrl} alt={photo.file.name} />
                        </button>
                        <div className="vendor-new-photo-meta">
                          <strong>
                            {primaryPhotoIndex === index
                              ? t.photoThumbnailLabel(index + 1)
                              : t.photoLabel(index + 1)}
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
                              ? t.thumbnailSelected
                              : t.setThumbnail}
                          </button>
                          <button
                            type="button"
                            className="button-ghost"
                            onClick={() => removePhoto(index)}
                          >
                            {t.remove}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty">{t.emptyPhotos}</div>
                )}
              </section>

              <section className="vendor-product-composer-panel">
                <button
                  className="button"
                  type="submit"
                  disabled={submitting || catalogLoading || Boolean(catalogError)}
                >
                  {submitting ? t.uploading : t.createProduct}
                </button>
                <Link className="button-secondary" href="/vendor/products">
                  {t.cancel}
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

function resizeTextareaToContent(textarea: HTMLTextAreaElement | null) {
  if (!textarea) {
    return;
  }

  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function getColorSwatch(colorName: string) {
  const normalized = colorName.trim().toLowerCase();
  const colorMap: Record<string, string> = {
    beige: "#d7c2a3",
    black: "#111111",
    blue: "#2563eb",
    "dark blue": "#1e3a8a",
    "light blue": "#93c5fd",
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
    "sky blue": "#38bdf8",
    white: "#ffffff",
    yellow: "#facc15",
  };

  return colorMap[normalized] ?? "#e5e7eb";
}
