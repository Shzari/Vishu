import { Module } from '@nestjs/common';
import { VendorAccessService } from './vendor-access.service';

@Module({
  providers: [VendorAccessService],
  exports: [VendorAccessService],
})
export class VendorAccessModule {}
