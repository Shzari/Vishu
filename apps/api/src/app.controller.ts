import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { BrandingService } from './branding/branding.service';
import { ProductsService } from './products/products.service';

@Controller()
export class AppController {
  constructor(
    private readonly brandingService: BrandingService,
    private readonly productsService: ProductsService,
  ) {}

  @Public()
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'multi-vendor-marketplace-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('branding')
  getBranding() {
    return this.brandingService.getBranding();
  }

  @Public()
  @Get('homepage-hero')
  getHomepageHero() {
    return this.productsService.listHomepageHeroSlides();
  }
}
