import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { VendorAccessModule } from '../vendor-access/vendor-access.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [JwtModule.register({ global: true }), VendorAccessModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
