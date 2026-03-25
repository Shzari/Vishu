import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class BrandingService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getBranding() {
    const result = await this.databaseService.query<{
      site_name: string;
      tagline: string;
      logo_image: Buffer | null;
      logo_mime_type: string | null;
      logo_svg: string | null;
    }>(
      `SELECT TOP 1 site_name, tagline, logo_image, logo_mime_type, logo_svg
       FROM dbo.site_branding
       WHERE id = 1`,
    );

    const row = result.rows[0];
    const logoImage = row?.logo_image ?? null;
    const logoMimeType = row?.logo_mime_type ?? null;
    const logoSvg = row?.logo_svg ?? null;
    const logoDataUrl =
      logoImage && logoMimeType
        ? `data:${logoMimeType};base64,${logoImage.toString('base64')}`
        : logoSvg
          ? `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(logoSvg)}`
          : null;

    return {
      siteName: row?.site_name ?? 'Vishu.shop',
      tagline:
        row?.tagline ?? 'Unified fashion storefront, hidden vendor identity',
      logoSvg,
      logoDataUrl,
    };
  }
}
