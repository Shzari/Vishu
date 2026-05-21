"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth, useLanguage } from "@/components/providers";
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

const PRODUCT_IMAGE_LIMIT = 6;
const PRODUCT_IMAGE_ACCEPT = "image/*,.avif,.heic,.heif";

function getProductImageFileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

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
  specialRequest?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  shippingAddress?: {
    label: string | null;
    fullName: string | null;
    phoneNumber: string | null;
    line1: string | null;
    line2: string | null;
    city: string | null;
    stateRegion: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
  items: {
    id: string;
    quantity: number;
    unitPrice: number;
    commission: number;
    vendorEarnings: number;
    status: string;
    shipment?: {
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
    last_login_at: string | null;
    last_activity_at: string | null;
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

const accessoryTypeLabelsSq = new Map<string, string>([
  ["wallet", "Kulet"],
  ["glasses", "Syze"],
  ["brooch", "Brosh"],
]);

const productComposerCopy = {
  en: {
    products: "Products",
    productsIntro: "Manage listings from the table below, or use the full product page to add a new item.",
    addProduct: "Add product",
    editProduct: "Edit product",
    productStudio: "Product studio",
    refineProduct: "Refine this product",
    createListing: "Create a sharper listing",
    editing: "Editing",
    newListing: "New listing",
    selected: (count: number) => `${count} selected`,
    saved: (count: number) => `${count} saved`,
    noImagesYet: "No images yet",
    verifyVendorEmail: "Verify your vendor email before you can save products.",
    vendorPending:
      "You can prepare products now. They stay hidden from customers until an admin activates your vendor account.",
    coreDetails: "Core details",
    title: "Title",
    titlePlaceholder: "Ex. Soft lounge hoodie",
    description: "Description",
    price: "Price",
    stock: "Stock",
    totalStock: "Total stock",
    catalogSetup: "Catalog setup",
    brand: "Brand",
    selectBrand: "Select brand",
    category: "Category",
    selectCategory: "Select category",
    gender: "Gender",
    productGenders: "Product genders",
    accessoryType: "Accessory type",
    missing: "Missing",
    missingHint: "Request a missing catalog option from admin.",
    missingValue: "Missing value",
    missingPlaceholder: "Enter what is missing",
    submitting: "Submitting...",
    submitRequest: "Submit request",
    requests: (count: number) => `${count} requests`,
    colorAndSize: "Color and size",
    colors: "Colors",
    productColors: "Product colors",
    sizeType: "Size type",
    productSizeType: "Product size type",
    euShoeSizes: "EU shoe sizes",
    sizes: "Sizes",
    productSizes: "Product sizes",
    imagesPublish: "Images and publish",
    chooseBrand: "Choose brand",
    chooseCategory: "Choose category",
    optional: "Optional",
    sizeSetup: "Size setup",
    notRequired: "Not required",
    chooseSizeDetails: "Choose size details",
    newImagesSelected: (count: number) => `${count} new image${count === 1 ? "" : "s"} selected`,
    savedImages: (count: number) => `${count} saved image${count === 1 ? "" : "s"}`,
    chooseProductImages: "Choose product images",
    replaceImages: "Replace existing images",
    currentImages: "Current images",
    newUploads: "New uploads",
    slotThumbnail: (slot: number) => `Slot ${slot}${slot === 1 ? " - thumbnail" : ""}`,
    uploadSlotThumbnail: (slot: number, selected: boolean) =>
      `Upload slot ${slot}${selected ? " - thumbnail" : ""}`,
    removeSavedImage: "Remove saved image",
    removeNamed: (name: string) => `Remove ${name}`,
    remove: "Remove",
    thumbnailSelected: "Thumbnail selected",
    setThumbnail: "Set thumbnail",
    photoSelected: "Photo selected",
    updating: "Updating...",
    creating: "Creating...",
    updateProduct: "Update product",
    createProduct: "Create product",
    cancelEdit: "Cancel edit",
    backToProducts: "Back to products",
    close: "Close",
    choosePhotos: "Choose photos",
    noPhotosReady: "No photos selected yet",
    photosReady: (count: number) => `${count} photo${count === 1 ? "" : "s"} ready`,
    selectedPhotoNames: (count: number, names: string, limited: boolean) =>
      `${count} photo${count === 1 ? "" : "s"} selected: ${names}${limited ? ` Only ${PRODUCT_IMAGE_LIMIT} photos are allowed.` : ""}`,
    noPhotosSelected: "No photos were selected.",
    duplicatePhotos: "Those photos are already selected.",
    selectAtLeastOnePhoto: "Select at least one product photo before creating the product.",
    priceRequired: "Enter a product price greater than 0.",
    stockRequired: "Stock can't be 0. Enter how many pieces you have in stock.",
    sentForReview: "Product sent for admin review.",
    updated: "Product updated.",
    updatedForReview: "Product updated and sent for admin review.",
  },
  sq: {
    products: "Produktet",
    productsIntro: "Menaxhoni listimet nga tabela poshte, ose perdorni faqen e plote per te shtuar produkt te ri.",
    addProduct: "Shto produkt",
    editProduct: "Ndrysho produktin",
    productStudio: "Studio e produktit",
    refineProduct: "Permireso kete produkt",
    createListing: "Krijo listim me te qarte",
    editing: "Duke ndryshuar",
    newListing: "Listim i ri",
    selected: (count: number) => `${count} te zgjedhura`,
    saved: (count: number) => `${count} te ruajtura`,
    noImagesYet: "Ende nuk ka imazhe",
    verifyVendorEmail: "Verifikoni emailin e shitesit para se te ruani produkte.",
    vendorPending:
      "Mund te pergatisni produktet tani. Ato mbeten te fshehura per klientet derisa admini ta aktivizoje dyqanin.",
    coreDetails: "Detajet kryesore",
    title: "Titulli",
    titlePlaceholder: "P.sh. Hoodie i bute",
    description: "Pershkrimi",
    price: "Cmimi",
    stock: "Stoku",
    totalStock: "Stoku total",
    catalogSetup: "Konfigurimi i katalogut",
    brand: "Marka",
    selectBrand: "Zgjidh marken",
    category: "Kategoria",
    selectCategory: "Zgjidh kategorine",
    gender: "Gjinia",
    productGenders: "Gjinite e produktit",
    accessoryType: "Lloji i aksesorit",
    missing: "Mungese",
    missingHint: "Kerkoni nga admini nje opsion qe mungon ne katalog.",
    missingValue: "Vlera qe mungon",
    missingPlaceholder: "Shkruani cfare mungon",
    submitting: "Duke derguar...",
    submitRequest: "Dergo kerkesen",
    requests: (count: number) => `${count} kerkesa`,
    colorAndSize: "Ngjyra dhe madhesia",
    colors: "Ngjyrat",
    productColors: "Ngjyrat e produktit",
    sizeType: "Lloji i madhesise",
    productSizeType: "Lloji i madhesise se produktit",
    euShoeSizes: "Madhesite EU te kepuceve",
    sizes: "Madhesite",
    productSizes: "Madhesite e produktit",
    imagesPublish: "Imazhet dhe publikimi",
    chooseBrand: "Zgjidh marken",
    chooseCategory: "Zgjidh kategorine",
    optional: "Opsionale",
    sizeSetup: "Madhesite",
    notRequired: "Nuk kerkohet",
    chooseSizeDetails: "Zgjidh detajet e madhesise",
    newImagesSelected: (count: number) => `${count} imazh${count === 1 ? "" : "e"} te reja te zgjedhura`,
    savedImages: (count: number) => `${count} imazh${count === 1 ? "" : "e"} te ruajtura`,
    chooseProductImages: "Zgjidh imazhet e produktit",
    replaceImages: "Zevendeso imazhet ekzistuese",
    currentImages: "Imazhet aktuale",
    newUploads: "Ngarkime te reja",
    slotThumbnail: (slot: number) => `Pozicioni ${slot}${slot === 1 ? " - thumbnail" : ""}`,
    uploadSlotThumbnail: (slot: number, selected: boolean) =>
      `Pozicioni i ngarkimit ${slot}${selected ? " - thumbnail" : ""}`,
    removeSavedImage: "Hiq imazhin e ruajtur",
    removeNamed: (name: string) => `Hiq ${name}`,
    remove: "Hiq",
    thumbnailSelected: "Thumbnail i zgjedhur",
    setThumbnail: "Set thumbnail",
    photoSelected: "Foto e zgjedhur",
    updating: "Duke perditesuar...",
    creating: "Duke krijuar...",
    updateProduct: "Perditeso produktin",
    createProduct: "Krijo produktin",
    cancelEdit: "Anulo ndryshimin",
    backToProducts: "Kthehu te produktet",
    close: "Mbyll",
    choosePhotos: "Zgjidh fotot",
    noPhotosReady: "Ende nuk ka foto te zgjedhura",
    photosReady: (count: number) => `${count} foto gati`,
    selectedPhotoNames: (count: number, names: string, limited: boolean) =>
      `${count} foto te zgjedhura: ${names}${limited ? ` Lejohen vetem ${PRODUCT_IMAGE_LIMIT} foto.` : ""}`,
    noPhotosSelected: "Nuk u zgjodh asnje foto.",
    duplicatePhotos: "Keto foto jane zgjedhur tashme.",
    selectAtLeastOnePhoto: "Zgjidhni te pakten nje foto te produktit para krijimit.",
    priceRequired: "Shkruani nje cmim produkti me te madh se 0.",
    stockRequired: "Stoku nuk mund te jete 0. Shkruani sa cope keni ne stok.",
    sentForReview: "Produkti u dergua per shqyrtim nga admini.",
    updated: "Produkti u perditesua.",
    updatedForReview: "Produkti u perditesua dhe u dergua per shqyrtim nga admini.",
  },
} as const;

function formatVendorCatalogLabel(value: string, language: "en" | "sq") {
  if (language !== "sq") {
    return formatCatalogLabel(value);
  }

  const normalized = value.trim().toLowerCase();
  const sqLabels: Record<string, string> = {
    men: "Meshkuj",
    women: "Femra",
    kids: "Femije",
    babies: "Bebe",
    dresses: "Fustane",
    dress: "Fustan",
    shoes: "Kepuce",
    accessories: "Aksesor",
    accessory: "Aksesor",
    bag: "Cante",
    bags: "Canta",
    jewelry: "Bizhuteri",
    suit: "Kostum",
    suits: "Kostume",
    kostume: "Kostume",
    komplete: "Komplete",
    pants: "Pantallona",
    jeans: "Xhinse",
    skirt: "Fund",
    skirts: "Funde",
    shirt: "Kemishe",
    shirts: "Kemisha",
    tops: "Bluza",
    top: "Bluze",
    blouse: "Bluze",
    tshirts: "Maica",
    hoodie: "Hoodie",
    hoodies: "Hoodie",
    jacket: "Xhakete",
    jackets: "Xhaketa",
    outerwear: "Veshje te jashtme",
    coat: "Pallto",
    coats: "Pallto",
    underwear: "Te brendshme",
    beach: "Plazh",
    black: "E zeze",
    white: "E bardhe",
    red: "E kuqe",
    blue: "Blu",
    navy: "Navy",
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

  return sqLabels[normalized] ?? formatCatalogLabel(value);
}

function getVendorGenderLabel(language: "en" | "sq") {
  return language === "sq" ? "Gjinia" : getCatalogGenderLabel();
}

function formatAccessoryTypeLabel(value: string, language: "en" | "sq") {
  const label = formatCatalogLabel(value);
  if (language !== "sq") {
    return label;
  }
  return accessoryTypeLabelsSq.get(label.trim().toLowerCase()) ?? label;
}

type ProductPhotoUploaderLabels = {
  choosePhotos: string;
  noPhotosReady: string;
  photosReady: (count: number) => string;
  selectedPhotoNames: (count: number, names: string, limited: boolean) => string;
  noPhotosSelected: string;
  duplicatePhotos: string;
  remove: string;
};

function ProductPhotoUploader({
  inputRef,
  selectedFiles,
  onFilesChange,
  labels,
}: {
  inputRef: { current: HTMLInputElement | null };
  selectedFiles: File[];
  onFilesChange: (files: File[]) => void;
  labels: ProductPhotoUploaderLabels;
}) {
  const [status, setStatus] = useState("");
  const lastSelectionKeyRef = useRef("");

  const applySelectedFiles = useCallback(
    (nextFiles: File[], reachedLimit = false) => {
      onFilesChange(nextFiles);
      setStatus(
        nextFiles.length
          ? labels.selectedPhotoNames(
              nextFiles.length,
              nextFiles.map((file) => file.name).join(", "),
              reachedLimit,
            )
          : "",
      );
    },
    [labels, onFilesChange],
  );

  const readSelectedFiles = useCallback(
    (fileList: FileList | File[] | null) => {
      const incomingFiles = Array.from(fileList ?? []);
      if (!incomingFiles.length) {
        setStatus(labels.noPhotosSelected);
        return;
      }

      const seenFileKeys = new Set(selectedFiles.map(getProductImageFileKey));
      const newFiles = incomingFiles.filter((file) => {
        const key = getProductImageFileKey(file);
        if (seenFileKeys.has(key)) {
          return false;
        }
        seenFileKeys.add(key);
        return true;
      });

      if (!newFiles.length) {
        setStatus(labels.duplicatePhotos);
        return;
      }

      const mergedFiles = [...selectedFiles, ...newFiles];
      const nextFiles = mergedFiles.slice(0, PRODUCT_IMAGE_LIMIT);
      const reachedLimit = mergedFiles.length > PRODUCT_IMAGE_LIMIT;

      applySelectedFiles(nextFiles, reachedLimit);
    },
    [applySelectedFiles, labels, selectedFiles],
  );

  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const incomingFiles = Array.from(input.files ?? []);
      const selectionKey = incomingFiles.map(getProductImageFileKey).join("|");

      if (selectionKey && selectionKey === lastSelectionKeyRef.current) {
        return;
      }

      lastSelectionKeyRef.current = selectionKey;
      readSelectedFiles(incomingFiles);
    },
    [readSelectedFiles],
  );

  useEffect(() => {
    if (selectedFiles.length === 0) {
      setStatus("");
      lastSelectionKeyRef.current = "";
    }
  }, [selectedFiles.length]);

  return (
    <>
      <input
        ref={inputRef}
        className="vendor-upload-input"
        name="images"
        type="file"
        multiple
        accept={PRODUCT_IMAGE_ACCEPT}
        data-no-translate="true"
        onInput={handleFileInput}
        onChange={handleFileInput}
      />
      <p className="vendor-upload-status" aria-live="polite">
        {selectedFiles.length ? labels.photosReady(selectedFiles.length) : labels.noPhotosReady}
      </p>
      {status ? (
        <p className="vendor-upload-status" aria-live="polite">
          {status}
        </p>
      ) : null}
      {selectedFiles.length > 0 ? (
        <div className="vendor-selected-file-list" aria-live="polite">
          {selectedFiles.map((file, index) => (
            <div key={`${file.name}-${file.lastModified}-${index}`}>
              <span>{file.name}</span>
              <button
                type="button"
                onClick={() => {
                  const nextFiles = selectedFiles.filter((_, fileIndex) => fileIndex !== index);
                  if (inputRef.current) {
                    inputRef.current.value = "";
                  }
                  applySelectedFiles(nextFiles);
                }}
              >
                {labels.remove}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

const emptyForm = {
  title: "",
  description: "",
  price: "",
  stock: "",
  brandId: "",
  categoryId: "",
  subcategoryId: "",
  genderGroupIds: [] as string[],
  colorIds: [] as string[],
  sizeTypeId: "",
  sizeIds: [] as string[],
  sizeStocks: {} as Record<string, string>,
};

const COLOR_SWATCHES: Record<string, string> = {
  beige: "#d6b98c",
  black: "#111111",
  "black-white":
    "linear-gradient(135deg, #111111 0 49%, #ffffff 50% 100%)",
  blue: "#2563eb",
  brown: "#7c4a24",
  burgundy: "#7f1d1d",
  cream: "#fff4cf",
  gold: "#d4af37",
  gray: "#8b8b8b",
  green: "#15803d",
  ivory: "#fffff0",
  multicolor:
    "linear-gradient(135deg, #ef4444 0%, #f59e0b 28%, #10b981 58%, #2563eb 100%)",
  navy: "#172554",
  olive: "#6b7d2a",
  orange: "#f97316",
  pink: "#ec4899",
  purple: "#7e22ce",
  red: "#dc2626",
  silver: "#c0c0c0",
  white: "#ffffff",
  yellow: "#facc15",
};

const COLOR_ALIASES: Record<string, string> = {
  "e-bardhe": "white",
  "e-bardhë": "white",
  "e-zezë": "black",
  "e-zeze": "black",
  "black-and-white": "black-white",
  "black/white": "black-white",
  "mixed-colors": "multicolor",
  "bardhe-e-zi": "black-white",
  "bardhë-e-zi": "black-white",
};

function getColorKey(name: string) {
  return name.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function getResolvedColorKey(name: string) {
  const key = getColorKey(name);
  return COLOR_ALIASES[key] ?? key;
}

function getColorSwatchStyle(name: string) {
  const key = getResolvedColorKey(name);
  return { background: COLOR_SWATCHES[key] ?? "#f3f4f6" };
}

function getSelectedColorOptionStyle(name: string) {
  const key = getResolvedColorKey(name);
  const background = COLOR_SWATCHES[key] ?? "#171717";
  const lightTextColors = new Set([
    "black",
    "blue",
    "brown",
    "burgundy",
    "green",
    "navy",
    "olive",
    "purple",
    "red",
  ]);
  const gradientColors = new Set(["black-white", "multicolor"]);
  const needsLightText = lightTextColors.has(key) || gradientColors.has(key);

  return {
    background,
    borderColor: "#171717",
    color: needsLightText ? "#ffffff" : "#171717",
    boxShadow: "inset 0 0 0 1px #171717, 0 6px 14px rgba(23, 23, 23, 0.1)",
    textShadow: gradientColors.has(key) ? "0 1px 2px rgba(0, 0, 0, 0.45)" : "none",
  };
}

function isShoesCategoryName(name?: string | null) {
  return name?.trim().toLowerCase() === "shoes";
}

function isAccessoriesCategoryName(name?: string | null) {
  return name?.trim().toLowerCase() === "accessories";
}

function isShoeSizeTypeName(name?: string | null) {
  const normalized = name?.trim().toLowerCase() ?? "";
  return normalized.includes("shoe") && normalized.includes("eu");
}

function getSizeTypeDisplayLabel(name?: string | null) {
  const normalized = name?.trim().toLowerCase() ?? "";
  if (normalized === "babies" || normalized === "baby") return "Bebe";
  if (normalized === "kids") return "Fëmijë";
  if (normalized === "eu") return "Të rritur";
  if (normalized === "shoe eu") return "Shoes";
  return name ?? "";
}

function isVisibleVendorSizeType(name?: string | null) {
  const normalized = name?.trim().toLowerCase() ?? "";
  return normalized !== "clothing" && normalized !== "apparel";
}

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

function getVisibleVendorActions(order: VendorOrdersResponse) {
  if (hasCustomerCancelRequest(order)) {
    return [];
  }

  return getNextVendorActions(order.status);
}

function orderNeedsVendorResponse(order: VendorOrdersResponse) {
  return order.status === "pending";
}

function canVendorCancelRequestedOrder(order: VendorOrdersResponse) {
  return (
    hasCustomerCancelRequest(order) &&
    order.status === "pending"
  );
}

function hasCustomerCancelRequest(order: VendorOrdersResponse) {
  return order.cancelRequest?.status === "requested";
}

function canVendorCancelOrder(order: VendorOrdersResponse) {
  return order.status === "pending" && order.cancelRequest?.status !== "requested";
}

function orderNeedsVendorAttention(order: VendorOrdersResponse) {
  return orderNeedsVendorResponse(order) || hasCustomerCancelRequest(order);
}

function getVendorOrderPriority(order: VendorOrdersResponse) {
  if (hasCustomerCancelRequest(order)) {
    return 0;
  }
  if (orderNeedsVendorResponse(order)) {
    return 1;
  }
  if (order.status === "confirmed") {
    return 2;
  }
  if (order.status === "shipped") {
    return 3;
  }
  return 4;
}

function getVendorCustomerLabel(order: VendorOrdersResponse) {
  return order.customerName?.trim() || "Guest checkout";
}

function getVendorCustomerPhone(order: VendorOrdersResponse) {
  return order.shippingAddress?.phoneNumber?.trim() || "";
}

function getVendorCustomerEmail(order: VendorOrdersResponse) {
  return order.customerEmail?.trim() || "";
}

function getVendorEmailSubject(order: VendorOrdersResponse) {
  return encodeURIComponent(`Vishu order ${order.orderNumber}`);
}

function getVendorEmailBody(order: VendorOrdersResponse) {
  return encodeURIComponent(
    `Hello ${getVendorCustomerLabel(order)},\n\nI am contacting you about your Vishu order ${order.orderNumber}.\n\n`,
  );
}

function getVendorDeliveryLines(order: VendorOrdersResponse) {
  const address = order.shippingAddress;
  return [
    address?.fullName || order.customerName || "Customer",
    address?.phoneNumber,
    address?.line1,
    address?.line2,
    address?.city,
    address?.stateRegion,
    address?.postalCode,
    address?.country,
  ].filter((entry): entry is string => Boolean(entry?.trim()));
}

const VISHU_LOGO_PATH = "/vishu-tab-logo.png";
const VISHU_LABEL_QR_URL = "https://vishu.shop";

function getVendorPaymentLabel(order: VendorOrdersResponse) {
  if (order.paymentMethod !== "cash_on_delivery") {
    return "Paid online";
  }

  return order.paymentStatus === "cod_collected" ? "Cash collected" : "Cash on delivery";
}

function buildVendorDeliveryLabelDetails(order: VendorOrdersResponse, shopName: string) {
  const deliveryLines = getVendorDeliveryLines(order);

  return {
    deliveryLines,
    paymentLabel: getVendorPaymentLabel(order),
    shopName,
  };
}

function buildVendorDeliveryLabel(order: VendorOrdersResponse, shopName: string) {
  const details = buildVendorDeliveryLabelDetails(order, shopName);

  return [
    "VISHU DELIVERY LABEL",
    "",
    `Order: ${order.orderNumber}`,
    `Vendor: ${details.shopName}`,
    `Payment: ${details.paymentLabel}`,
    "",
    "DELIVER TO",
    ...details.deliveryLines,
  ].join("\n");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function getImageDataUrl(path: string) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error("Could not load label image.");
  }
  const blob = await response.blob();

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read label image."));
    reader.readAsDataURL(blob);
  });
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
  productComposerMode = "modal",
}: {
  section: Exclude<VendorWorkspaceSection, "settings">;
  productComposerMode?: "modal" | "page";
}) {
  const router = useRouter();
  const { token, profile, currentRole, refreshProfile } = useAuth();
  const { language } = useLanguage();
  const t = productComposerCopy[language];
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<VendorOrdersResponse[]>([]);
  const [vendorWorkspace, setVendorWorkspace] = useState<VendorProductsResponse["vendor"] | null>(null);
  const [catalogOptions, setCatalogOptions] = useState<VendorCatalogOptions | null>(null);
  const [catalogRequests, setCatalogRequests] = useState<VendorCatalogRequest[]>([]);
  const [catalogRequestForm, setCatalogRequestForm] = useState(emptyCatalogRequestForm);
  const [form, setForm] = useState(emptyForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [primaryImageKey, setPrimaryImageKey] = useState<string>("");
  const [replaceImages, setReplaceImages] = useState(false);
  const [removedExistingImageUrls, setRemovedExistingImageUrls] = useState<string[]>([]);
  const [existingImageOrderUrls, setExistingImageOrderUrls] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productSort, setProductSort] = useState("newest");
  const [stockFilter, setStockFilter] = useState(section === "inventory" ? "low_stock" : "all");
  const [listingFilter, setListingFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkStockValue, setBulkStockValue] = useState("");
  const [orderFilter, setOrderFilter] = useState(section === "orders" ? "needs_response" : "all");
  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const productImageInputRef = useRef<HTMLInputElement | null>(null);
  const selectedProductImageFilesRef = useRef<File[]>([]);
  const productComposerActive =
    productComposerMode === "page" || productModalOpen;

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

  useEffect(() => {
    if (section !== "products" || productComposerMode !== "page") {
      return;
    }

    setEditingProductId(null);
    setForm(emptyForm);
    setFiles([]);
    selectedProductImageFilesRef.current = [];
    setExistingImageOrderUrls([]);
    if (productImageInputRef.current) {
      productImageInputRef.current.value = "";
    }
    setReplaceImages(false);
  }, [productComposerMode, section]);

  async function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    try {
      setActiveAction(editingProductId ? `save-${editingProductId}` : "create-product");
      const resolvedSubcategoryId = selectedFormSubcategory?.id ?? form.subcategoryId;
      const selectedGenderIds = form.genderGroupIds.length ? form.genderGroupIds : [""];
      const selectedSizeVariants = selectedFormIsAccessories
        ? []
        : form.sizeIds.map((sizeId) => ({
            sizeId,
            stock: Number(form.sizeStocks[sizeId] || 0),
          }));
      const resolvedStock = selectedSizeVariants.length
        ? String(
            selectedSizeVariants.reduce(
              (sum, variant) => sum + Math.max(0, Number(variant.stock || 0)),
              0,
            ),
          )
        : form.stock;
      const resolvedStockNumber = Number(resolvedStock);
      const priceNumber = Number(form.price);
      const stockRequiredMessage = t.stockRequired;
      const imageFilesForSubmission = files.length
        ? files
        : selectedProductImageFilesRef.current.length
          ? selectedProductImageFilesRef.current
          : Array.from(productImageInputRef.current?.files ?? []);
      const imageOrderChanged =
        editingProductId &&
        !replaceImages &&
        existingImageOrderUrls.length > 0 &&
        existingImageOrderUrls.join("|") !== (editingProduct?.images ?? []).join("|");
      const imageReviewRequired = Boolean(
        imageFilesForSubmission.length > 0 ||
          replaceImages ||
          removedExistingImageUrls.length > 0 ||
          imageOrderChanged,
      );

      if (!form.price.trim() || !Number.isFinite(priceNumber) || priceNumber <= 0) {
        setError(t.priceRequired);
        return;
      }

      if (!resolvedStock.trim() || !Number.isInteger(resolvedStockNumber) || resolvedStockNumber < 1) {
        setError(stockRequiredMessage);
        return;
      }

      if (!selectedFormIsAccessories && form.sizeTypeId && selectedSizeVariants.length === 0) {
        setError(stockRequiredMessage);
        return;
      }

      if (!editingProductId && imageFilesForSubmission.length === 0) {
        setError(t.selectAtLeastOnePhoto);
        return;
      }

      const buildBody = (genderGroupId: string) => {
        const body = new FormData();
        body.append("title", form.title);
        body.append("description", form.description);
        body.append("price", form.price);
        body.append("stock", resolvedStock);
        body.append("brandId", form.brandId);
        body.append("categoryId", form.categoryId);
        body.append("subcategoryId", resolvedSubcategoryId);
        if (genderGroupId) body.append("genderGroupId", genderGroupId);
        if (!selectedFormIsAccessories && form.sizeTypeId) body.append("sizeTypeId", form.sizeTypeId);
        body.append("colorIds", JSON.stringify(form.colorIds));
        body.append(
          "sizeVariants",
          JSON.stringify(selectedSizeVariants),
        );
        if (editingProductId) {
          body.append("replaceImages", String(replaceImages));
          if (!replaceImages && removedExistingImageUrls.length) {
            body.append("removedExistingImageUrls", JSON.stringify(removedExistingImageUrls));
          }
          if (!replaceImages && existingImageOrderUrls.length) {
            body.append("existingImageOrderUrls", JSON.stringify(existingImageOrderUrls));
          }
        }
        if (primaryImageKey.startsWith("upload:")) {
          body.append("primaryUploadIndex", primaryImageKey.replace("upload:", ""));
        } else if (editingProductId && !replaceImages && primaryImageKey.startsWith("existing:")) {
          body.append("primaryExistingImageUrl", primaryImageKey.slice("existing:".length));
        }
        imageFilesForSubmission.forEach((file) => body.append("images", file));
        return body;
      };

      if (editingProductId) {
        await apiRequest(
          `/products/${editingProductId}`,
          { method: "PATCH", body: buildBody(selectedGenderIds[0] ?? "") },
          token,
        );
      } else {
        for (const genderGroupId of selectedGenderIds) {
          await apiRequest(
            "/products",
            { method: "POST", body: buildBody(genderGroupId) },
            token,
          );
        }
      }
      resetProductForm();
      setMessage(
        editingProductId
          ? imageReviewRequired
            ? t.updatedForReview
            : t.updated
          : selectedGenderIds.length > 1
            ? `${selectedGenderIds.length} ${language === "sq" ? "produkte u derguan per shqyrtim nga admini." : "product listings sent for admin review."}`
            : t.sentForReview,
      );
      await loadWorkspace();
      if (productComposerMode === "page") {
        router.push("/vendor/products");
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save product.");
    } finally {
      setActiveAction(null);
    }
  }

  async function submitCatalogRequest(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!token) return;

    try {
      setActiveAction("catalog-request");
      setMessage(null);
      setError(null);
      const requestType = catalogRequestForm.requestType;
      const accessoryCategory = availableFormCategories.find((entry) =>
        isAccessoriesCategoryName(entry.name),
      );
      const response = await apiRequest<{
        message: string;
        requests: VendorCatalogRequest[];
      }>(
        "/products/vendor/catalog-requests",
        {
          method: "POST",
          body: JSON.stringify({
            requestType,
            requestedValue: catalogRequestForm.requestedValue,
            note: catalogRequestForm.note || undefined,
            categoryId:
              requestType === "subcategory"
                ? accessoryCategory?.id || selectedFormCategory?.id || form.categoryId || undefined
                : requestType === "category"
                  ? form.categoryId || undefined
                  : undefined,
            subcategoryId:
              requestType === "subcategory"
                ? selectedFormSubcategory?.id || form.subcategoryId || undefined
                : undefined,
            sizeTypeId: requestType === "size" ? form.sizeTypeId || undefined : undefined,
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

  async function toggleProductListing(product: Product, isListed: boolean) {
    if (!token) return;
    const requestsAdminReview = isListed && product.adminStatus !== "approved";
    try {
      setActiveAction(`listing-${product.id}`);
      await apiRequest(
        `/products/${product.id}/listing`,
        { method: "PATCH", body: JSON.stringify({ isListed }) },
        token,
      );
      setMessage(
        requestsAdminReview
          ? "Product sent to admin for review."
          : isListed
            ? "Product is visible in the shop."
            : "Product hidden from the public shop.",
      );
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
    const nextStock = Number(bulkStockValue);
    if (!Number.isInteger(nextStock) || nextStock < 1) {
      setError(
        language === "sq"
          ? "Stoku nuk mund te jete 0. Shkruani sa cope keni ne stok."
          : "Stock can't be 0. Enter how many pieces you have in stock.",
      );
      return;
    }

    try {
      setActiveAction("bulk-stock");
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
      await apiRequest(
        `/vendor/orders/${orderId}/status`,
        { method: "PATCH", body: JSON.stringify({ status }) },
        token,
      );
      setMessage("Order status updated.");
      await loadWorkspace();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Status update failed.");
    } finally {
      setActiveAction(null);
    }
  }

  async function cancelRequestedOrder(orderId: string) {
    if (!token) return;
    if (!window.confirm("Approve the customer's cancellation request and notify them?")) {
      return;
    }

    try {
      setActiveAction(`order-${orderId}-cancel`);
      await apiRequest(
        `/vendor/orders/${orderId}/cancel-request`,
        { method: "PATCH" },
        token,
      );
      setMessage("Customer cancellation approved and customer notified.");
      await loadWorkspace();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Customer cancellation approval failed.");
    } finally {
      setActiveAction(null);
    }
  }

  async function cancelVendorOrder(orderId: string) {
    if (!token) return;

    const reason = window.prompt(
      "Why are you cancelling this order? Example: wrong address, unreachable customer, incorrect email.",
      "",
    );
    if (reason === null) {
      return;
    }

    if (!window.confirm("Cancel this pending order and restock inventory?")) {
      return;
    }

    try {
      setActiveAction(`order-${orderId}-vendor-cancel`);
      setMessage(null);
      setError(null);
      const response = await apiRequest<{ message: string }>(
        `/vendor/orders/${orderId}/cancel`,
        {
          method: "PATCH",
          body: JSON.stringify({ reason: reason.trim() || undefined }),
        },
        token,
      );
      setMessage(response.message);
      await loadWorkspace();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Order cancellation failed.");
    } finally {
      setActiveAction(null);
    }
  }

  async function printDeliveryLabel(order: VendorOrdersResponse) {
    const labelText = buildVendorDeliveryLabel(order, vendorShopName);
    let qrDataUrl = "";
    try {
      const QRCode = await import("qrcode");
      qrDataUrl = await QRCode.toDataURL(VISHU_LABEL_QR_URL, {
        margin: 1,
        width: 160,
        errorCorrectionLevel: "M",
      });
    } catch {
      qrDataUrl = "";
    }

    const printWindow = window.open("", "_blank", "width=480,height=720");
    if (!printWindow) {
      setError("Could not open print window. Allow popups and try again.");
      return;
    }

    printWindow.document.write(`<!doctype html>
<html>
<head>
  <title>${order.orderNumber} delivery label</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #111; }
    .label { border: 2px solid #111; padding: 18px; max-width: 420px; }
    .label-head { align-items: center; border-bottom: 1px solid #111; display: flex; justify-content: space-between; margin-bottom: 14px; padding-bottom: 12px; }
    .brand { align-items: center; display: flex; gap: 10px; }
    .brand img { height: 56px; width: 56px; object-fit: contain; }
    .qr { text-align: center; }
    .qr img { height: 72px; width: 72px; }
    h1 { font-size: 18px; margin: 0 0 14px; letter-spacing: 0.04em; }
    pre { white-space: pre-wrap; font: 14px/1.45 Arial, sans-serif; margin: 0; }
    @media print { body { padding: 0; } .label { border-width: 1px; } }
  </style>
</head>
<body>
  <div class="label">
    <div class="label-head">
      <div class="brand">
        <img src="${VISHU_LOGO_PATH}" alt="Vishu logo" />
      </div>
      ${qrDataUrl ? `<div class="qr"><img src="${qrDataUrl}" alt="Vishu QR code" /></div>` : ""}
    </div>
    <h1>Delivery label</h1>
    <pre>${escapeHtml(labelText)}</pre>
  </div>
  <script>window.print(); window.onafterprint = () => window.close();</script>
</body>
</html>`);
    printWindow.document.close();
  }

  async function downloadDeliveryLabel(order: VendorOrdersResponse) {
    try {
      const [{ jsPDF }, QRCode] = await Promise.all([import("jspdf"), import("qrcode")]);
      const details = buildVendorDeliveryLabelDetails(order, vendorShopName);
      const [logoDataUrl, qrDataUrl] = await Promise.all([
        getImageDataUrl(VISHU_LOGO_PATH),
        QRCode.toDataURL(VISHU_LABEL_QR_URL, {
          margin: 1,
          width: 220,
          errorCorrectionLevel: "M",
        }),
      ]);
      const pdf = new jsPDF({ unit: "mm", format: "a6", orientation: "portrait" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 10;
      let y = 12;

      pdf.setDrawColor(17, 17, 17);
      pdf.setLineWidth(0.4);
      pdf.rect(6, 6, pageWidth - 12, 136);
      pdf.addImage(logoDataUrl, "PNG", margin, y, 18, 18);
      pdf.addImage(qrDataUrl, "PNG", pageWidth - margin - 22, y, 22, 22);

      y += 30;
      pdf.line(margin, y, pageWidth - margin, y);
      y += 8;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text("Delivery label", margin, y);
      y += 8;

      pdf.setFontSize(9);
      pdf.text(`Order: ${order.orderNumber}`, margin, y);
      y += 5;
      pdf.text(`Vendor: ${details.shopName}`, margin, y);
      y += 5;
      pdf.text(`Payment: ${details.paymentLabel}`, margin, y);
      y += 8;

      pdf.setFontSize(10);
      pdf.text("DELIVER TO", margin, y);
      y += 6;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      details.deliveryLines.forEach((line) => {
        pdf.splitTextToSize(line, pageWidth - margin * 2).forEach((wrappedLine: string) => {
          pdf.text(wrappedLine, margin, y);
          y += 5;
        });
      });

      pdf.save(`${order.orderNumber}-delivery-label.pdf`);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Could not create delivery label PDF.",
      );
    }
  }

  const vendorShopName = vendorWorkspace?.shop_name ?? profile?.vendor?.shop_name ?? "Your Shop";
  const vendorAccessRole = profile?.vendor?.access_role ?? "shop_holder";
  const vendorCanViewFinance = vendorAccessRole !== "employee";
  const vendorVerified = vendorWorkspace?.is_verified ?? profile?.vendor?.is_verified ?? false;
  const vendorActive = vendorWorkspace?.is_active ?? profile?.vendor?.is_active ?? false;
  const vendorCanManageCatalog = vendorVerified;
  const lowStockThreshold = vendorWorkspace?.low_stock_threshold ?? 5;
  const vendorLastActivity = vendorWorkspace?.last_activity_at
    ? new Date(vendorWorkspace.last_activity_at).toLocaleString()
    : "No activity recorded";
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
          adminStatus: product.adminStatus ?? "approved",
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

  function getVendorProductVisibilityLabel(product: Product) {
    if (product.adminStatus === "blocked") return "Blocked by admin";
    if (product.adminStatus === "under_review") return "Waiting admin review";
    return product.isListed ? "Listed" : "Hidden";
  }

  function getVendorProductListingActionLabel(product: Product) {
    if (activeAction === `listing-${product.id}`) return "Saving...";
    if (product.adminStatus === "under_review") return "Waiting review";
    if (product.adminStatus !== "approved" && !product.isListed) return "Request review";
    return product.isListed ? "Hide" : "Show";
  }

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
    () =>
      orders
        .filter((order) => {
          if (orderFilter === "needs_response") {
            return orderNeedsVendorAttention(order);
          }
          return orderFilter === "all" || order.status === orderFilter;
        })
        .sort(
          (left, right) =>
            getVendorOrderPriority(left) - getVendorOrderPriority(right) ||
            new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
        ),
    [orderFilter, orders],
  );
  const pendingResponseOrders = useMemo(
    () =>
      orders
        .filter(orderNeedsVendorAttention)
        .sort(
          (left, right) =>
            getVendorOrderPriority(left) - getVendorOrderPriority(right) ||
            new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
        ),
    [orders],
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
  const visibleFormSizeTypes = useMemo(
    () => availableFormSizeTypes.filter((entry) => isVisibleVendorSizeType(entry.name)),
    [availableFormSizeTypes],
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
  const selectedFormGenderGroups = useMemo(
    () => availableGenderGroups.filter((entry) => form.genderGroupIds.includes(entry.id)),
    [availableGenderGroups, form.genderGroupIds],
  );
  const selectedFormCategory = useMemo(
    () => availableFormCategories.find((entry) => entry.id === form.categoryId) ?? null,
    [availableFormCategories, form.categoryId],
  );
  const shoeSizeType = useMemo(
    () =>
      availableFormSizeTypes.find((entry) => isShoeSizeTypeName(entry.name)) ??
      null,
    [availableFormSizeTypes],
  );
  const defaultSizeType = useMemo(
    () =>
      visibleFormSizeTypes.find(
        (entry) => entry.name.trim().toLowerCase() === "eu",
      ) ??
      visibleFormSizeTypes[0] ??
      null,
    [visibleFormSizeTypes],
  );
  const selectedFormIsShoes = isShoesCategoryName(selectedFormCategory?.name);
  const selectedFormIsAccessories = isAccessoriesCategoryName(selectedFormCategory?.name);
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
    () => availableFormSizes.find((entry) => entry.id === form.sizeIds[0]) ?? null,
    [availableFormSizes, form.sizeIds],
  );
  const selectedFormSizes = useMemo(
    () => availableFormSizes.filter((entry) => form.sizeIds.includes(entry.id)),
    [availableFormSizes, form.sizeIds],
  );
  const selectedSizeTotalStock = useMemo(
    () =>
      form.sizeIds.reduce(
        (sum, sizeId) => sum + Math.max(0, Number(form.sizeStocks[sizeId] || 0)),
        0,
      ),
    [form.sizeIds, form.sizeStocks],
  );
  const selectedFilePreviews = useMemo(() => {
    return files.map((file, index) => ({
      key: `upload:${index}`,
      name: file.name,
      canPreview: isBrowserPreviewableProductImage(file),
      url: URL.createObjectURL(file),
    }));
  }, [files]);

  useEffect(() => {
    return () => {
      selectedFilePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [selectedFilePreviews]);

  useEffect(() => {
    selectedProductImageFilesRef.current = files;
  }, [files]);

  useEffect(() => {
    if (!productComposerActive) {
      return;
    }

    const existingPrimaryKey =
      editingProduct && !replaceImages
        ? editingProduct.images
            .filter((image) => !removedExistingImageUrls.includes(image))
            .map((image) => `existing:${image}`)[0] ?? ""
        : "";
    const uploadPrimaryKey = files.length ? "upload:0" : "";
    const validKeys = new Set([
      ...(editingProduct && !replaceImages
        ? editingProduct.images
            .filter((image) => !removedExistingImageUrls.includes(image))
            .map((image) => `existing:${image}`)
        : []),
      ...files.map((_, index) => `upload:${index}`),
    ]);

    if (!primaryImageKey || !validKeys.has(primaryImageKey)) {
      setPrimaryImageKey(existingPrimaryKey || uploadPrimaryKey);
    }
  }, [editingProduct, files, primaryImageKey, productComposerActive, removedExistingImageUrls, replaceImages]);

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
      setForm((current) => ({ ...current, sizeTypeId: "", sizeIds: [] }));
    }
  }, [availableFormSizeTypes, form.sizeTypeId]);

  useEffect(() => {
    if (selectedFormIsShoes && shoeSizeType && form.sizeTypeId !== shoeSizeType.id) {
      setForm((current) => ({
        ...current,
        sizeTypeId: shoeSizeType.id,
        sizeIds: [],
        sizeStocks: {},
      }));
    }
  }, [form.sizeTypeId, selectedFormIsShoes, shoeSizeType]);

  useEffect(() => {
    if (selectedFormIsShoes || selectedFormIsAccessories || form.sizeTypeId || !defaultSizeType) {
      return;
    }

    setForm((current) => ({
      ...current,
      sizeTypeId: defaultSizeType.id,
      sizeIds: [],
      sizeStocks: {},
    }));
  }, [defaultSizeType, form.sizeTypeId, selectedFormIsAccessories, selectedFormIsShoes]);

  useEffect(() => {
    if (
      selectedFormIsAccessories &&
      (form.sizeTypeId || form.sizeIds.length || Object.keys(form.sizeStocks).length)
    ) {
      setForm((current) => ({
        ...current,
        sizeTypeId: "",
        sizeIds: [],
        sizeStocks: {},
      }));
    }
  }, [form.sizeIds, form.sizeStocks, form.sizeTypeId, selectedFormIsAccessories]);

  useEffect(() => {
    const availableIds = new Set(availableFormSizes.map((entry) => entry.id));
    if (form.sizeIds.some((id) => !availableIds.has(id))) {
      setForm((current) => ({
        ...current,
        sizeIds: current.sizeIds.filter((id) => availableIds.has(id)),
        sizeStocks: Object.fromEntries(
          Object.entries(current.sizeStocks).filter(([id]) =>
            availableIds.has(id),
          ),
        ),
      }));
    }
  }, [availableFormSizes, form.sizeIds, form.sizeStocks]);

  useEffect(() => {
    if (categoryFilter !== "all" && !vendorCategories.includes(categoryFilter)) {
      setCategoryFilter("all");
    }
  }, [categoryFilter, vendorCategories]);

  useEffect(() => {
    if (!productModalOpen || productComposerMode === "page") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        resetProductForm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [productModalOpen, productComposerMode]);

  useEffect(() => {
    setSelectedProductIds((current) =>
      current.filter((productId) => products.some((product) => product.id === productId)),
    );
  }, [products]);

  function resetProductForm() {
    setEditingProductId(null);
    setForm(emptyForm);
    setFiles([]);
    selectedProductImageFilesRef.current = [];
    if (productImageInputRef.current) {
      productImageInputRef.current.value = "";
    }
    setPrimaryImageKey("");
    setReplaceImages(false);
    setRemovedExistingImageUrls([]);
    setExistingImageOrderUrls([]);
    setProductModalOpen(false);
  }

  function startEditProduct(product: Product) {
    setEditingProductId(product.id);
    setProductModalOpen(true);
    setFiles([]);
    selectedProductImageFilesRef.current = [];
    if (productImageInputRef.current) {
      productImageInputRef.current.value = "";
    }
    setPrimaryImageKey(product.images[0] ? `existing:${product.images[0]}` : "");
    setReplaceImages(false);
    setRemovedExistingImageUrls([]);
    setExistingImageOrderUrls(product.images);
    setForm({
      title: product.title,
      description: product.description,
      price: String(product.price),
      stock: String(product.stock),
      brandId: product.brand?.id ?? "",
      categoryId: product.categoryRef?.id ?? "",
      subcategoryId: product.subcategory?.id ?? "",
      genderGroupIds: product.genderGroup?.id ? [product.genderGroup.id] : [],
      colorIds: product.colors.map((entry) => entry.id),
      sizeTypeId: product.sizeVariants[0]?.sizeTypeId ?? "",
      sizeIds: product.sizeVariants.map((entry) => entry.id),
      sizeStocks: Object.fromEntries(
        product.sizeVariants.map((entry) => [entry.id, String(entry.stock)]),
      ),
    });
  }

  const copy = getWorkspaceCopy(section);

  function handleProductImageFilesChange(nextFiles: File[]) {
    selectedProductImageFilesRef.current = nextFiles;
    setFiles(nextFiles);
    setPrimaryImageKey((current) => {
      if (current.startsWith("existing:") && editingProductId && !replaceImages) {
        return current;
      }
      return current || (nextFiles.length ? "upload:0" : "");
    });
    setError(null);
  }

  function moveSelectedProductImage(fromIndex: number, toIndex: number) {
    setFiles((current) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= current.length ||
        toIndex >= current.length
      ) {
        return current;
      }

      const nextFiles = [...current];
      const [movedFile] = nextFiles.splice(fromIndex, 1);
      nextFiles.splice(toIndex, 0, movedFile);
      selectedProductImageFilesRef.current = nextFiles;
      return nextFiles;
    });
    setPrimaryImageKey("upload:0");
    setError(null);
  }

  function selectUploadedThumbnail(index: number) {
    if (index === 0) {
      setPrimaryImageKey("upload:0");
      return;
    }

    moveSelectedProductImage(index, 0);
  }

  function moveExistingProductImage(fromIndex: number, toIndex: number) {
    setExistingImageOrderUrls((current) => {
      const visibleImages = current.filter(
        (image) => !removedExistingImageUrls.includes(image),
      );

      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= visibleImages.length ||
        toIndex >= visibleImages.length
      ) {
        return current;
      }

      const nextVisibleImages = [...visibleImages];
      const [movedImage] = nextVisibleImages.splice(fromIndex, 1);
      nextVisibleImages.splice(toIndex, 0, movedImage);
      setPrimaryImageKey(nextVisibleImages[0] ? `existing:${nextVisibleImages[0]}` : "");
      return [
        ...nextVisibleImages,
        ...current.filter((image) => removedExistingImageUrls.includes(image)),
      ];
    });
    setError(null);
  }

  function selectExistingThumbnail(imageUrl: string) {
    setExistingImageOrderUrls((current) => {
      const visibleImages = current.filter(
        (image) => !removedExistingImageUrls.includes(image),
      );
      return [
        imageUrl,
        ...visibleImages.filter((image) => image !== imageUrl),
        ...current.filter((image) => removedExistingImageUrls.includes(image)),
      ];
    });
    setPrimaryImageKey(`existing:${imageUrl}`);
  }

  function removeSelectedProductImage(indexToRemove: number) {
    setFiles((current) => {
      const nextFiles = current.filter((_, index) => index !== indexToRemove);
      selectedProductImageFilesRef.current = nextFiles;
      if (!nextFiles.length && productImageInputRef.current) {
        productImageInputRef.current.value = "";
      }
      return nextFiles;
    });
    setPrimaryImageKey((current) => {
      if (!current.startsWith("upload:")) {
        return current;
      }
      const currentIndex = Number(current.replace("upload:", ""));
      if (Number.isNaN(currentIndex)) {
        return "";
      }
      if (currentIndex === indexToRemove) {
        const nextUploadCount = selectedProductImageFilesRef.current.length;
        return nextUploadCount ? "upload:0" : "";
      }
      if (currentIndex > indexToRemove) {
        return `upload:${currentIndex - 1}`;
      }
      return current;
    });
  }

  function removeExistingProductImage(imageUrl: string) {
    if (!editingProduct || replaceImages) {
      return;
    }

    const remainingImages = editingProduct.images.filter(
      (image) => image !== imageUrl && !removedExistingImageUrls.includes(image),
    );

    if (remainingImages.length + files.length === 0) {
      setError("Keep at least one product image or upload a replacement.");
      return;
    }

    setError(null);
    setRemovedExistingImageUrls((current) =>
      current.includes(imageUrl) ? current : [...current, imageUrl],
    );
    setExistingImageOrderUrls((current) => current.filter((image) => image !== imageUrl));
    setPrimaryImageKey((current) => {
      if (current !== `existing:${imageUrl}`) {
        return current;
      }
      return remainingImages[0] ? `existing:${remainingImages[0]}` : files.length ? "upload:0" : "";
    });
  }

  function isBrowserPreviewableProductImage(file: File) {
    return ["image/avif", "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"].includes(file.type);
  }
  const renderVendorOrderCard = (order: VendorOrdersResponse, options?: { compact?: boolean }) => {
    const customerPhone = getVendorCustomerPhone(order);
    const customerEmail = getVendorCustomerEmail(order);
    const deliveryLines = getVendorDeliveryLines(order);
    const visibleActions = getVisibleVendorActions(order);
    const hasCancellationRequest = hasCustomerCancelRequest(order);
    const canApproveCancellation = canVendorCancelRequestedOrder(order);
    const canCancelOrder = canVendorCancelOrder(order);

    return (
      <div key={order.id} className={orderNeedsVendorAttention(order) ? "card vendor-response-order-card" : "card"}>
        <div className="inline-actions" style={{ justifyContent: "space-between" }}>
          <div>
            <strong>{order.orderNumber}</strong>
            <p className="muted">{getVendorCustomerLabel(order)}</p>
            <p className="muted">{new Date(order.createdAt).toLocaleString()}</p>
            <p className="muted">
              {order.paymentMethod === "cash_on_delivery" ? "Cash on delivery" : "Paid online"} | {order.paymentStatus === "cod_pending" ? "Collect on arrival" : order.paymentStatus === "cod_collected" ? "Cash collected" : order.paymentStatus === "cod_refused" ? "Delivery refused" : "Already paid"}
            </p>
          </div>
          <div className="chip-row">
            {orderNeedsVendorResponse(order) ? <span className="badge warn">Needs response</span> : null}
            <StatusBadge status={order.status} />
            {vendorCanViewFinance ? <span className="chip">{formatCurrency(order.totalPrice)}</span> : null}
            {order.cancelRequest?.status === "requested" ? <span className="badge warn">Cancel requested</span> : null}
          </div>
        </div>

        {!options?.compact ? (
          <div className="order-line">
            <div>
              <strong>Customer contact</strong>
              <p className="muted">
                {customerPhone ? `Phone: ${customerPhone}` : "Phone not provided"}
                {customerEmail ? ` | Email: ${customerEmail}` : ""}
              </p>
              {deliveryLines.length > 0 ? <p className="muted">Delivery: {deliveryLines.join(", ")}</p> : null}
              {order.specialRequest ? <p className="muted">Customer note: {order.specialRequest}</p> : null}
              {order.cancelRequest?.status === "requested" && order.cancelRequest.note ? (
                <p className="muted">Cancel note: {order.cancelRequest.note}</p>
              ) : null}
            </div>
            <div className="inline-actions">
              {customerPhone ? (
                <a className="button-ghost" href={`tel:${customerPhone}`}>
                  Call customer
                </a>
              ) : null}
              {customerEmail ? (
                <a
                  className="button-ghost"
                  href={`mailto:${customerEmail}?subject=${getVendorEmailSubject(order)}&body=${getVendorEmailBody(order)}`}
                >
                  Reply by email
                </a>
              ) : null}
              {!customerPhone && !customerEmail ? <span className="muted">No direct contact saved.</span> : null}
            </div>
          </div>
        ) : null}

        {!options?.compact
          ? order.items.map((item) => (
              <div key={item.id} className="order-line">
                <div>
                  <strong>{item.product.title}</strong>
                  <p className="muted">
                    {item.product.productCode ? `${item.product.productCode} | ` : ""}
                    {item.quantity} x {formatCurrency(item.unitPrice)}
                    {vendorCanViewFinance ? ` | earnings ${formatCurrency(item.vendorEarnings)}` : ""}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))
          : null}
        <div className="inline-actions">
          {visibleActions.length === 0 && !canApproveCancellation && !canCancelOrder ? (
            <span className="muted">
              {hasCancellationRequest
                ? "Customer requested cancellation. Do not ship this order; contact the customer or admin before continuing."
                : "This order does not need a next status action."}
            </span>
          ) : null}
          {visibleActions.map((action) => (
            <button
              key={action.value}
              className={action.tone}
              type="button"
              disabled={activeAction !== null}
              onClick={() => updateOrderStatus(order.id, action.value)}
            >
              {activeAction === `order-${order.id}-${action.value}` ? "Saving..." : action.label}
            </button>
          ))}
          {canApproveCancellation ? (
            <button
              className="danger-button"
              type="button"
              disabled={activeAction !== null}
              onClick={() => void cancelRequestedOrder(order.id)}
            >
              {activeAction === `order-${order.id}-cancel` ? "Approving..." : "Approve customer cancellation"}
            </button>
          ) : null}
          {canCancelOrder ? (
            <button
              className="danger-button"
              type="button"
              disabled={activeAction !== null}
              onClick={() => void cancelVendorOrder(order.id)}
            >
              {activeAction === `order-${order.id}-vendor-cancel` ? "Cancelling..." : "Cancel order"}
            </button>
          ) : null}
          {!hasCancellationRequest ? (
            <>
              <button
                className="button-ghost"
                type="button"
                onClick={() => void printDeliveryLabel(order)}
              >
                Print label
              </button>
              <button
                className="button-ghost"
                type="button"
                onClick={() => void downloadDeliveryLabel(order)}
              >
                Download PDF
              </button>
            </>
          ) : null}
        </div>
      </div>
    );
  };

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
              <div className="card vendor-overview-card"><span>Needs response</span><strong>{pendingResponseOrders.length}</strong><p>Orders waiting for confirmation, shipping, or a cancel decision.</p></div>
              <div className="card vendor-overview-card"><span>Total orders</span><strong>{totalOrders}</strong><p>All marketplace orders that included your products.</p></div>
              {vendorCanViewFinance ? <div className="card vendor-overview-card"><span>Revenue</span><strong>{formatCurrency(projectedRevenue)}</strong><p>Tracked vendor earnings from your order items.</p></div> : null}
              <div className="card vendor-overview-card"><span>Low stock alerts</span><strong>{lowStockProducts.length}</strong><p>Products that need inventory attention soon.</p></div>
              <div className="card vendor-overview-card"><span>Listed products</span><strong>{products.length}</strong><p>Current catalog size in your store.</p></div>
              <div className="card vendor-overview-card"><span>Inventory units</span><strong>{inventoryUnits}</strong><p>Total sellable units across your catalog.</p></div>
              <div className="card vendor-overview-card"><span>Last activity</span><strong>{vendorLastActivity}</strong><p>Your latest recorded vendor workspace activity.</p></div>
            </div>
            {pendingResponseOrders.length > 0 ? (
              <section className="form-card stack vendor-response-section">
                <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h2 className="section-title">Orders waiting for your response</h2>
                    <p className="muted">Cancel requests stay at the top and pause shipping actions until the request is handled.</p>
                  </div>
                  <span className="chip">{pendingResponseOrders.length} waiting</span>
                </div>
                {pendingResponseOrders.slice(0, 4).map((order) => renderVendorOrderCard(order, { compact: true }))}
              </section>
            ) : null}
            <div className="vendor-section-grid">
              <section className="form-card stack">
                <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}><h2 className="section-title">Recent activity</h2><span className="chip">{recentOrders.length}</span></div>
                {recentOrders.length === 0 ? <div className="empty">No order activity yet.</div> : recentOrders.map((order) => <div key={order.id} className="vendor-activity-row"><div><strong>{getVendorCustomerLabel(order)}</strong><p className="muted">{new Date(order.createdAt).toLocaleString()}</p></div><div className="chip-row"><StatusBadge status={order.status} />{vendorCanViewFinance ? <span className="chip">{formatCurrency(order.totalPrice)}</span> : null}</div></div>)}
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
            {productComposerMode !== "page" ? (
            <section className="form-card vendor-products-head">
              <div>
                <h2 className="section-title">{t.products}</h2>
                <p className="muted">{t.productsIntro}</p>
              </div>
              <Link className="button" href="/vendor/products/new">
                {t.addProduct}
              </Link>
            </section>
            ) : null}

            {productComposerActive ? (
              <div
                className={
                  productComposerMode === "page"
                    ? "vendor-product-page-composer"
                    : "vendor-product-modal-backdrop"
                }
                role="presentation"
                onMouseDown={(event) => {
                  if (productComposerMode !== "page" && event.target === event.currentTarget) {
                    resetProductForm();
                  }
                }}
              >
                <div
                  className={
                    productComposerMode === "page"
                      ? "vendor-product-page-composer-inner"
                      : "vendor-product-modal"
                  }
                  role="dialog"
                  aria-modal="true"
                  aria-label={editingProductId ? t.editProduct : t.addProduct}
                  onClick={(event) => event.stopPropagation()}
                >
                  <form className="form-card vendor-product-composer" onSubmit={submitProduct}>
              <div className="vendor-product-composer-header">
                <div className="vendor-product-composer-copy">
                  <div className="vendor-product-composer-kicker">{t.productStudio}</div>
                  <h2 className="section-title">
                    {editingProductId ? t.refineProduct : t.createListing}
                  </h2>
                </div>
                <div className="vendor-product-composer-badges">
                  <span className={editingProductId ? "badge warn" : "badge"}>
                    {editingProductId ? t.editing : t.newListing}
                  </span>
                  <span className="chip">
                    {selectedFilePreviews.length > 0
                      ? t.selected(selectedFilePreviews.length)
                      : editingProduct?.images.length
                        ? t.saved(editingProduct.images.length)
                        : t.noImagesYet}
                  </span>
                </div>
              </div>
              {!vendorVerified ? (
                <div className="message error">
                  {t.verifyVendorEmail}
                </div>
              ) : null}
              {vendorVerified && !vendorActive ? (
                <div className="message">
                  {t.vendorPending}
                </div>
              ) : null}
              {error ? <div className="message error">{error}</div> : null}
              <div className="vendor-product-composer-layout">
                <div className="vendor-product-composer-main">
                  <section className="vendor-product-composer-section">
                    <div className="vendor-product-composer-section-head">
                      <span className="vendor-product-composer-step">01</span>
                      <div>
                        <h3>{t.coreDetails}</h3>
                      </div>
                    </div>
                    <div className="field">
                      <label>{t.title}</label>
                      <input
                        value={form.title}
                        placeholder={t.titlePlaceholder}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, title: event.target.value }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label>{t.description}</label>
                      <textarea
                        value={form.description}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, description: event.target.value }))
                        }
                      />
                    </div>
                    <div className="form-grid two">
                      <div className="field">
                        <label>{t.price}</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0.00"
                          value={form.price}
                          required
                          onChange={(event) =>
                            setForm((current) => ({ ...current, price: event.target.value }))
                          }
                        />
                      </div>
                      <div className="field">
                        <label>{form.sizeIds.length ? t.totalStock : t.stock}</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="1"
                          value={
                            form.sizeIds.length
                              ? String(selectedSizeTotalStock)
                              : form.stock
                          }
                          disabled={form.sizeIds.length > 0}
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
                        <h3>{t.catalogSetup}</h3>
                      </div>
                    </div>
                    <div className="form-grid two">
                      <div className="field">
                        <label>{t.brand}</label>
                        <select
                          value={form.brandId}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, brandId: event.target.value }))
                          }
                        >
                          <option value="">{t.selectBrand}</option>
                          {availableBrands.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>{getVendorGenderLabel(language)}</label>
                        <div className="vendor-choice-grid" role="group" aria-label={t.productGenders}>
                          {availableGenderGroups.map((entry) => {
                            const selected = form.genderGroupIds.includes(entry.id);
                            return (
                              <button
                                key={entry.id}
                                type="button"
                                className={`vendor-choice-option${selected ? " selected" : ""}`}
                                aria-pressed={selected}
                                onClick={() =>
                                  setForm((current) => ({
                                    ...current,
                                    genderGroupIds: selected
                                      ? current.genderGroupIds.filter((id) => id !== entry.id)
                                      : [...current.genderGroupIds, entry.id],
                                  }))
                                }
                              >
                                {language === "sq"
                                  ? formatVendorCatalogLabel(entry.name, language)
                                  : getCatalogDepartmentDisplayLabel(entry.name) || formatCatalogLabel(entry.name)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="form-grid two">
                      <div className="field">
                        <label>{t.category}</label>
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
                          <option value="">{t.selectCategory}</option>
                          {availableFormCategories.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {formatVendorCatalogLabel(entry.name, language)}
                            </option>
                          ))}
                        </select>
                      </div>
                      {selectedFormIsAccessories ? (
                        <div className="field">
                          <label>{t.accessoryType}</label>
                          <select
                            value={form.subcategoryId}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                subcategoryId: event.target.value,
                              }))
                            }
                          >
                            {availableFormSubcategories.map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {formatAccessoryTypeLabel(entry.name, language)}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </div>
                    <div className="vendor-catalog-request-card">
                      <div>
                        <strong>{t.missing}</strong>
                        <p className="muted">{t.missingHint}</p>
                      </div>
                      <div className="form-grid two">
                        <div className="field">
                          <label>{t.missing}</label>
                          <select
                            value={catalogRequestForm.requestType}
                            onChange={(event) =>
                              setCatalogRequestForm((current) => ({
                                ...current,
                                requestType: event.target.value as VendorCatalogRequest["requestType"],
                              }))
                            }
                          >
                            <option value="brand">{t.brand}</option>
                            <option value="category">{t.category}</option>
                            <option value="subcategory">{t.accessoryType}</option>
                            <option value="color">{t.colors}</option>
                          </select>
                        </div>
                        <div className="field">
                          <label>{t.missingValue}</label>
                          <input
                            value={catalogRequestForm.requestedValue}
                            onChange={(event) =>
                              setCatalogRequestForm((current) => ({
                                ...current,
                                requestedValue: event.target.value,
                              }))
                            }
                            placeholder={t.missingPlaceholder}
                          />
                        </div>
                      </div>
                      <div className="inline-actions">
                        <button
                          className="button-secondary"
                          type="button"
                          disabled={activeAction !== null || !catalogRequestForm.requestedValue.trim()}
                          onClick={() => void submitCatalogRequest()}
                        >
                          {activeAction === "catalog-request" ? t.submitting : t.submitRequest}
                        </button>
                        <span className="chip">{t.requests(catalogRequests.length)}</span>
                      </div>
                    </div>
                  </section>

                  <section className="vendor-product-composer-section">
                    <div className="vendor-product-composer-section-head">
                      <span className="vendor-product-composer-step">03</span>
                      <div>
                        <h3>{t.colorAndSize}</h3>
                      </div>
                    </div>
                    <div className="form-grid two">
                      <div className="field">
                        <label>{t.colors}</label>
                        <div className="vendor-color-grid" role="group" aria-label={t.productColors}>
                          {availableFormColors.map((entry) => {
                            const selected = form.colorIds.includes(entry.id);
                            const colorKey = getResolvedColorKey(entry.name);
                            return (
                              <button
                                key={entry.id}
                                type="button"
                                className={`vendor-color-option${selected ? " selected" : ""}${colorKey === "white" ? " white" : ""}${colorKey === "black" ? " black" : ""}`}
                                style={selected ? getSelectedColorOptionStyle(entry.name) : undefined}
                                aria-pressed={selected}
                                onClick={() =>
                                  setForm((current) => ({
                                    ...current,
                                    colorIds: selected
                                      ? current.colorIds.filter((id) => id !== entry.id)
                                      : [...current.colorIds, entry.id],
                                  }))
                                }
                              >
                                <span
                                  className="vendor-color-swatch"
                                  style={getColorSwatchStyle(entry.name)}
                                  aria-hidden="true"
                                />
                                <span>{formatVendorCatalogLabel(entry.name, language)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {!selectedFormIsAccessories ? (
                        <div className="field vendor-size-type-field">
                          <label>{t.sizeType}</label>
                          <div className="vendor-choice-grid" role="group" aria-label={t.productSizeType}>
                            {visibleFormSizeTypes.map((entry) => {
                              const selected = form.sizeTypeId === entry.id;
                              return (
                                <button
                                  key={entry.id}
                                  type="button"
                                  className={`vendor-choice-option${selected ? " selected" : ""}`}
                                  aria-pressed={selected}
                                  disabled={selectedFormIsShoes}
                                  onClick={() =>
                                    setForm((current) => ({
                                      ...current,
                                      sizeTypeId: entry.id,
                                      sizeIds: [],
                                      sizeStocks: {},
                                    }))
                                  }
                                >
                                  {language === "sq" ? formatVendorCatalogLabel(entry.name, language) : getSizeTypeDisplayLabel(entry.name)}
                                </button>
                              );
                            })}
                          </div>
                          {selectedFormIsShoes ? (
                            <span className="muted">{t.euShoeSizes}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {!selectedFormIsAccessories ? (
                      <div className="form-grid two">
                        <div className="field">
                          <label>
                            {selectedFormSizeType
                              ? `${language === "sq" ? formatVendorCatalogLabel(selectedFormSizeType.name, language) : getSizeTypeDisplayLabel(selectedFormSizeType.name)} ${t.sizes.toLowerCase()}`
                              : t.sizes}
                          </label>
                          <div className="vendor-size-grid" role="group" aria-label={t.productSizes}>
                            {availableFormSizes.map((entry) => {
                              const selected = form.sizeIds.includes(entry.id);
                              return (
                                <div
                                  key={entry.id}
                                  className={`vendor-size-stock-option${selected ? " selected" : ""}`}
                                >
                                  <button
                                    type="button"
                                    className={`vendor-size-option${selected ? " selected" : ""}`}
                                    aria-pressed={selected}
                                    onClick={() =>
                                      setForm((current) => ({
                                        ...current,
                                        sizeIds: selected
                                          ? current.sizeIds.filter((id) => id !== entry.id)
                                          : [...current.sizeIds, entry.id],
                                        sizeStocks: selected
                                          ? Object.fromEntries(
                                              Object.entries(current.sizeStocks).filter(
                                                ([id]) => id !== entry.id,
                                              ),
                                            )
                                          : {
                                              ...current.sizeStocks,
                                              [entry.id]: current.sizeStocks[entry.id] ?? "1",
                                            },
                                      }))
                                    }
                                  >
                                    {entry.label}
                                  </button>
                                  {selected ? (
                                    <label>
                                      <span>{t.stock}</span>
                                      <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={form.sizeStocks[entry.id] ?? ""}
                                        onChange={(event) =>
                                          setForm((current) => ({
                                            ...current,
                                            sizeStocks: {
                                              ...current.sizeStocks,
                                              [entry.id]: event.target.value,
                                            },
                                          }))
                                        }
                                      />
                                    </label>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </section>
                </div>

                <aside className="vendor-product-composer-side">
                  <section className="vendor-product-composer-panel vendor-upload-panel">
                    <div className="vendor-product-composer-section-head">
                      <span className="vendor-product-composer-step">04</span>
                      <div>
                        <h3>{t.imagesPublish}</h3>
                      </div>
                    </div>

                    <div className="vendor-product-meta-grid">
                      <div className="vendor-product-meta-card">
                        <span>{t.brand}</span>
                        <strong>{selectedFormBrand?.name ?? t.chooseBrand}</strong>
                      </div>
                      <div className="vendor-product-meta-card">
                        <span>{t.category}</span>
                        <strong>
                          {selectedFormCategory
                            ? formatVendorCatalogLabel(selectedFormCategory.name, language)
                            : t.chooseCategory}
                        </strong>
                      </div>
                      <div className="vendor-product-meta-card">
                        <span>{getVendorGenderLabel(language)}</span>
                        <strong>
                          {selectedFormGenderGroups.length
                            ? selectedFormGenderGroups
                                .map(
                                  (entry) =>
                                    language === "sq"
                                      ? formatVendorCatalogLabel(entry.name, language)
                                      : getCatalogDepartmentDisplayLabel(entry.name) ||
                                        formatCatalogLabel(entry.name),
                                )
                                .join(", ")
                            : t.optional}
                        </strong>
                      </div>
                      <div className="vendor-product-meta-card">
                        <span>{t.sizeSetup}</span>
                        <strong>
                          {selectedFormIsAccessories
                            ? t.notRequired
                            : selectedFormSizes.length
                            ? selectedFormSizes.map((entry) => entry.label).join(", ")
                            : (selectedFormSize?.label ??
                                (selectedFormSizeType?.name
                                  ? language === "sq"
                                    ? formatVendorCatalogLabel(selectedFormSizeType.name, language)
                                    : getSizeTypeDisplayLabel(selectedFormSizeType.name)
                                  : "")) ||
                              t.chooseSizeDetails}
                        </strong>
                      </div>
                    </div>

                    <div className="vendor-upload-dropzone">
                      <div className="vendor-upload-dropzone-copy">
                        <strong>
                          {selectedFilePreviews.length > 0
                            ? t.newImagesSelected(selectedFilePreviews.length)
                            : editingProduct?.images.length
                              ? t.savedImages(editingProduct.images.length)
                              : t.chooseProductImages}
                        </strong>
                      </div>
                      <ProductPhotoUploader
                        inputRef={productImageInputRef}
                        selectedFiles={files}
                        onFilesChange={handleProductImageFilesChange}
                        labels={t}
                      />
                    </div>

                    {editingProductId ? (
                      <label className="vendor-inline-toggle">
                        <input
                          type="checkbox"
                          checked={replaceImages}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setReplaceImages(checked);
                            setRemovedExistingImageUrls([]);
                            setExistingImageOrderUrls(editingProduct?.images ?? []);
                            setPrimaryImageKey(
                              checked
                                ? files.length
                                  ? "upload:0"
                                  : ""
                                : editingProduct?.images[0]
                                  ? `existing:${editingProduct.images[0]}`
                                  : files.length
                                    ? "upload:0"
                                    : "",
                            );
                          }}
                        />
                        {t.replaceImages}
                      </label>
                    ) : null}

                    {editingProduct &&
                    !replaceImages &&
                    existingImageOrderUrls.some((image) => !removedExistingImageUrls.includes(image)) ? (
                      <div className="vendor-preview-group">
                        <div className="vendor-preview-heading">{t.currentImages}</div>
                        <div className="preview-grid">
                          {existingImageOrderUrls.filter((image) => !removedExistingImageUrls.includes(image)).map((image, index) => (
                            <div
                              key={image}
                              className="preview-card"
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
                                  moveExistingProductImage(fromIndex, index);
                                }
                              }}
                            >
                              <ProductMedia
                                image={assetUrl(image)}
                                title={editingProduct.title}
                                subtitle={t.slotThumbnail(index + 1)}
                                className="card-image"
                              />
                              <button
                                className="preview-remove-button"
                                type="button"
                                aria-label={t.removeSavedImage}
                                onClick={() => removeExistingProductImage(image)}
                              >
                                {t.remove}
                              </button>
                              <button
                                className={`thumbnail-select-button${primaryImageKey === `existing:${image}` ? " selected" : ""}`}
                                type="button"
                                onClick={() => selectExistingThumbnail(image)}
                              >
                                {primaryImageKey === `existing:${image}` ? t.thumbnailSelected : t.setThumbnail}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {selectedFilePreviews.length > 0 ? (
                      <div className="vendor-preview-group">
                        <div className="vendor-preview-heading">{t.newUploads}</div>
                        <div className="preview-grid">
                          {selectedFilePreviews.map((preview, index) => (
                            <div
                              key={preview.url}
                              className="preview-card"
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
                                  moveSelectedProductImage(fromIndex, index);
                                }
                              }}
                            >
                              {preview.canPreview ? (
                                <ProductMedia
                                  image={preview.url}
                                  title={form.title || preview.name}
                                  subtitle={t.uploadSlotThumbnail(index + 1, primaryImageKey === preview.key)}
                                  className="card-image"
                                />
                              ) : (
                                <div className="vendor-selected-file-card">
                                  <strong>{t.photoSelected}</strong>
                                  <span>{preview.name}</span>
                                </div>
                              )}
                              <button
                                className="preview-remove-button"
                                type="button"
                                aria-label={t.removeNamed(preview.name)}
                                onClick={() => removeSelectedProductImage(index)}
                              >
                                {t.remove}
                              </button>
                              <button
                                className={`thumbnail-select-button${primaryImageKey === preview.key ? " selected" : ""}`}
                                type="button"
                                onClick={() => selectUploadedThumbnail(index)}
                              >
                                {primaryImageKey === preview.key
                                  ? t.thumbnailSelected
                                  : t.setThumbnail}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="inline-actions vendor-product-composer-actions">
                      <button className="button" type="submit" disabled={!vendorCanManageCatalog}>
                        {activeAction === (editingProductId ? `save-${editingProductId}` : "create-product")
                          ? editingProductId
                            ? t.updating
                            : t.creating
                          : editingProductId
                            ? t.updateProduct
                            : t.createProduct}
                      </button>
                      {editingProductId ? (
                        <button
                          className="button-ghost"
                          type="button"
                          disabled={activeAction !== null}
                          onClick={resetProductForm}
                        >
                          {t.cancelEdit}
                        </button>
                      ) : (
                        productComposerMode === "page" ? (
                          <Link className="button-ghost" href="/vendor/products">
                            {t.backToProducts}
                          </Link>
                        ) : (
                          <button
                            className="button-ghost"
                            type="button"
                            disabled={activeAction !== null}
                            onClick={resetProductForm}
                          >
                            {t.close}
                          </button>
                        )
                      )}
                    </div>
                  </section>
                </aside>
              </div>
                  </form>
                </div>
              </div>
            ) : null}
            {productComposerMode !== "page" ? (
            <section className="form-card stack">
              <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}><div><h2 className="section-title">Product list</h2><p className="muted">Search and filter your catalog, then edit or manage each product from its own row.</p></div><span className="chip">{filteredProducts.length} shown</span></div>
              <div className="vendor-product-toolbar"><div className="field"><label>Search products</label><input placeholder="Title, code, gender, category, color, size" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} /></div><div className="field"><label>Sort by</label><select value={productSort} onChange={(event) => setProductSort(event.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="price-low">Price ↑</option><option value="price-high">Price ↓</option><option value="title">A-Z</option><option value="most-ordered">Orders ↓</option></select></div><div className="field"><label>Listing filter</label><select value={listingFilter} onChange={(event) => setListingFilter(event.target.value)}><option value="all">Listed and hidden</option><option value="listed">Listed only</option><option value="hidden">Hidden only</option></select></div><div className="field"><label>{getCatalogGenderLabel()}</label><select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option value="all">All {getCatalogGenderLabel(true).toLowerCase()}</option>{vendorDepartments.map((entry) => <option key={entry} value={entry}>{formatCatalogLabel(entry)}</option>)}</select></div><div className="field"><label>Category</label><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{vendorCategories.map((entry) => <option key={entry} value={entry}>{formatCatalogLabel(entry)}</option>)}</select></div></div>
              {filteredProducts.length === 0 ? <div className="empty">{products.length === 0 ? "No products yet. Add your first product to start building the shop." : "No matching products yet."}</div> : filteredProducts.map((product) => <div key={product.id} className="card vendor-product-collapsible"><div className="vendor-product-summary-row"><div className="vendor-product-summary-main"><strong>{product.productCode || "Code pending"}</strong><span className="muted">{product.title}</span><span className="muted">{getVendorProductVisibilityLabel(product)}</span>{product.adminBlockReason ? <span className="muted">{product.adminBlockReason}</span> : null}<span className="muted">Stock {product.stock}</span><span className="muted">{formatCurrency(product.price)}</span></div><div className="vendor-product-summary-end"><span className={product.isOutOfStock ? "badge danger" : product.isLowStock ? "badge warn" : "badge"}>{product.isOutOfStock ? "Out of stock" : product.isLowStock ? "Low stock" : "Healthy stock"}</span></div></div><div className="vendor-product-expanded"><div className="vendor-product-preview"><ProductMedia image={assetUrl(product.images[0])} title={product.title} subtitle={`${formatCatalogLabel(product.department)} ${formatCatalogLabel(product.category)}`} className="card-image" /></div><div className="vendor-product-content"><div className="stack" style={{ gap: "0.2rem" }}><strong>{product.title}</strong><p className="muted">{formatCatalogLabel(product.department)} | {formatCatalogLabel(product.category)}{product.color ? ` | ${formatProductAttributeLabel(product.color)}` : ""}{product.size ? ` | ${formatProductAttributeLabel(product.size)}` : ""}</p></div><div className="vendor-product-metrics"><span>{product.adminStatus === "approved" && product.isListed ? "Public listing active" : "Hidden from customers"}</span><span>Price {formatCurrency(product.price)}</span><span>Stock {product.stock}</span><span>Sold {product.soldUnits}</span><span>Orders {product.orderCount}</span>{vendorCanViewFinance ? <span>Earnings {formatCurrency(product.revenue)}</span> : null}</div></div><div className="vendor-product-actions"><button className="button-secondary" type="button" disabled={activeAction !== null} onClick={() => startEditProduct(product)}>Edit</button><button className="button-ghost" type="button" disabled={activeAction !== null} onClick={() => duplicateProduct(product.id)}>{activeAction === `duplicate-${product.id}` ? "Duplicating..." : "Duplicate"}</button><button className="button-ghost" type="button" disabled={activeAction !== null || product.adminStatus === "under_review"} onClick={() => toggleProductListing(product, !product.isListed)}>{getVendorProductListingActionLabel(product)}</button><button className="danger-button" type="button" disabled={activeAction !== null} onClick={() => deleteProduct(product.id)}>{activeAction === `delete-${product.id}` ? "Deleting..." : "Delete"}</button></div></div></div>)}
            </section>
            ) : null}
          </>
        ) : null}

        {section === "inventory" ? <><section className="form-card stack"><div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}><div><h2 className="section-title">Stock controls</h2><p className="muted">Focus only on stock levels, low-stock alerts, out-of-stock items, and bulk quantity updates.</p></div><span className="chip">Threshold {lowStockThreshold === 0 ? "off" : lowStockThreshold}</span></div><div className="vendor-product-toolbar"><div className="field"><label>Search products</label><input placeholder="Title, code, color, size" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} /></div><div className="field"><label>Stock filter</label><select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}><option value="all">All stock states</option><option value="low_stock">Low stock</option><option value="out_of_stock">Out of stock</option><option value="in_stock">In stock</option></select></div><div className="field"><label>{getCatalogGenderLabel()}</label><select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option value="all">All {getCatalogGenderLabel(true).toLowerCase()}</option>{vendorDepartments.map((entry) => <option key={entry} value={entry}>{formatCatalogLabel(entry)}</option>)}</select></div><div className="field"><label>Category</label><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{vendorCategories.map((entry) => <option key={entry} value={entry}>{formatCatalogLabel(entry)}</option>)}</select></div></div></section><section className="form-card stack"><div className="card vendor-bulk-actions"><div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}><div><strong>Bulk stock update</strong><p className="muted">Select products below, set one shared stock value, and update them together.</p></div><span className="chip">{selectedProductIds.length} selected</span></div><div className="inline-actions"><button className="button-secondary" type="button" onClick={() => setSelectedProductIds(filteredProducts.map((product) => product.id))} disabled={filteredProducts.length === 0}>Select shown</button><button className="button-ghost" type="button" onClick={() => setSelectedProductIds([])} disabled={selectedProductIds.length === 0}>Clear selection</button></div><div className="inline-actions" style={{ alignItems: "end" }}><div className="field" style={{ minWidth: "180px" }}><label>New stock for selected</label><input type="number" min="1" step="1" value={bulkStockValue} onChange={(event) => setBulkStockValue(event.target.value)} placeholder="e.g. 12" /></div><button className="button" type="button" disabled={selectedProductIds.length === 0 || bulkStockValue.trim().length === 0} onClick={() => void applyBulkStockUpdate()}>{activeAction === "bulk-stock" ? "Updating..." : "Apply stock update"}</button></div></div>{filteredProducts.length === 0 ? <div className="empty">No stock-managed products for this filter.</div> : filteredProducts.map((product) => <div key={product.id} className="card vendor-product-collapsible"><div className="vendor-product-summary-row"><div className="vendor-product-summary-main"><label className="vendor-row-check"><input type="checkbox" checked={selectedProductIds.includes(product.id)} onChange={(event) => setSelectedProductIds((current) => event.target.checked ? [...current, product.id] : current.filter((entry) => entry !== product.id))} /></label><strong>{product.productCode || "Code pending"}</strong><span className="muted">{product.title}</span><span className="muted">Stock {product.stock}</span><span className="muted">Sold {product.soldUnits}</span></div><div className="vendor-product-summary-end"><span className={product.isOutOfStock ? "badge danger" : product.isLowStock ? "badge warn" : "badge"}>{product.isOutOfStock ? "Out of stock" : product.isLowStock ? "Low stock" : "Healthy stock"}</span></div></div></div>)}</section></> : null}

        {section === "orders" ? (
          <section className="form-card stack">
            <div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 className="section-title">Order handling</h2>
                <p className="muted">Cancel requests stay at the top and pause shipping actions until the request is handled.</p>
              </div>
              <span className="chip">{filteredOrders.length} orders</span>
            </div>
            <div className="field">
              <label>Order status</label>
              <select value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)}>
                <option value="needs_response">Needs response</option>
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="returned">Returned</option>
              </select>
            </div>
            {orderFilter === "needs_response" && pendingResponseOrders.length === 0 ? (
              <div className="empty">No orders are waiting for your response right now.</div>
            ) : filteredOrders.length === 0 ? (
              <div className="empty">No orders for this filter yet.</div>
            ) : (
              filteredOrders.map((order) => renderVendorOrderCard(order))
            )}
          </section>
        ) : null}

        {section === "earnings" ? <><div className="vendor-overview-grid"><div className="card vendor-overview-card"><span>Total vendor earnings</span><strong>{formatCurrency(projectedRevenue)}</strong><p>Net earnings tracked across all vendor order items.</p></div><div className="card vendor-overview-card"><span>Completed orders</span><strong>{completedOrders}</strong><p>Delivered orders contributing to your performance.</p></div><div className="card vendor-overview-card"><span>Units sold</span><strong>{totalSoldUnits}</strong><p>Total sold units across your active catalog.</p></div><div className="card vendor-overview-card"><span>Cancelled / returned</span><strong>{cancelledOrders + returnedOrders}</strong><p>Orders that did not finish the normal delivery flow.</p></div></div><div className="vendor-section-grid"><section className="form-card stack"><div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}><h2 className="section-title">Top-selling products</h2><span className="chip">{bestSellers.length}</span></div>{bestSellers.length === 0 ? <div className="empty">Sales data will appear here once orders start coming in.</div> : bestSellers.map((product) => <div key={product.id} className="vendor-activity-row"><div><strong>{product.title}</strong><p className="muted">{product.soldUnits} sold | {product.orderCount} orders</p></div><span className="chip">{formatCurrency(product.revenue)}</span></div>)}</section><section className="form-card stack"><div className="inline-actions" style={{ justifyContent: "space-between", alignItems: "center" }}><h2 className="section-title">Recent earnings</h2><span className="chip">{recentOrders.length}</span></div>{recentOrders.length === 0 ? <div className="empty">No earnings activity yet.</div> : recentOrders.map((order) => <div key={order.id} className="vendor-activity-row"><div><strong>{getVendorCustomerLabel(order)}</strong><p className="muted">{new Date(order.createdAt).toLocaleDateString()}</p></div><span className="chip">{formatCurrency(order.items.reduce((sum, item) => sum + item.vendorEarnings, 0))}</span></div>)}</section></div></> : null}
      </VendorWorkspaceShell>
    </RequireRole>
  );
}

