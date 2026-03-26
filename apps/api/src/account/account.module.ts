import { Module } from '@nestjs/common';
import { VendorAccessModule } from '../vendor-access/vendor-access.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [VendorAccessModule],
  controllers: [AccountController],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}
