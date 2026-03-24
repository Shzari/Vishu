export type UserRole = "admin" | "vendor" | "customer";

export interface SessionUser {
  sub: string;
  email: string;
  role: UserRole;
}

export interface BrandingSettings {
  siteName: string;
  tagline: string;
  logoSvg: string | null;
  logoDataUrl: string | null;
}

export interface HomepageHeroSlide {
  id: string;
  headline?: string | null;
  subheading?: string | null;
  ctaLabel?: string | null;
  product: Product;
}

export interface HomepageHeroConfig {
  intervalSeconds: number;
  slides: HomepageHeroSlide[];
}

export interface ProfileResponse {
  id: string;
  email: string;
  fullName?: string | null;
  phoneNumber?: string | null;
  emailVerifiedAt?: string | null;
  role: UserRole;
  is_active: boolean;
  vendor?: {
    id: string;
    shop_name: string;
    is_active: boolean;
    is_verified: boolean;
    approved_at: string | null;
  } | null;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  isListed?: boolean;
  department: string;
  category: string;
  color?: string | null;
  size?: string | null;
  productCode?: string | null;
  vendor?: {
    id: string;
    shopName: string;
    logoUrl?: string | null;
  };
  images: string[];
  createdAt: string;
}

export interface PublicVendorSummary {
  id: string;
  shopName: string;
  shopDescription: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  productCount: number;
  categoryCount: number;
  departments: string[];
  categories: string[];
}

export interface PublicVendorDetail {
  id: string;
  shopName: string;
  shopDescription: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  businessHours: string | null;
  shippingNotes: string | null;
  returnPolicy: string | null;
  productCount: number;
  categories: string[];
  products: Product[];
}

export interface CartItem {
  productId: string;
  title: string;
  price: number;
  image?: string;
  quantity: number;
  stock: number;
}

export interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
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
    images: string[];
  };
}

export interface CustomerOrder {
  id: string;
  totalPrice: number;
  specialRequest?: string | null;
  fulfillment?: {
    placedAt: string;
    confirmedAt: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
  };
  shippingAddress?: {
    label: string | null;
    fullName: string | null;
    phoneNumber: string | null;
    line1: string;
    line2: string | null;
    city: string;
    stateRegion: string | null;
    postalCode: string;
    country: string;
  } | null;
  paymentCard?: {
    nickname: string | null;
    cardholderName: string | null;
    brand: string | null;
    last4: string;
  } | null;
  paymentMethod: string;
  paymentStatus: string;
  codStatusNote?: string | null;
  codUpdatedAt?: string | null;
  cancelRequest?: {
    status: string;
    note?: string | null;
    requestedAt?: string | null;
  };
  status: string;
  createdAt: string;
  items: OrderItem[];
}

export interface AdminUserRow {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  vendor_id: string | null;
  shop_name: string | null;
  vendor_active: boolean | null;
  vendor_verified: boolean | null;
}

export interface AdminOrderItem {
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
  vendor: {
    id: string;
    shopName: string;
  };
}

export interface AdminOrderRow {
  id: string;
  totalPrice: number;
  specialRequest?: string | null;
  paymentMethod: string;
  paymentStatus: string;
  codStatusNote?: string | null;
  codUpdatedAt?: string | null;
  cancelRequest?: {
    status: string;
    note?: string | null;
    requestedAt?: string | null;
  };
  status: string;
  createdAt: string;
  customerEmail: string;
  items: AdminOrderItem[];
}

export interface AdminActivityLogEntry {
  id: string;
  actionType: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  adminUserId: string;
  adminEmail: string;
}

export interface AdminReportingSnapshot {
  rangeDays: number;
  orderCount: number;
  averageOrderValue: number;
  revenue: number;
  newUsers: number;
  newCustomers: number;
  newVendors: number;
  topShop:
    | {
        vendorId: string;
        shopName: string;
        grossRevenue: number;
        orderCount: number;
      }
    | null;
  topCategory:
    | {
        category: string;
        unitsSold: number;
        grossRevenue: number;
      }
    | null;
}

export interface AdminOverview {
  totals: {
    totalUsers: number;
    totalCustomers: number;
    totalAdmins: number;
    totalVendors: number;
    activeVendors: number;
    subscribedVendors: number;
    subscriptionsExpiringSoon: number;
    pendingVendorApprovals: number;
    unreadNotifications: number;
    totalOrders: number;
  };
  commerce: {
    grossRevenue: number;
    totalCommission: number;
    totalVendorEarnings: number;
    ordersToday: number;
    ordersThisWeek: number;
    ordersThisMonth: number;
    pendingOrders: number;
    confirmedOrders: number;
    shippedOrders: number;
    deliveredOrders: number;
    cashOnDeliveryOrders: number;
    cashOnDeliveryPending: number;
    cashOnDeliveryCollected: number;
    cashOnDeliveryRefused: number;
    cashOnDeliveryValue: number;
    cashOnDeliveryCollectedValue: number;
  };
  reporting: {
    averageOrderValue: number;
    revenueLast7Days: number;
    revenueLast30Days: number;
    newUsersLast7Days: number;
    newCustomersLast7Days: number;
    newVendorsLast7Days: number;
    topShop:
      | {
          vendorId: string;
          shopName: string;
          grossRevenue: number;
          orderCount: number;
        }
      | null;
    topCategory:
      | {
          category: string;
          unitsSold: number;
          grossRevenue: number;
        }
      | null;
  };
  recentUsers: {
    id: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
  }[];
  recentOrders: {
    id: string;
    totalPrice: number;
    paymentMethod: string;
    paymentStatus: string;
    codStatusNote?: string | null;
    codUpdatedAt?: string | null;
    status: string;
    createdAt: string;
    customerEmail: string;
  }[];
  pendingVendors: {
    id: string;
    shopName: string;
    email: string;
    isVerified: boolean;
    approvedAt: string | null;
    createdAt: string;
  }[];
  notifications: {
    id: string;
    type: string;
    title: string;
    body: string;
    actionUrl: string | null;
    createdAt: string;
    readAt: string | null;
  }[];
  activities: AdminActivityLogEntry[];
}

export interface AdminUserDetail {
  id: string;
  email: string;
  phoneNumber: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  customer: {
    orderCount: number;
    totalSpend: number;
    recentOrders: {
      id: string;
      totalPrice: number;
      status: string;
      specialRequest: string | null;
      createdAt: string;
    }[];
    cart: {
      itemCount: number;
      items: {
        productId: string;
        title: string;
        category: string;
        quantity: number;
        price: number;
        updatedAt: string;
      }[];
    };
  };
  vendor: {
    id: string;
    shopName: string | null;
    isActive: boolean | null;
    isVerified: boolean | null;
    approvedAt: string | null;
    productCount: number;
    inventoryUnits: number;
    orderCount: number;
    totalEarnings: number;
    totalCommission: number;
  } | null;
}

export interface AdminPlatformSettings {
  email: {
    smtpHost: string | null;
    smtpPort: number | null;
    smtpSecure: boolean;
    smtpUser: string | null;
    smtpPasswordConfigured: boolean;
    mailFrom: string | null;
    appBaseUrl: string | null;
    vendorVerificationEmailsEnabled: boolean;
    adminVendorApprovalEmailsEnabled: boolean;
    passwordResetEmailsEnabled: boolean;
  };
  homepageHero: {
    intervalSeconds: number;
    slides: {
      id: string;
      productId: string;
      productTitle: string;
      productCode: string | null;
      shopName: string;
      imageUrl: string | null;
      headline: string | null;
      subheading: string | null;
      ctaLabel: string | null;
      isActive: boolean;
      sortOrder: number;
    }[];
  };
  activityLog: AdminActivityLogEntry[];
}

export interface AdminProductOption {
  id: string;
  title: string;
  category: string;
  color?: string | null;
  size?: string | null;
  stock: number;
  price: number;
  product_code?: string | null;
  vendor_id: string;
  shop_name: string;
}

export interface AdminVendorDetail {
  id: string;
  shopName: string;
  isActive: boolean;
  isVerified: boolean;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    isActive: boolean;
  };
  subscription: {
    planType: "monthly" | "yearly" | null;
    status: "inactive" | "active" | "expired";
    startedAt: string | null;
    endsAt: string | null;
    source: "automatic" | "manual_override";
  };
  automaticSubscription: {
    planType: "monthly" | "yearly" | null;
    status: "inactive" | "active" | "expired";
    startedAt: string | null;
    endsAt: string | null;
  };
  manualOverride: {
    planType: "monthly" | "yearly" | null;
    status: "active" | "expired";
    startedAt: string | null;
    endsAt: string | null;
    note: string | null;
    updatedAt: string | null;
  } | null;
  metrics: {
    productCount: number;
    inventoryUnits: number;
    orderCount: number;
    totalEarnings: number;
    totalCommission: number;
    pendingItems: number;
    shippedItems: number;
    paidOut: number;
    outstandingShippedBalance: number;
  };
  categories: {
    category: string;
    productCount: number;
  }[];
  recentOrderItems: {
    orderId: string;
    productTitle: string;
    productCode?: string | null;
    quantity: number;
    vendorEarnings: number;
    status: string;
    shipment?: {
      shippingCarrier: string | null;
      trackingNumber: string | null;
      shippedAt: string | null;
    };
    createdAt: string;
  }[];
  payoutHistory: {
    id: string;
    amount: number;
    reference: string | null;
    note: string | null;
    paidAt: string;
  }[];
  subscriptionHistory: {
    id: string;
    planType: "monthly" | "yearly";
    status: "active" | "expired";
    amount: number;
    adminNote: string | null;
    adminEmail: string | null;
    startsAt: string;
    endsAt: string;
    createdAt: string;
  }[];
}

export interface CustomerAddress {
  id: string;
  label: string;
  fullName: string;
  phoneNumber: string | null;
  line1: string;
  line2: string | null;
  city: string;
  stateRegion: string | null;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface CustomerPaymentMethod {
  id: string;
  nickname: string | null;
  cardholderName: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export interface CustomerAccount {
  profile: {
    id: string;
    email: string;
    fullName: string | null;
    phoneNumber: string | null;
    emailVerifiedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  addresses: CustomerAddress[];
  paymentMethods: CustomerPaymentMethod[];
  cart: {
    itemCount: number;
    items: {
      productId: string;
      title: string;
      category: string;
      quantity: number;
      price: number;
      image?: string | null;
      updatedAt: string;
    }[];
  };
  recentOrders: {
    id: string;
    totalPrice: number;
    specialRequest: string | null;
    status: string;
    createdAt: string;
  }[];
}

export interface AccountSettingsProfile {
  id: string;
  email: string;
  fullName: string | null;
  phoneNumber: string | null;
  emailVerifiedAt?: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  vendor?: {
    id: string;
    shopName: string;
    isActive: boolean;
    isVerified: boolean;
    supportEmail: string | null;
    supportPhone: string | null;
    shopDescription: string | null;
    logoUrl: string | null;
    bannerUrl: string | null;
    businessAddress: string | null;
    returnPolicy: string | null;
    businessHours: string | null;
    shippingNotes: string | null;
    lowStockThreshold: number;
    subscription: {
      planType: "monthly" | "yearly" | null;
      status: "inactive" | "active" | "expired";
      startedAt: string | null;
      endsAt: string | null;
      source: "automatic" | "manual_override";
      monthlyPrice: number;
      yearlyPrice: number;
    };
    automaticSubscription: {
      planType: "monthly" | "yearly" | null;
      status: "inactive" | "active" | "expired";
      startedAt: string | null;
      endsAt: string | null;
    };
    manualOverride: {
      planType: "monthly" | "yearly" | null;
      status: "active" | "expired";
      startedAt: string | null;
      endsAt: string | null;
      note: string | null;
      updatedAt: string | null;
    } | null;
    subscriptionHistory: {
      id: string;
      planType: "monthly" | "yearly";
      status: "active" | "expired";
      amount: number;
      adminNote: string | null;
      adminEmail: string | null;
      startsAt: string;
      endsAt: string;
      createdAt: string;
    }[];
    bankAccountName: string | null;
    bankName: string | null;
    bankIban: string | null;
    payoutSummary: {
      pendingBalance: number;
      shippedBalance: number;
      totalEarnings: number;
      paidOut: number;
      outstandingShippedBalance: number;
    };
  } | null;
}

export interface AdminVendorPayoutRow {
  vendorId: string;
  shopName: string;
  vendorEmail: string;
  bankAccountName: string | null;
  bankName: string | null;
  bankIban: string | null;
  grossSales: number;
  totalCommission: number;
  payableNow: number;
  totalVendorEarnings: number;
  shippedBalance: number;
  paidOut: number;
  outstandingShippedBalance: number;
  orderCount: number;
  bankReady: boolean;
}
