import { Module } from '@nestjs/common';
import { VendorAccessModule } from '../vendor-access/vendor-access.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [VendorAccessModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
