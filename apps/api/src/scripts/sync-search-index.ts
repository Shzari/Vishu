import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ProductsService } from '../products/products.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const productsService = app.get(ProductsService);
    const result = await productsService.reindexPublicSearchCatalog();
    console.log(result.message);
  } finally {
    await app.close();
  }
}

void main();
