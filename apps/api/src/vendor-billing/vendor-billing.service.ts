import { Injectable } from '@nestjs/common';
import { DatabaseService, QueryRunner } from '../database/database.service';

type VendorFeePaymentMethod = 'card' | 'cash';
type VendorFeePaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled';

@Injectable()
export class VendorBillingService {
  private readonly feePerOrder = 1;

  constructor(private readonly databaseService: DatabaseService) {}

  async syncVendorMonthlyFees(
    vendorId?: string,
    runner: QueryRunner = this.databaseService,
  ) {
    const filter = vendorId ? 'AND oi.vendor_id = $1' : '';
    const params = vendorId ? [vendorId] : [];

    await runner.query(
      `;WITH vendor_order_months AS (
         SELECT
           oi.vendor_id,
           DATEFROMPARTS(YEAR(o.created_at), MONTH(o.created_at), 1) AS billing_month_start,
           EOMONTH(o.created_at) AS billing_month_end,
           COUNT(DISTINCT oi.order_id) AS billed_order_count
         FROM order_items oi
         INNER JOIN orders o ON o.id = oi.order_id
         WHERE oi.status NOT IN ('cancelled', 'returned')
         ${filter}
         GROUP BY
           oi.vendor_id,
           DATEFROMPARTS(YEAR(o.created_at), MONTH(o.created_at), 1),
           EOMONTH(o.created_at)
       )
       MERGE dbo.vendor_monthly_fees AS target
       USING vendor_order_months AS source
       ON target.vendor_id = source.vendor_id
         AND target.billing_month_start = source.billing_month_start
       WHEN MATCHED THEN
         UPDATE SET
           billing_month_end = source.billing_month_end,
           billed_order_count = source.billed_order_count,
           fee_per_order = ${this.feePerOrder.toFixed(2)},
           billed_amount = CAST(source.billed_order_count * ${this.feePerOrder.toFixed(
             2,
           )} AS DECIMAL(10, 2)),
           last_calculated_at = SYSDATETIME(),
           updated_at = SYSDATETIME()
       WHEN NOT MATCHED THEN
         INSERT (
           vendor_id,
           billing_month_start,
           billing_month_end,
           billed_order_count,
           fee_per_order,
           billed_amount,
           settled_amount,
           last_calculated_at,
           created_at,
           updated_at
         )
         VALUES (
           source.vendor_id,
           source.billing_month_start,
           source.billing_month_end,
           source.billed_order_count,
           ${this.feePerOrder.toFixed(2)},
           CAST(source.billed_order_count * ${this.feePerOrder.toFixed(
             2,
           )} AS DECIMAL(10, 2)),
           0,
           SYSDATETIME(),
           SYSDATETIME(),
           SYSDATETIME()
         );`,
      params,
    );
  }

  async getVendorBillingOverview(vendorId: string) {
    await this.syncVendorMonthlyFees(vendorId);

    const [summary, periods, payments] = await Promise.all([
      this.databaseService.query<{
        total_billed_orders: number;
        total_billed_amount: number | string;
        total_settled_amount: number | string;
        total_outstanding_amount: number | string;
        current_month_orders: number;
        current_month_amount: number | string;
        current_month_outstanding: number | string;
      }>(
        `SELECT
           ISNULL(SUM(vmf.billed_order_count), 0) AS total_billed_orders,
           ISNULL(SUM(vmf.billed_amount), 0) AS total_billed_amount,
           ISNULL(SUM(vmf.settled_amount), 0) AS total_settled_amount,
           ISNULL(SUM(CASE
             WHEN vmf.billed_amount > vmf.settled_amount
               THEN vmf.billed_amount - vmf.settled_amount
             ELSE 0
           END), 0) AS total_outstanding_amount,
           ISNULL(SUM(CASE
             WHEN vmf.billing_month_start = DATEFROMPARTS(YEAR(SYSDATETIME()), MONTH(SYSDATETIME()), 1)
               THEN vmf.billed_order_count
             ELSE 0
           END), 0) AS current_month_orders,
           ISNULL(SUM(CASE
             WHEN vmf.billing_month_start = DATEFROMPARTS(YEAR(SYSDATETIME()), MONTH(SYSDATETIME()), 1)
               THEN vmf.billed_amount
             ELSE 0
           END), 0) AS current_month_amount,
           ISNULL(SUM(CASE
             WHEN vmf.billing_month_start = DATEFROMPARTS(YEAR(SYSDATETIME()), MONTH(SYSDATETIME()), 1)
               THEN CASE
                 WHEN vmf.billed_amount > vmf.settled_amount
                   THEN vmf.billed_amount - vmf.settled_amount
                 ELSE 0
               END
             ELSE 0
           END), 0) AS current_month_outstanding
         FROM vendor_monthly_fees vmf
         WHERE vmf.vendor_id = $1`,
        [vendorId],
      ),
      this.databaseService.query<{
        id: string;
        vendor_id: string;
        billing_month_start: Date;
        billing_month_end: Date;
        billed_order_count: number;
        fee_per_order: number | string;
        billed_amount: number | string;
        settled_amount: number | string;
        last_calculated_at: Date;
        created_at: Date;
        updated_at: Date;
      }>(
        `SELECT
           id,
           vendor_id,
           billing_month_start,
           billing_month_end,
           billed_order_count,
           fee_per_order,
           billed_amount,
           settled_amount,
           last_calculated_at,
           created_at,
           updated_at
         FROM vendor_monthly_fees
         WHERE vendor_id = $1
         ORDER BY billing_month_start DESC`,
        [vendorId],
      ),
      this.databaseService.query<{
        id: string;
        vendor_fee_id: string;
        amount: number | string;
        payment_method: VendorFeePaymentMethod;
        payment_status: VendorFeePaymentStatus;
        reference: string | null;
        note: string | null;
        stripe_session_id: string | null;
        stripe_payment_intent_id: string | null;
        created_at: Date;
        paid_at: Date | null;
        admin_email: string | null;
      }>(
        `SELECT
           vfp.id,
           vfp.vendor_fee_id,
           vfp.amount,
           vfp.payment_method,
           vfp.payment_status,
           vfp.reference,
           vfp.note,
           vfp.stripe_session_id,
           vfp.stripe_payment_intent_id,
           vfp.created_at,
           vfp.paid_at,
           admin_user.email AS admin_email
         FROM vendor_fee_payments vfp
         LEFT JOIN users admin_user ON admin_user.id = vfp.admin_user_id
         WHERE vfp.vendor_id = $1
         ORDER BY
           CASE WHEN vfp.paid_at IS NULL THEN vfp.created_at ELSE vfp.paid_at END DESC,
           vfp.created_at DESC`,
        [vendorId],
      ),
    ]);

    const paymentMap = new Map<string, ReturnType<typeof this.mapPayment>[]>();
    for (const payment of payments.rows) {
      const current = paymentMap.get(payment.vendor_fee_id) ?? [];
      current.push(this.mapPayment(payment));
      paymentMap.set(payment.vendor_fee_id, current);
    }

    const summaryRow = summary.rows[0];

    return {
      summary: {
        feePerOrder: this.feePerOrder,
        totalBilledOrders: summaryRow?.total_billed_orders ?? 0,
        totalBilledAmount: Number(summaryRow?.total_billed_amount ?? 0),
        totalSettledAmount: Number(summaryRow?.total_settled_amount ?? 0),
        totalOutstandingAmount: Number(
          summaryRow?.total_outstanding_amount ?? 0,
        ),
        currentMonthOrders: summaryRow?.current_month_orders ?? 0,
        currentMonthAmount: Number(summaryRow?.current_month_amount ?? 0),
        currentMonthOutstanding: Number(
          summaryRow?.current_month_outstanding ?? 0,
        ),
      },
      periods: periods.rows.map((period) => {
        const billedAmount = Number(period.billed_amount);
        const settledAmount = Number(period.settled_amount);
        const outstandingAmount = Math.max(0, billedAmount - settledAmount);

        return {
          id: period.id,
          billingMonthStart: period.billing_month_start,
          billingMonthEnd: period.billing_month_end,
          billedOrderCount: period.billed_order_count,
          feePerOrder: Number(period.fee_per_order),
          billedAmount,
          settledAmount,
          outstandingAmount,
          status:
            outstandingAmount <= 0
              ? 'paid'
              : settledAmount > 0
                ? 'partial'
                : 'open',
          lastCalculatedAt: period.last_calculated_at,
          createdAt: period.created_at,
          updatedAt: period.updated_at,
          payments: paymentMap.get(period.id) ?? [],
        };
      }),
    };
  }

  async getAdminVendorFeeRows() {
    await this.syncVendorMonthlyFees();

    const result = await this.databaseService.query<{
      vendor_id: string;
      shop_name: string;
      vendor_email: string;
      total_billed_orders: number;
      total_billed_amount: number | string;
      total_settled_amount: number | string;
      total_outstanding_amount: number | string;
      current_month_orders: number;
      current_month_amount: number | string;
      current_month_outstanding: number | string;
      open_month_count: number;
    }>(
      `SELECT
         v.id AS vendor_id,
         v.shop_name,
         u.email AS vendor_email,
         ISNULL(SUM(vmf.billed_order_count), 0) AS total_billed_orders,
         ISNULL(SUM(vmf.billed_amount), 0) AS total_billed_amount,
         ISNULL(SUM(vmf.settled_amount), 0) AS total_settled_amount,
         ISNULL(SUM(CASE
           WHEN vmf.billed_amount > vmf.settled_amount
             THEN vmf.billed_amount - vmf.settled_amount
           ELSE 0
         END), 0) AS total_outstanding_amount,
         ISNULL(SUM(CASE
           WHEN vmf.billing_month_start = DATEFROMPARTS(YEAR(SYSDATETIME()), MONTH(SYSDATETIME()), 1)
             THEN vmf.billed_order_count
           ELSE 0
         END), 0) AS current_month_orders,
         ISNULL(SUM(CASE
           WHEN vmf.billing_month_start = DATEFROMPARTS(YEAR(SYSDATETIME()), MONTH(SYSDATETIME()), 1)
             THEN vmf.billed_amount
           ELSE 0
         END), 0) AS current_month_amount,
         ISNULL(SUM(CASE
           WHEN vmf.billing_month_start = DATEFROMPARTS(YEAR(SYSDATETIME()), MONTH(SYSDATETIME()), 1)
             THEN CASE
               WHEN vmf.billed_amount > vmf.settled_amount
                 THEN vmf.billed_amount - vmf.settled_amount
               ELSE 0
             END
           ELSE 0
         END), 0) AS current_month_outstanding,
         ISNULL(SUM(CASE
           WHEN vmf.billed_amount > vmf.settled_amount THEN 1 ELSE 0
         END), 0) AS open_month_count
       FROM vendors v
       INNER JOIN users u ON u.id = v.user_id
       LEFT JOIN vendor_monthly_fees vmf ON vmf.vendor_id = v.id
       GROUP BY v.id, v.shop_name, u.email
       ORDER BY total_outstanding_amount DESC, current_month_outstanding DESC, v.shop_name ASC`,
    );

    return result.rows.map((row) => ({
      vendorId: row.vendor_id,
      shopName: row.shop_name,
      vendorEmail: row.vendor_email,
      totalBilledOrders: row.total_billed_orders,
      totalBilledAmount: Number(row.total_billed_amount),
      totalSettledAmount: Number(row.total_settled_amount),
      totalOutstandingAmount: Number(row.total_outstanding_amount),
      currentMonthOrders: row.current_month_orders,
      currentMonthAmount: Number(row.current_month_amount),
      currentMonthOutstanding: Number(row.current_month_outstanding),
      openMonthCount: row.open_month_count,
      feePerOrder: this.feePerOrder,
    }));
  }

  async getVendorFeePeriodById(vendorFeeId: string, vendorId?: string) {
    const params = vendorId ? [vendorFeeId, vendorId] : [vendorFeeId];
    const vendorFilter = vendorId ? 'AND vendor_id = $2' : '';

    const result = await this.databaseService.query<{
      id: string;
      vendor_id: string;
      billing_month_start: Date;
      billing_month_end: Date;
      billed_order_count: number;
      fee_per_order: number | string;
      billed_amount: number | string;
      settled_amount: number | string;
    }>(
      `SELECT TOP 1
         id,
         vendor_id,
         billing_month_start,
         billing_month_end,
         billed_order_count,
         fee_per_order,
         billed_amount,
         settled_amount
       FROM vendor_monthly_fees
       WHERE id = $1
       ${vendorFilter}`,
      params,
    );

    return result.rows[0] ?? null;
  }

  async markFeePaymentSettled(
    input: {
      vendorFeeId: string;
      vendorId: string;
      amount: number;
      paymentMethod: VendorFeePaymentMethod;
      paymentStatus: 'paid' | 'pending';
      reference?: string | null;
      note?: string | null;
      adminUserId?: string | null;
      stripeSessionId?: string | null;
      stripePaymentIntentId?: string | null;
    },
    runner: QueryRunner = this.databaseService,
  ) {
    const payment = await runner.query<{ id: string }>(
      `INSERT INTO vendor_fee_payments (
         vendor_fee_id,
         vendor_id,
         admin_user_id,
         amount,
         payment_method,
         payment_status,
         reference,
         note,
         stripe_session_id,
         stripe_payment_intent_id,
         paid_at,
         created_at,
         updated_at
       )
       OUTPUT INSERTED.id
       VALUES (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7,
         $8,
         $9,
         $10,
         $11,
         SYSDATETIME(),
         SYSDATETIME()
       )`,
      [
        input.vendorFeeId,
        input.vendorId,
        input.adminUserId ?? null,
        Number(input.amount.toFixed(2)),
        input.paymentMethod,
        input.paymentStatus,
        input.reference?.trim() || null,
        input.note?.trim() || null,
        input.stripeSessionId ?? null,
        input.stripePaymentIntentId ?? null,
        input.paymentStatus === 'paid' ? new Date() : null,
      ],
    );

    if (input.paymentStatus === 'paid') {
      await runner.query(
        `UPDATE vendor_monthly_fees
         SET settled_amount = settled_amount + $1,
             updated_at = SYSDATETIME()
         WHERE id = $2`,
        [Number(input.amount.toFixed(2)), input.vendorFeeId],
      );
    }

    return payment.rows[0]?.id ?? null;
  }

  async cancelPendingCardPayments(
    vendorFeeId: string,
    runner: QueryRunner = this.databaseService,
  ) {
    await runner.query(
      `UPDATE vendor_fee_payments
       SET payment_status = 'cancelled',
           updated_at = SYSDATETIME()
       WHERE vendor_fee_id = $1
         AND payment_method = 'card'
         AND payment_status = 'pending'`,
      [vendorFeeId],
    );
  }

  async getPendingCardPaymentBySession(sessionId: string, vendorId: string) {
    const result = await this.databaseService.query<{
      id: string;
      vendor_fee_id: string;
      vendor_id: string;
      amount: number | string;
      payment_status: VendorFeePaymentStatus;
    }>(
      `SELECT TOP 1
         id,
         vendor_fee_id,
         vendor_id,
         amount,
         payment_status
       FROM vendor_fee_payments
       WHERE stripe_session_id = $1
         AND vendor_id = $2
       ORDER BY created_at DESC`,
      [sessionId, vendorId],
    );

    return result.rows[0] ?? null;
  }

  async finalizePendingCardPayment(
    paymentId: string,
    stripePaymentIntentId: string | null,
    paidAt: Date,
    runner: QueryRunner = this.databaseService,
  ) {
    const payment = await runner.query<{
      id: string;
      vendor_fee_id: string;
      amount: number | string;
      payment_status: VendorFeePaymentStatus;
    }>(
      `SELECT TOP 1 id, vendor_fee_id, amount, payment_status
       FROM vendor_fee_payments
       WHERE id = $1`,
      [paymentId],
    );

    const row = payment.rows[0];
    if (!row) {
      return null;
    }

    if (row.payment_status === 'paid') {
      return row;
    }

    await runner.query(
      `UPDATE vendor_fee_payments
       SET payment_status = 'paid',
           stripe_payment_intent_id = $1,
           paid_at = $2,
           updated_at = SYSDATETIME()
       WHERE id = $3`,
      [stripePaymentIntentId, paidAt, paymentId],
    );

    await runner.query(
      `UPDATE vendor_monthly_fees
       SET settled_amount = settled_amount + $1,
           updated_at = SYSDATETIME()
       WHERE id = $2`,
      [Number(row.amount), row.vendor_fee_id],
    );

    return row;
  }

  private mapPayment(payment: {
    id: string;
    amount: number | string;
    payment_method: VendorFeePaymentMethod;
    payment_status: VendorFeePaymentStatus;
    reference: string | null;
    note: string | null;
    stripe_session_id: string | null;
    stripe_payment_intent_id: string | null;
    created_at: Date;
    paid_at: Date | null;
    admin_email: string | null;
  }) {
    return {
      id: payment.id,
      amount: Number(payment.amount),
      paymentMethod: payment.payment_method,
      paymentStatus: payment.payment_status,
      reference: payment.reference,
      note: payment.note,
      stripeSessionId: payment.stripe_session_id,
      stripePaymentIntentId: payment.stripe_payment_intent_id,
      createdAt: payment.created_at,
      paidAt: payment.paid_at,
      adminEmail: payment.admin_email,
    };
  }
}
