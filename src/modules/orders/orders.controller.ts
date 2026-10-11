import { Controller, Get, Post, Body, Param, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CheckoutDto } from './dto/checkout.dto';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';

@ApiTags('Orders & Ticketing')
@Controller('orders')
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly ordersService: OrdersService) {}

  @Post('checkout')
  @ResponseMessage('Order checkout completed and tickets generated successfully')
  @ApiOperation({ summary: 'Initiate ticket purchase checkout and generate cryptographic QR attendee passes' })
  @ApiBody({ type: CheckoutDto })
  @ApiResponse({ status: 201, description: 'Order created with verified ticket passes' })
  async checkout(@Body() dto: CheckoutDto) {
    return this.ordersService.checkout(dto);
  }

  @Get(':id')
  @ResponseMessage('Order confirmation retrieved successfully')
  @ApiOperation({ summary: 'Retrieve order confirmation and digital tickets' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Unique Order ID (UUID)',
    example: 'f87a31b4-71bc-445a-933e-0012fceb7593',
  })
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }
}
