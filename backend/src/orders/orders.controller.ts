import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { FilterOrdersDto, UpdateOrderStatusDto, CreateOrderDto } from './order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List all orders with optional filters' })
  findAll(@Query() filter: FilterOrdersDto) {
    return this.service.findAll(filter);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Order status counts' })
  stats() {
    return this.service.getStats();
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Revenue analytics: by day (30d), by status, top customers' })
  analytics() {
    return this.service.getAnalytics();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full order detail' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  create(@Body() dto: CreateOrderDto) {
    return this.service.create(dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status (e.g. ship an order)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.service.updateStatus(id, dto);
  }
}
