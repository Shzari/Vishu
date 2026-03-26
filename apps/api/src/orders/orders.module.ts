import { Module } from '@nestjs/common';
import { VendorAccessModule } from '../vendor-access/vendor-access.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [VendorAccessModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
