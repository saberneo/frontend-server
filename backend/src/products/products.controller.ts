import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProductsService } from './products.service';
import { FilterProductsDto, CreateProductDto, UpdateProductDto } from './product.dto';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List products with optional filters' })
  findAll(@Query() filter: FilterProductsDto) {
    return this.service.findAll(filter);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Product statistics (counts, inventory value)' })
  stats() {
    return this.service.getStats();
  }

  @Get('categories')
  @ApiOperation({ summary: 'Product categories with counts' })
  categories() {
    return this.service.getCategories();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product detail' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update product fields' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a product' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
