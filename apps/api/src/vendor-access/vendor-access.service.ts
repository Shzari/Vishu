import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type VendorTeamRole = 'shop_holder' | 'employee';

export interface VendorAccessContext {
  id: string;
  shop_name: string;
  is_active: boolean;
  is_verified: boolean;
  low_stock_threshold: number;
  access_role: VendorTeamRole;
  is_primary_owner: boolean;
}

@Injectable()
export class VendorAccessService {
  constructor(private readonly databaseService: DatabaseService) {}

  async activatePendingInvitesForUser(userId: string, email: string) {
    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `UPDATE vendor_team_invites
         SET status = 'expired',
             responded_at = COALESCE(responded_at, SYSDATETIME()),
             updated_at = SYSDATETIME()
         WHERE status = 'pending'
           AND expires_at < SYSDATETIME()
           AND (user_id = $1 OR email = $2)`,
        [userId, email.trim().toLowerCase()],
      );

      const pendingMembers = await client.query<{
        member_id: string;
        invite_id: string;
      }>(
        `SELECT tm.id AS member_id, i.id AS invite_id
         FROM vendor_team_invites i
         INNER JOIN vendor_team_members tm
           ON tm.vendor_id = i.vendor_id
          AND tm.user_id = COALESCE(i.user_id, $1)
         WHERE i.status = 'pending'
           AND i.expires_at >= SYSDATETIME()
           AND tm.status = 'pending'
           AND (i.user_id = $1 OR i.email = $2)`,
        [userId, email.trim().toLowerCase()],
      );

      for (const row of pendingMembers.rows) {
        await client.query(
          `UPDATE vendor_team_members
           SET status = 'active',
               joined_at = COALESCE(joined_at, SYSDATETIME()),
               updated_at = SYSDATETIME()
           WHERE id = $1`,
          [row.member_id],
        );

        await client.query(
          `UPDATE vendor_team_invites
           SET user_id = $1,
               status = 'accepted',
               responded_at = SYSDATETIME(),
               updated_at = SYSDATETIME()
           WHERE id = $2`,
          [userId, row.invite_id],
        );
      }
    });
  }

  async getVendorAccessForUser(
    userId: string,
  ): Promise<VendorAccessContext | null> {
    const result = await this.databaseService.query<VendorAccessContext>(
      `SELECT TOP 1
         v.id,
         v.shop_name,
         v.is_active,
         v.is_verified,
         v.low_stock_threshold,
         CASE
           WHEN v.user_id = $1 THEN 'shop_holder'
           ELSE tm.role
         END AS access_role,
         CASE
           WHEN v.user_id = $1 THEN CAST(1 AS BIT)
           ELSE CAST(0 AS BIT)
         END AS is_primary_owner
       FROM vendors v
       LEFT JOIN vendor_team_members tm
         ON tm.vendor_id = v.id
        AND tm.user_id = $1
        AND tm.status = 'active'
       WHERE v.user_id = $1
          OR tm.id IS NOT NULL
       ORDER BY CASE WHEN v.user_id = $1 THEN 0 ELSE 1 END`,
      [userId],
    );

    return result.rows[0] ?? null;
  }

  async requireVendorAccess(userId: string) {
    const access = await this.getVendorAccessForUser(userId);
    if (!access) {
      throw new ForbiddenException('Vendor profile not found');
    }

    return access;
  }

  async requireShopHolderAccess(userId: string) {
    const access = await this.requireVendorAccess(userId);
    if (access.access_role !== 'shop_holder') {
      throw new ForbiddenException(
        'Only a shop holder can manage this part of the vendor account',
      );
    }

    return access;
  }
}
