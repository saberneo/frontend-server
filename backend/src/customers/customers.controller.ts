import { Controller, Get, Post, Put, Delete, Patch, Param, Body, Query, UseGuards, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { FilterCustomersDto, UpdateCustomerStatusDto, CreateCustomerDto, UpdateCustomerDto } from './customer.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'List all customers' })
  findAll(@Query() filter: FilterCustomersDto) {
    return this.service.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer profile' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/orders')
  @ApiOperation({ summary: 'Get recent orders for a customer' })
  getOrders(@Param('id') id: string) {
    return this.service.getRecentOrders(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update customer status (mark At Risk, Active, etc.)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateCustomerStatusDto) {
    return this.service.updateStatus(id, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new customer' })
  create(@Body() dto: CreateCustomerDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update customer fields' })
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete a customer' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
