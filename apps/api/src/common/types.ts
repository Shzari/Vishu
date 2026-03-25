export type UserRole = 'admin' | 'vendor' | 'customer';
export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered';
export type PaymentMethod = 'cash_on_delivery' | 'card';
export type PaymentStatus =
  | 'cod_pending'
  | 'paid'
  | 'cod_collected'
  | 'cod_refused';

export interface AuthenticatedUser {
  sub: string;
  email: string;
  role: UserRole;
}

export const COMMISSION_RATE = 0.1;
